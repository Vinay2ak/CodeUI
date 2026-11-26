export type SubmissionStatus = 'none' | 'in_review' | 'changes_requested' | 'approved';

export type PaymentState =
  | 'unrequested'
  | 'authorized'
  | 'held'
  | 'release_pending'
  | 'released'
  | 'refunded';

export interface CurrentSubmission {
  submissionId: string;
  version: number;
  versionCount: number;
  status: SubmissionStatus;
  submittedAt: string;
  developerName: string;
  summary: string;
  notes: string;
  commitSha: string;
  feedback: string | null;
  decidedAt: string | null;
}

export interface ReviewDecisionPayload {
  submissionId: string;
  decision: 'approve' | 'changes_requested';
  feedback?: string;
  flaggedItems?: string[];
}

export interface DockerTestResult {
  id: string;
  kind: 'install' | 'build' | 'lint' | 'test' | 'other';
  command: string;
  exitCode: number | null;
  status: 'passed' | 'failed' | 'timed_out' | 'skipped' | 'error';
  durationMs: number;
  required: boolean;
  logTail: string;
  logTruncated: boolean;
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

export interface AutomatedRun {
  runId: string;
  submissionId: string;
  commitSha: string;
  status: 'running' | 'completed' | 'failed_to_run';
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
  checks: DockerTestResult[];
  diff: {
    files: DiffFile[];
    totalAdditions: number;
    totalDeletions: number;
  };
}

export interface EvidenceItem {
  path: string;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
  inDiff?: boolean;
}

export interface AiVerificationCriterion {
  criterionId: string;
  text: string;
  required: boolean;
  status: 'met' | 'partial' | 'not_met' | 'unknown';
  reasoning: string;
  evidence: EvidenceItem[];
}

export interface RiskEvidence {
  path: string;
  startLine: number | null;
  endLine: number | null;
}

export interface AiVerificationRisk {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'error_handling' | 'secrets' | 'unaddressed_requirement' | 'security' | 'other';
  text: string;
  evidence: RiskEvidence[];
}

export interface AiVerificationReport {
  reportId: string;
  generatedAt: string;
  criteria: AiVerificationCriterion[];
  risks: AiVerificationRisk[];
}

export interface AiVerificationResponse {
  status: 'not_requested' | 'running' | 'ready' | 'failed' | 'unavailable';
  report: AiVerificationReport | null;
  error: { code: string; message: string } | null;
}

export interface ProjectPayment {
  state: PaymentState;
  amount: number;
  currency: 'INR';
  developerName: string;
}

// Re-export the public types from aiVerification as required
export type {
  SuspectedFile,
  BriefStep,
  AcceptanceCriterion,
  ConfirmedBrief,
  AiDeveloperBrief,
} from '../../types/aiVerification';
