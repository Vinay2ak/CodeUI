import type {
  SuspectedFile,
  BriefStep,
  AcceptanceCriterion,
  AiDeveloperBrief,
  ConfirmedBrief,
} from '../../types/aiVerification';

export type {
  SuspectedFile,
  BriefStep,
  AcceptanceCriterion,
  AiDeveloperBrief,
  ConfirmedBrief,
};

export interface RepoInfo {
  fullName: string;
  defaultBranch: string;
  headCommitSha: string;
  private: boolean;
  access: 'read-only';
}

export interface RepoStatusResponse {
  status: 'not_connected' | 'pending' | 'connected' | 'error' | 'revoked';
  repo: RepoInfo | null;
  authorizeUrl?: string | null;
  error: {
    code: 'REPO_NOT_FOUND' | 'ACCESS_DENIED' | 'GITHUB_UNAVAILABLE' | string;
    message: string;
  } | null;
}

export type AiBriefJobStage = 'fetching_tree' | 'selecting_files' | 'structuring_brief' | null;
export type AiBriefJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AiBriefJobError {
  code: 'AI_TIMEOUT' | 'REPO_TOO_LARGE' | 'AI_UNAVAILABLE' | 'UNKNOWN' | string;
  message: string;
  correlationId?: string;
}

export interface AiBriefJob {
  jobId: string;
  status: AiBriefJobStatus;
  stage: AiBriefJobStage;
  startedAt: string;
  error: AiBriefJobError | null;
  brief: AiDeveloperBrief | null;
}

export interface ProjectSnapshot {
  title: string;
  description: string;
  stacks: string[];
  specialties: string[];
  budget: number;
  repoFullName: string;
  headCommitSha: string;
  verificationMode: string;
}

export type AiFlowPhase =
  | 'idle'
  | 'saving_draft'
  | 'connecting_repo'
  | 'analyzing'
  | 'brief_ready'
  | 'stale'
  | 'publishing'
  | 'published'
  | 'error';

export interface AiFlowError {
  where: 'draft' | 'github' | 'analysis' | 'publish';
  code: string;
  message: string;
  correlationId?: string;
}
