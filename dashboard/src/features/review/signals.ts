import { AutomatedRun, AiVerificationReport } from './types';

export interface SignalsResult {
  criteriaCounts: {
    met: number;
    partial: number;
    not_met: number;
    unknown: number;
  };
  disagreement: 'none' | 'checks_pass_ai_flags' | 'checks_fail_ai_clean';
  disagreeingCriteria: number;
}

/**
 * Derives statistical counts and cross-system alignment signals between automated checks and AI verification.
 */
export function deriveSignals(
  run: AutomatedRun | null,
  report: AiVerificationReport | null
): SignalsResult {
  const criteriaCounts = {
    met: 0,
    partial: 0,
    not_met: 0,
    unknown: 0,
  };

  if (report) {
    for (const c of report.criteria) {
      if (c.status === 'met') criteriaCounts.met++;
      else if (c.status === 'partial') criteriaCounts.partial++;
      else if (c.status === 'not_met') criteriaCounts.not_met++;
      else criteriaCounts.unknown++;
    }
  }

  if (!run || !report || report.criteria.length === 0) {
    return {
      criteriaCounts,
      disagreement: 'none',
      disagreeingCriteria: 0,
    };
  }

  const requiredChecks = run.checks.filter((c) => c.required);
  const allRequiredPassed =
    requiredChecks.length > 0 &&
    run.status === 'completed' &&
    requiredChecks.every((c) => c.status === 'passed');

  const anyRequiredCheckFailed =
    run.status === 'failed_to_run' ||
    requiredChecks.some((c) => c.status === 'failed' || c.status === 'timed_out' || c.status === 'error');

  // Count required criteria that are partial or not_met
  const flaggedRequiredCriteria = report.criteria.filter(
    (c) => c.required && (c.status === 'partial' || c.status === 'not_met')
  );

  const allCriteriaMet =
    report.criteria.length > 0 && report.criteria.every((c) => c.status === 'met');

  // checks_pass_ai_flags: all required checks passed and at least one required criterion is partial or not_met
  if (allRequiredPassed && flaggedRequiredCriteria.length > 0) {
    return {
      criteriaCounts,
      disagreement: 'checks_pass_ai_flags',
      disagreeingCriteria: flaggedRequiredCriteria.length,
    };
  }

  // checks_fail_ai_clean: a required check failed and every criterion is met
  if (anyRequiredCheckFailed && allCriteriaMet) {
    return {
      criteriaCounts,
      disagreement: 'checks_fail_ai_clean',
      disagreeingCriteria: 0,
    };
  }

  return {
    criteriaCounts,
    disagreement: 'none',
    disagreeingCriteria: 0,
  };
}
