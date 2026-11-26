import { http } from '../../lib/http';
import type { AiBriefJob, StartBriefJobResponse } from './types';
import { adaptStartBriefJobResponse, adaptAiBriefJob } from './adapters';

export const codeContextApi = {
  startBriefJob: async (
    projectId: string,
    inputsHash: string,
    idempotencyKey?: string
  ): Promise<StartBriefJobResponse> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const res = await http.post<any>(
      `/api/v1/projects/${projectId}/ai-brief/jobs`,
      { inputsHash },
      { headers }
    );
    return adaptStartBriefJobResponse(res);
  },

  getBriefJob: async (projectId: string, jobId: string): Promise<AiBriefJob> => {
    const res = await http.get<any>(`/api/v1/projects/${projectId}/ai-brief/jobs/${jobId}`);
    return adaptAiBriefJob(res);
  },

  cancelBriefJob: async (projectId: string, jobId: string): Promise<void> => {
    await http.post(`/api/v1/projects/${projectId}/ai-brief/jobs/${jobId}/cancel`, {});
  },
};

export const startBriefJob = codeContextApi.startBriefJob;
export const getBriefJob = codeContextApi.getBriefJob;
export const cancelBriefJob = codeContextApi.cancelBriefJob;
