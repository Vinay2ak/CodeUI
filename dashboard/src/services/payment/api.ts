import { http } from '../../lib/http';
import { PaymentsSummary, ProjectPayment } from './types';
import { adaptPaymentsSummary, adaptProjectPayment } from './adapters';

export const paymentApi = {
  getSummary: async (): Promise<PaymentsSummary> => {
    let raw: any = null;
    try {
      raw = await http.get<any>('/api/v1/payment/summary');
    } catch {
      try {
        raw = await http.get<any>('/api/v1/payments/summary');
      } catch {
        raw = null;
      }
    }

    return adaptPaymentsSummary(raw);
  },

  getProjectPayment: async (projectId: string): Promise<ProjectPayment> => {
    const raw = await http.get<any>(`/api/v1/projects/${projectId}/payment`);
    return adaptProjectPayment(raw);
  },

  releasePayment: async (
    projectId: string,
    idempotencyKey?: string
  ): Promise<{ state: 'released' }> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const res = await http.post<{ state: 'released' }>(
      `/api/v1/projects/${projectId}/payment/release`,
      {},
      { headers }
    );
    return res;
  },
};
