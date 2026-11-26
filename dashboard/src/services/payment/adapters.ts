import { Payment, PaymentState, PaymentsSummary } from './types';

export function adaptPaymentState(rawState?: string): PaymentState {
  const s = (rawState || '').toLowerCase();
  if (s === 'held') return 'held';
  if (s === 'release_pending' || s === 'pending_release') return 'release_pending';
  if (s === 'released') return 'released';
  if (s === 'unrequested') return 'unrequested';
  if (s === 'refunded') return 'refunded';
  return 'authorized';
}

export function adaptProjectPayment(raw: any): import('./types').ProjectPayment {
  return {
    state: adaptPaymentState(raw?.state || raw?.status),
    amount: typeof raw?.amount === 'number' ? raw.amount : Number(raw?.amount) || 0,
    currency: 'INR',
    developerName: raw?.developerName || raw?.developer_name || raw?.freelancerName || 'Developer',
  };
}

export function adaptPayment(raw: any): Payment {
  return {
    id: raw?.id || '',
    projectTitle: raw?.projectTitle || raw?.project_title || 'Payment Milestone',
    amount: typeof raw?.amount === 'number' ? raw.amount : Number(raw?.amount) || 0,
    state: adaptPaymentState(raw?.state || raw?.status),
  };
}

export function adaptPaymentsSummary(raw: any): PaymentsSummary {
  if (!raw) {
    return {
      currency: 'USD',
      authorized: 0,
      held: 0,
      pendingRelease: 0,
      released: 0,
      releasedThisMonth: 0,
      items: [],
    };
  }

  const items = Array.isArray(raw.items) ? raw.items.map(adaptPayment) : [];

  return {
    currency: raw.currency || 'USD',
    authorized: Number(raw.authorized ?? raw.total_spent ?? 0),
    held: Number(raw.held ?? raw.total_escrow ?? 0),
    pendingRelease: Number(raw.pendingRelease ?? raw.pending_release ?? 0),
    released: Number(raw.released ?? raw.released_amount ?? 0),
    releasedThisMonth: Number(raw.releasedThisMonth ?? raw.released_this_month ?? raw.released ?? 0),
    items,
  };
}
