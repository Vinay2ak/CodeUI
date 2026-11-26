import { AiVerificationReport, DiffFile } from './types';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * Validates whether each evidence path in the report exists in the diff files.
 * Paths are compared case-sensitively after normalizing backslashes to forward slashes.
 */
export function validateEvidence(
  report: AiVerificationReport,
  diffFiles: Array<{ path: string } | DiffFile>
): AiVerificationReport {
  const diffPathSet = new Set(diffFiles.map((f) => normalizePath(f.path)));

  const updatedCriteria = report.criteria.map((criterion) => {
    const updatedEvidence = criterion.evidence.map((ev) => {
      const normalized = normalizePath(ev.path);
      const inDiff = diffPathSet.has(normalized);
      return {
        ...ev,
        inDiff,
      };
    });

    return {
      ...criterion,
      evidence: updatedEvidence,
    };
  });

  return {
    ...report,
    criteria: updatedCriteria,
  };
}

/**
 * Counts how many evidence items are flagged with inDiff === false across all criteria.
 */
export function countUnverifiedEvidence(report: AiVerificationReport): number {
  let count = 0;
  for (const criterion of report.criteria) {
    for (const ev of criterion.evidence) {
      if (ev.inDiff === false) {
        count++;
      }
    }
  }
  return count;
}
