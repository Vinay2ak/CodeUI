import { CurrentSubmission, AiVerificationResponse, SubmissionStatus } from './types';
import { aiVerificationReportSchema } from '../../features/review/schemas';
import { safeLine } from '../../lib/safeText';

export function adaptSubmissionStatus(raw: any): SubmissionStatus {
  const s = String(raw || '').toLowerCase();
  if (s === 'in_review' || s === 'under_review' || s === 'submitted') return 'in_review';
  if (s === 'changes_requested') return 'changes_requested';
  if (s === 'approved') return 'approved';
  return 'none';
}

export function adaptCurrentSubmission(raw: any): CurrentSubmission {
  return {
    submissionId: String(raw?.submissionId || raw?.submission_id || raw?.id || ''),
    version: Number(raw?.version || 1),
    versionCount: Number(raw?.versionCount || raw?.version_count || 1),
    status: adaptSubmissionStatus(raw?.status),
    submittedAt: raw?.submittedAt || raw?.submitted_at || new Date().toISOString(),
    developerName: safeLine(raw?.developerName || raw?.developer_name || raw?.freelancerName || 'Developer'),
    summary: safeLine(raw?.summary || ''),
    notes: safeLine(raw?.notes || ''),
    commitSha: String(raw?.commitSha || raw?.commit_sha || ''),
    feedback: raw?.feedback ? safeLine(raw.feedback) : null,
    decidedAt: raw?.decidedAt || raw?.decided_at || null,
  };
}

export function adaptAiVerification(raw: any): AiVerificationResponse {
  const status = (raw?.status || 'not_requested').toLowerCase() as AiVerificationResponse['status'];
  let report = null;

  if (raw?.report) {
    try {
      report = aiVerificationReportSchema.parse(raw.report);
    } catch {
      report = null;
    }
  }

  return {
    status,
    report,
    error: raw?.error ? { code: String(raw.error.code), message: safeLine(raw.error.message) } : null,
  };
}
