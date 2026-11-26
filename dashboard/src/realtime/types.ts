export type UserRole = 'owner' | 'freelancer' | 'admin';

export interface UserRegisteredData {
  userId: string;
  role: UserRole;
  displayName: string;
}

export interface ProjectPostedData {
  projectId: string;
  title: string;
  budget: number;
}

export interface ProjectStatusChangedData {
  projectId: string;
  title: string;
  from: 'draft' | 'in_progress' | 'in_review' | 'completed';
  to: 'draft' | 'in_progress' | 'in_review' | 'completed';
}

export interface PaymentHeldData {
  paymentId: string;
  projectTitle: string;
  amount: number;
}

export interface PaymentReleasedData {
  paymentId: string;
  projectTitle: string;
  amount: number;
}

export interface TaskAssignedData {
  taskId: string;
  title: string;
  projectTitle: string;
}

export interface ServiceDegradedData {
  service: string;
  status: 'up' | 'degraded' | 'down';
}

export interface SubmissionStatusChangedData {
  projectId: string;
  submissionId: string;
  status: 'none' | 'in_review' | 'changes_requested' | 'approved';
  title?: string;
  projectTitle?: string;
  feedback?: string | null;
  flaggedItems?: string[];
}

export type CbEventData =
  | ProjectPostedData
  | UserRegisteredData
  | ProjectStatusChangedData
  | PaymentHeldData
  | PaymentReleasedData
  | TaskAssignedData
  | ServiceDegradedData
  | SubmissionStatusChangedData
  | Record<string, unknown>;

export interface CbEvent<T = CbEventData> {
  id: string;
  type:
    | 'project.posted'
    | 'user.registered'
    | 'project.status_changed'
    | 'payment.held'
    | 'payment.released'
    | 'task.assigned'
    | 'service.degraded'
    | 'submission.status_changed'
    | string;
  occurredAt: string;
  source: string;
  correlationId: string;
  data: T;
}

export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

