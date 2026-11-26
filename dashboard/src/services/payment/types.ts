export type PaymentState =
  | 'unrequested'
  | 'authorized'
  | 'held'
  | 'release_pending'
  | 'released'
  | 'refunded';

export interface Payment {
  id: string;
  projectTitle: string;
  amount: number;
  state: PaymentState;
}

export interface ProjectPayment {
  state: PaymentState;
  amount: number;
  currency: 'INR';
  developerName: string;
}

export interface PaymentsSummary {
  currency: string;
  authorized: number;
  held: number;
  pendingRelease: number;
  released: number;
  releasedThisMonth: number;
  items: Payment[];
}

