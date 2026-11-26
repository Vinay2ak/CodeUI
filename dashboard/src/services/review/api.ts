import { http } from '../../lib/http';
import { CurrentSubmission, ReviewDecisionPayload, AiVerificationResponse, SubmissionStatus } from './types';
import { adaptCurrentSubmission, adaptAiVerification } from './adapters';

export const reviewApi = {
  getCurrentSubmission: async (projectId: string): Promise<CurrentSubmission> => {
    const raw = await http.get<any>(`/api/v1/projects/${projectId}/submissions/current`);
    return adaptCurrentSubmission(raw);
  },

  decide: async (
    projectId: string,
    payload: ReviewDecisionPayload,
    idempotencyKey?: string
  ): Promise<{ submissionId: string; status: SubmissionStatus }> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await http.post<{ submissionId: string; status: SubmissionStatus }>(
      `/api/v1/projects/${projectId}/review`,
      payload,
      { headers }
    );
    return res;
  },

  getAiVerification: async (submissionId: string): Promise<AiVerificationResponse> => {
    const raw = await http.get<any>(`/api/v1/submissions/${submissionId}/ai-verification`);
    return adaptAiVerification(raw);
  },

  requestAiVerification: async (
    submissionId: string,
    idempotencyKey?: string
  ): Promise<void> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    await http.post<void>(
      `/api/v1/submissions/${submissionId}/ai-verification`,
      {},
      { headers }
    );
  },
};
