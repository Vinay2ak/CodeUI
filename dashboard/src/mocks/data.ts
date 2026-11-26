import { CbEvent } from '../realtime/types';
import { ProjectStatus } from '../services/project/types';

export interface Project {
  id: string;
  title: string;
  repo: string;
  freelancerName: string | null;
  status: ProjectStatus;
  budget: number;
  updatedAt: string;
}

export interface Payment {
  id: string;
  projectTitle: string;
  amount: number;
  state: 'authorized' | 'held' | 'release_pending' | 'released' | 'unrequested' | 'refunded';
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

export interface Task {
  id: string;
  title: string;
  projectTitle: string;
  status: 'open' | 'in_progress' | 'in_review' | 'verified';
  dueAt: string;
  reward: number;
}

export interface UserRow {
  id: string;
  displayName: string;
  role: 'owner' | 'freelancer' | 'admin';
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'degraded' | 'down';
  latencyMs: number;
}

export const initialProjects: Project[] = [
  {
    id: 'proj-1',
    title: 'Fix duplicate payment webhook retries',
    repo: 'acme/payments-api',
    freelancerName: 'Ravi Freelancer',
    status: 'in_review',
    budget: 4500,
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'proj-2',
    title: 'Migrate auth to OAuth',
    repo: 'acme/auth-service',
    freelancerName: 'Elena Rostova',
    status: 'in_review',
    budget: 1800,
    updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'proj-3',
    title: 'Fix flaky CI tests',
    repo: 'acme/core-runner',
    freelancerName: 'Marcus Vance',
    status: 'completed',
    budget: 450,
    updatedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
  },
  {
    id: 'proj-4',
    title: 'Add CSV export',
    repo: 'acme/export-worker',
    freelancerName: null,
    status: 'draft',
    budget: 350,
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'proj-5',
    title: 'Dockerize the API',
    repo: 'acme/gateway',
    freelancerName: 'Ravi Freelancer',
    status: 'in_progress',
    budget: 800,
    updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  },
  {
    id: 'proj-6',
    title: 'Rate limiter bug',
    repo: 'acme/traffic-guard',
    freelancerName: null,
    status: 'draft',
    budget: 200,
    updatedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
];

export const initialPayments: Payment[] = [
  {
    id: 'pay-1',
    projectTitle: 'Payments webhook retries',
    amount: 1200,
    state: 'held',
  },
  {
    id: 'pay-2',
    projectTitle: 'Migrate auth to OAuth',
    amount: 1800,
    state: 'release_pending',
  },
  {
    id: 'pay-3',
    projectTitle: 'Fix flaky CI tests',
    amount: 450,
    state: 'released',
  },
  {
    id: 'pay-4',
    projectTitle: 'Dockerize the API',
    amount: 800,
    state: 'held',
  },
  {
    id: 'pay-5',
    projectTitle: 'Add CSV export',
    amount: 350,
    state: 'authorized',
  },
  {
    id: 'pay-6',
    projectTitle: 'Rate limiter bug',
    amount: 200,
    state: 'authorized',
  },
];

export function getPaymentsSummary(): PaymentsSummary {
  let authorized = 0;
  let held = 0;
  let pendingRelease = 0;
  let released = 0;

  for (const p of initialPayments) {
    if (p.state === 'authorized') authorized += p.amount;
    else if (p.state === 'held') held += p.amount;
    else if (p.state === 'release_pending') pendingRelease += p.amount;
    else if (p.state === 'released') released += p.amount;
  }

  return {
    currency: 'USD',
    authorized,
    held,
    pendingRelease,
    released,
    releasedThisMonth: released, // 450
    items: initialPayments,
  };
}

export const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Fix duplicate payment webhook retries',
    projectTitle: 'Payments webhook retries',
    status: 'in_progress',
    dueAt: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
    reward: 600,
  },
  {
    id: 'task-2',
    title: 'Add CSV export to the reports page',
    projectTitle: 'Add CSV export',
    status: 'in_review',
    dueAt: new Date(Date.now() + 1 * 86400 * 1000).toISOString(),
    reward: 600,
  },
  {
    id: 'task-3',
    title: 'Fix flaky CI tests',
    projectTitle: 'Fix flaky CI tests',
    status: 'verified',
    dueAt: new Date(Date.now() + 4 * 86400 * 1000).toISOString(),
    reward: 400,
  },
  {
    id: 'task-4',
    title: 'Health check and non-root user configuration',
    projectTitle: 'Dockerize the API',
    status: 'open',
    dueAt: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
    reward: 400,
  },
  {
    id: 'task-5',
    title: 'Isolate race condition in test suite',
    projectTitle: 'Fix flaky CI tests',
    status: 'verified',
    dueAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
    reward: 450,
  },
];

export const initialAdminUsers: UserRow[] = [
  {
    id: 'user-owner-1',
    displayName: 'Asha Owner',
    role: 'owner',
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-freelancer-1',
    displayName: 'Ravi Freelancer',
    role: 'freelancer',
    status: 'active',
    createdAt: new Date(Date.now() - 25 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-admin-1',
    displayName: 'Admin User',
    role: 'admin',
    status: 'active',
    createdAt: new Date(Date.now() - 90 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-freelancer-2',
    displayName: 'Elena Rostova',
    role: 'freelancer',
    status: 'active',
    createdAt: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-freelancer-3',
    displayName: 'Marcus Vance',
    role: 'freelancer',
    status: 'active',
    createdAt: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-owner-2',
    displayName: 'Carlos Mendez',
    role: 'owner',
    status: 'active',
    createdAt: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-owner-3',
    displayName: 'Sophia Lin',
    role: 'owner',
    status: 'active',
    createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
  {
    id: 'user-freelancer-4',
    displayName: 'Devon Lee',
    role: 'freelancer',
    status: 'suspended',
    createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  },
];

export const initialServicesHealth: ServiceHealth[] = [
  { name: 'identity', status: 'up', latencyMs: 24 },
  { name: 'project', status: 'up', latencyMs: 38 },
  { name: 'github', status: 'up', latencyMs: 145 },
  { name: 'workspace', status: 'up', latencyMs: 42 },
  { name: 'submission', status: 'up', latencyMs: 51 },
  { name: 'payment', status: 'up', latencyMs: 65 },
  { name: 'ai', status: 'degraded', latencyMs: 900 },
  { name: 'talent', status: 'up', latencyMs: 32 },
  { name: 'notification', status: 'up', latencyMs: 19 },
  { name: 'admin', status: 'up', latencyMs: 28 },
];

export const initialNotifications: CbEvent[] = [
  {
    id: 'notif-1',
    type: 'payment.released',
    occurredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    source: 'payment-service',
    correlationId: 'corr-seed-1',
    data: {
      paymentId: 'pay-3',
      projectTitle: 'Fix flaky CI tests',
      amount: 450,
    },
  },
  {
    id: 'notif-2',
    type: 'project.status_changed',
    occurredAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    source: 'project-service',
    correlationId: 'corr-seed-2',
    data: {
      projectId: 'proj-2',
      title: 'Migrate auth to OAuth',
      from: 'in_progress',
      to: 'in_review',
    },
  },
  {
    id: 'notif-3',
    type: 'payment.held',
    occurredAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    source: 'payment-service',
    correlationId: 'corr-seed-3',
    data: {
      paymentId: 'pay-1',
      projectTitle: 'Payments webhook retries',
      amount: 1200,
    },
  },
  {
    id: 'notif-4',
    type: 'task.assigned',
    occurredAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    source: 'workspace-service',
    correlationId: 'corr-seed-4',
    data: {
      taskId: 'task-1',
      title: 'Implement retry exponential backoff loop',
      projectTitle: 'Payments webhook retries',
    },
  },
  {
    id: 'notif-5',
    type: 'user.registered',
    occurredAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    source: 'identity-service',
    correlationId: 'corr-seed-5',
    data: {
      userId: 'user-freelancer-1',
      role: 'freelancer',
      displayName: 'Ravi Freelancer',
    },
  },
  {
    id: 'notif-6',
    type: 'service.degraded',
    occurredAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    source: 'health-service',
    correlationId: 'corr-seed-6',
    data: {
      service: 'ai',
      status: 'degraded',
    },
  },
];

