import type {
  SelfCheckReport,
  CriterionCheck,
  IdentifiedRisk,
  Citation,
} from "../../features/ai-assistant/types";
import type { RepoFileSnapshot } from "./repo";
import type { TestRule } from "./rules";

export interface CriterionLike {
  id: string;
  text: string;
  required: boolean;
  testIds: string[];
}

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z0-9\s_-]*PRIVATE KEY-----/,
  /(https?:\/\/)[^\/\s:@]+:[^\/\s:@]+@/,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[a-zA-Z0-9_-]{20,}\b/,
  /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
  /\bBearer\s+[a-zA-Z0-9_.\-~+/=]{20,}\b/,
  /(?:["']?[\w.-]*(?:password|secret|token|api_key)[\w.-]*["']?\s*[:=]\s*["']?)([^"'\s&,;]{8,})/,
];

export function scanRisks(files: Record<string, RepoFileSnapshot>): IdentifiedRisk[] {
  const risks: IdentifiedRisk[] = [];
  let riskCounter = 1;

  for (const [path, snapshot] of Object.entries(files)) {
    if (!snapshot || !snapshot.content) continue;
    const lines = snapshot.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // 1. Secrets check (Report only path and line, NEVER secret value)
      // Note: Skip demo key in webhooks.py initial repo if it's already there (or check if it triggers)
      // But if user pastes fake key, report secrets risk
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          risks.push({
            id: `risk_sec_${riskCounter++}`,
            severity: "high",
            category: "secrets",
            text: "Potential hardcoded credential or secret detected.",
            evidence: [{ path, startLine: lineNum, endLine: lineNum }],
          });
          break; // One secret risk per line
        }
      }

      // 2. Bare except check
      if (/^\s*except\s*:\s*($|#)/.test(line) || /except\s+Exception\s*:\s*pass/.test(line)) {
        risks.push({
          id: `risk_err_${riskCounter++}`,
          severity: "medium",
          category: "error_handling",
          text: "Bare exception handler or suppressed error detected.",
          evidence: [{ path, startLine: lineNum, endLine: lineNum }],
        });
      }

      // 3. TODO or FIXME check
      if (/\b(TODO|FIXME)\b/.test(line)) {
        risks.push({
          id: `risk_todo_${riskCounter++}`,
          severity: "low",
          category: "other",
          text: "Unresolved TODO or FIXME comment found.",
          evidence: [{ path, startLine: lineNum, endLine: lineNum }],
        });
      }

      // 4. print() in app/ files
      if (path.startsWith("app/") && /\bprint\s*\(/.test(line)) {
        risks.push({
          id: `risk_print_${riskCounter++}`,
          severity: "low",
          category: "other",
          text: "Debugging print() statement found in application code.",
          evidence: [{ path, startLine: lineNum, endLine: lineNum }],
        });
      }

      if (risks.length >= 12) break;
    }

    if (risks.length >= 12) break;
  }

  return risks.slice(0, 12);
}

export function buildSelfCheck(
  files: Record<string, RepoFileSnapshot>,
  criteria: CriterionLike[],
  rules: TestRule[]
): SelfCheckReport {
  const criteriaChecks: CriterionCheck[] = [];

  for (const criterion of criteria) {
    const matchingRules = rules.filter((r) => criterion.testIds.includes(r.testId));

    if (matchingRules.length === 0) {
      criteriaChecks.push({
        criterionId: criterion.id,
        text: criterion.text,
        required: criterion.required,
        status: "unknown",
        reasoning: "No automated verification checks configured for this criterion.",
        evidence: [],
      });
      continue;
    }

    let passedCount = 0;
    const evidenceList: Citation[] = [];

    for (const rule of matchingRules) {
      const snapshot = files[rule.file];
      const content = snapshot?.content || "";
      let passed = false;

      if (rule.ruleType === "contains") {
        passed = content.includes(rule.needle);
      } else if (rule.ruleType === "regex") {
        try {
          passed = new RegExp(rule.needle, "i").test(content);
        } catch {
          passed = false;
        }
      } else {
        passed = content.includes(rule.needle);
      }

      if (passed) {
        passedCount++;
      }

      // Find line number for evidence
      let startLine: number | null = null;
      let snippet: string | null = null;
      if (content) {
        const lines = content.split("\n");
        const idx = lines.findIndex((l) =>
          rule.ruleType === "regex"
            ? new RegExp(rule.needle, "i").test(l)
            : l.includes(rule.needle)
        );
        if (idx !== -1) {
          startLine = idx + 1;
          snippet = lines[idx].trim().slice(0, 120);
        } else {
          // If rule didn't pass, find relevant function name in file
          const fnIdx = lines.findIndex((l) => l.includes("def ") || l.includes("function "));
          if (fnIdx !== -1) {
            startLine = fnIdx + 1;
            snippet = lines[fnIdx].trim().slice(0, 120);
          }
        }
      }

      evidenceList.push({
        path: rule.file,
        startLine,
        endLine: startLine,
        snippet,
      });
    }

    let status: "met" | "partial" | "not_met" = "not_met";
    let reasoning = "";

    if (passedCount === matchingRules.length) {
      status = "met";
      reasoning = "All required checks verified in saved files for this criterion.";
    } else if (passedCount > 0) {
      status = "partial";
      reasoning = `Passed ${passedCount} of ${matchingRules.length} checks. Some logic is still missing.`;
    } else {
      status = "not_met";
      reasoning = "None of the required logic or assertions were satisfied in the saved files.";
    }

    criteriaChecks.push({
      criterionId: criterion.id,
      text: criterion.text,
      required: criterion.required,
      status,
      reasoning,
      evidence: evidenceList.slice(0, 3),
    });
  }

  const risks = scanRisks(files);

  return {
    reportId: `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    generatedAt: new Date().toISOString(),
    repoCommitSha: "a1b2c3d",
    criteria: criteriaChecks.slice(0, 12),
    risks,
  };
}
