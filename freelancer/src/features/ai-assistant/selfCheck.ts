import type { SelfCheckReport, CriterionCheck, Citation } from "./types";
import { normalizePath } from "./citations";
import { isStale } from "./staleness";

export interface FlaggedCitation extends Citation {
  inChangedFiles: boolean;
}

export interface FlaggedCriterionCheck extends Omit<CriterionCheck, "evidence"> {
  evidence: FlaggedCitation[];
}

export interface FlaggedSelfCheckReport extends Omit<SelfCheckReport, "criteria"> {
  criteria: FlaggedCriterionCheck[];
}

export function summarizeReport(report: SelfCheckReport): {
  met: number;
  partial: number;
  notMet: number;
  unknown: number;
} {
  let met = 0;
  let partial = 0;
  let notMet = 0;
  let unknown = 0;

  if (report && Array.isArray(report.criteria)) {
    for (const c of report.criteria) {
      if (c.status === "met") met++;
      else if (c.status === "partial") partial++;
      else if (c.status === "not_met") notMet++;
      else unknown++;
    }
  }

  return { met, partial, notMet, unknown };
}

export function flagEvidence(
  report: SelfCheckReport,
  changedPaths: Set<string>
): FlaggedSelfCheckReport {
  if (!report) {
    return {
      reportId: "",
      generatedAt: "",
      repoCommitSha: "",
      criteria: [],
      risks: [],
    };
  }

  const flaggedCriteria: FlaggedCriterionCheck[] = (report.criteria || []).map(
    (crit) => ({
      ...crit,
      evidence: (crit.evidence || []).map((ev) => ({
        ...ev,
        inChangedFiles: changedPaths.has(normalizePath(ev.path)),
      })),
    })
  );

  return {
    ...report,
    criteria: flaggedCriteria,
  };
}

export function isReportStale(
  generatedAtIso: string,
  lastSavedAtMs: number | null
): boolean {
  return isStale(generatedAtIso, lastSavedAtMs);
}
