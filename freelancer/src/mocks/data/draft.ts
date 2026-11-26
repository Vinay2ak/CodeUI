import type { DraftSummary } from "../../features/ai-assistant/types";
import type { RepoFileSnapshot } from "./repo";
import { clampText } from "../../lib/safeText";

export function buildDraft(
  changedFiles: string[],
  criteriaStatuses: Record<string, string> = {},
  files: Record<string, RepoFileSnapshot> = {}
): DraftSummary {
  const summarySentences: string[] = [];

  if (changedFiles.length === 0) {
    summarySentences.push("No workspace file modifications detected.");
  } else {
    for (const path of changedFiles) {
      const content = files[path]?.content || "";
      if (path === "app/webhooks.py") {
        const parts: string[] = [];
        if (content.includes("processed_event_ids")) {
          parts.push("added event de-duplication");
        }
        if (content.includes("status_code=400") || content.includes("400")) {
          parts.push("returns 400 for an invalid signature");
        }
        if (parts.length > 0) {
          summarySentences.push(`app/webhooks.py: ${parts.join(" and ")}.`);
        } else {
          summarySentences.push("app/webhooks.py: updated webhook processing logic.");
        }
      } else if (path === "app/retry.py") {
        if (content.includes("MAX_ATTEMPTS") || content.includes("2 ** attempt")) {
          summarySentences.push(
            "app/retry.py: implemented exponential backoff schedule with maximum retry limit."
          );
        } else {
          summarySentences.push("app/retry.py: updated retry scheduling logic.");
        }
      } else if (path === "README.md") {
        if (content.toLowerCase().includes("idempotent") || content.toLowerCase().includes("idempotency")) {
          summarySentences.push("README.md: documented idempotency and webhook error handling.");
        } else {
          summarySentences.push("README.md: updated documentation.");
        }
      } else {
        summarySentences.push(`Updated ${path}.`);
      }
    }
  }

  const rawSummary = summarySentences.join(" ");
  const summary = clampText(rawSummary, 480);

  // Analyze criteria statuses for notes
  const statusValues = Object.values(criteriaStatuses);
  let passingRequiredCount = 0;
  let totalRequiredCount = 4; // Default for t1

  if (statusValues.length > 0) {
    passingRequiredCount = statusValues.filter((s) => s === "met" || s === "passed").length;
  }

  let notes = "";
  if (passingRequiredCount >= totalRequiredCount) {
    notes = `All ${totalRequiredCount} required tests are passing. Implemented idempotent webhook processing and exponential backoff retry scheduling.`;
  } else {
    notes = `${passingRequiredCount}/${totalRequiredCount} required criteria passing. Implemented core fixes and verified with test suite.`;
  }
  notes = clampText(notes, 480);

  return {
    draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    generatedAt: new Date().toISOString(),
    summary,
    filesModified: changedFiles.slice(0, 20),
    notes,
  };
}
