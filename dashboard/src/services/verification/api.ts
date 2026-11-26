import { http } from '../../lib/http';
import { AutomatedRun, CheckLogResponse } from './types';
import { adaptAutomatedRun, adaptCheckLog } from './adapters';

export const verificationApi = {
  getAutomatedRun: async (submissionId: string): Promise<AutomatedRun | null> => {
    try {
      const raw = await http.get<any>(`/api/v1/submissions/${submissionId}/automated-run`);
      return adaptAutomatedRun(raw);
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  getCheckLog: async (
    submissionId: string,
    checkId: string,
    limit = 2000
  ): Promise<CheckLogResponse> => {
    const raw = await http.get<any>(
      `/api/v1/submissions/${submissionId}/automated-run/checks/${checkId}/log?limit=${limit}`
    );
    return adaptCheckLog(raw);
  },
};
