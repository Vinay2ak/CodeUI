export interface SuspectedFile {
  path: string;
  startLine: number | null;
  endLine: number | null;
  reason: string;
  verified: boolean | null;
}

export interface BriefStep {
  id: string;
  text: string;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  required: boolean;
  source: 'ai' | 'owner';
}

export interface AiDeveloperBrief {
  briefId: string;
  generatedAt: string;
  repoCommitSha: string;
  problemSummary: string;
  suspectedFiles: SuspectedFile[];
  rootCauseHypothesis: string;
  stepByStepPlan: BriefStep[];
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface ConfirmedBrief extends AiDeveloperBrief {
  inputsHash: string;
  confirmedAt: string;
}

export type { DockerTestResult, AiVerificationReport } from '../features/review/types';

