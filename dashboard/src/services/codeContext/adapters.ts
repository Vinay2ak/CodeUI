import type { AiBriefJob, StartBriefJobResponse } from './types';
import { keysToCamel, adaptAiBrief } from '../../features/ai-brief/adapters';

export function adaptStartBriefJobResponse(raw: unknown): StartBriefJobResponse {
  const camel = keysToCamel(raw) as StartBriefJobResponse;
  return {
    jobId: camel.jobId,
  };
}

export function adaptAiBriefJob(raw: unknown): AiBriefJob {
  const camel = keysToCamel(raw) as any;
  let brief = null;
  if (camel.brief) {
    brief = adaptAiBrief(camel.brief);
  }
  return {
    jobId: camel.jobId,
    status: camel.status,
    stage: camel.stage ?? null,
    startedAt: camel.startedAt || new Date().toISOString(),
    error: camel.error || null,
    brief,
  };
}
