import type { AiBriefJob, AiBriefJobStage, AiBriefJobStatus } from '../../features/ai-brief/types';

export type { AiBriefJob, AiBriefJobStage, AiBriefJobStatus };

export interface StartBriefJobResponse {
  jobId: string;
}
