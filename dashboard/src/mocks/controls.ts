import { CbEvent, UserRole } from '../realtime/types';
import { initialProjects } from './data';

export interface MockState {
  tokenGen: number;
  isSuspended: boolean;
  failingServices: Record<string, boolean>;
  failMatching: boolean;
  matchingDelayMs: number;
  briefScenario: 'ok' | 'slow' | 'fail';
  briefDelayMs: number;
  reviewScenario: 'pass' | 'mixed' | 'fail';
  failNextRelease: boolean;
  failAiVerification: boolean;
}

export const mockState: MockState = {
  tokenGen: 1,
  isSuspended: false,
  failingServices: {
    project: false,
    talent: false,
    payment: false,
    workspace: false,
    admin: false,
    notification: false,
    github: false,
    codeContext: false,
    verification: false,
    review: false,
  },
  failMatching: false,
  matchingDelayMs: 0,
  briefScenario: 'ok',
  briefDelayMs: 0,
  reviewScenario: 'mixed',
  failNextRelease: false,
  failAiVerification: false,
};

const listeners = new Set<() => void>();

function notifyControlsChanged() {
  listeners.forEach((l) => l());
}

export function subscribeMockControls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function expireToken(): void {
  mockState.tokenGen++;
  notifyControlsChanged();
}

export function setSuspended(suspended: boolean): void {
  mockState.isSuspended = suspended;
  notifyControlsChanged();
}

export function setServiceFailing(service: string, failing: boolean): void {
  mockState.failingServices[service] = failing;
  notifyControlsChanged();
}

export function isServiceFailing(service: string): boolean {
  return !!mockState.failingServices[service];
}

export function setFailMatching(fail: boolean): void {
  mockState.failMatching = fail;
  notifyControlsChanged();
}

export function setMatchingDelay(delayMs: number): void {
  mockState.matchingDelayMs = Math.max(0, delayMs);
  notifyControlsChanged();
}

export function setBriefScenario(scenario: 'ok' | 'slow' | 'fail'): void {
  mockState.briefScenario = scenario;
  notifyControlsChanged();
}

export function setBriefDelay(ms: number): void {
  mockState.briefDelayMs = Math.max(0, ms);
  notifyControlsChanged();
}

export function setReviewScenario(scenario: 'pass' | 'mixed' | 'fail'): void {
  mockState.reviewScenario = scenario;
  notifyControlsChanged();
}

export function triggerFailNextRelease(): void {
  mockState.failNextRelease = true;
  notifyControlsChanged();
}

export function setFailAiVerification(fail = true): void {
  mockState.failAiVerification = fail;
  notifyControlsChanged();
}

export function resetReview(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('mock.review.v1');
  }
  mockState.reviewScenario = 'mixed';
  mockState.failNextRelease = false;
  mockState.failAiVerification = false;
  notifyControlsChanged();
}

let dropConnectionHandler: ((ms: number) => void) | null = null;
let emitEventHandler: ((event: CbEvent) => void) | null = null;

export function registerTransportHandlers(
  onDrop: (ms: number) => void,
  onEmit: (event: CbEvent) => void
) {
  dropConnectionHandler = onDrop;
  emitEventHandler = onEmit;
}

export function dropConnection(ms = 5000): void {
  if (dropConnectionHandler) {
    dropConnectionHandler(ms);
  }
}

export function emitTestEvent(type: string, data?: Record<string, unknown>): void {
  const id = `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const correlationId = `corr-${Math.random().toString(36).substring(2, 9)}`;
  const occurredAt = new Date().toISOString();

  let event: CbEvent;

  switch (type) {
    case 'project.posted':
      event = {
        id,
        type: 'project.posted',
        occurredAt,
        source: 'project-service',
        correlationId,
        data: data ?? {
          projectId: 'p-1',
          title: 'New project posted',
          budget: 5000,
        },
      };
      break;

    case 'user.registered':
      event = {
        id,
        type,
        occurredAt,
        source: 'identity-service',
        correlationId,
        data: data ?? {
          userId: `usr-${Date.now().toString(36)}`,
          role: 'freelancer' as UserRole,
          displayName: 'New Freelancer',
        },
      };
      break;

    case 'project.status_changed':
      event = {
        id,
        type,
        occurredAt,
        source: 'project-service',
        correlationId,
        data: data ?? {
          projectId: initialProjects[0].id,
          title: initialProjects[0].title,
          from: 'in_progress',
          to: 'in_review',
        },
      };
      break;

    case 'payment.held':
      event = {
        id,
        type,
        occurredAt,
        source: 'payment-service',
        correlationId,
        data: data ?? {
          paymentId: `pay-${Date.now().toString(36)}`,
          projectTitle: initialProjects[0].title,
          amount: 600,
        },
      };
      break;

    case 'payment.released':
      event = {
        id,
        type,
        occurredAt,
        source: 'payment-service',
        correlationId,
        data: data ?? {
          paymentId: `pay-${Date.now().toString(36)}`,
          projectTitle: initialProjects[2].title,
          amount: 450,
        },
      };
      break;

    case 'task.assigned':
      event = {
        id,
        type,
        occurredAt,
        source: 'workspace-service',
        correlationId,
        data: data ?? {
          taskId: `task-${Date.now().toString(36)}`,
          title: 'Code review and unit verification',
          projectTitle: initialProjects[1].title,
        },
      };
      break;

    case 'service.degraded':
      event = {
        id,
        type,
        occurredAt,
        source: 'health-service',
        correlationId,
        data: data ?? {
          service: 'ai',
          status: 'degraded',
        },
      };
      break;

    case 'submission.status_changed':
      event = {
        id,
        type: 'submission.status_changed',
        occurredAt,
        source: 'review-service',
        correlationId,
        data: data ?? {
          projectId: 'proj-1',
          submissionId: 'sub-webhook-2026',
          status: 'in_review',
          projectTitle: initialProjects[0]?.title || 'Fix duplicate payment webhook retries',
        },
      };
      break;

    default:
      event = {
        id,
        type,
        occurredAt,
        source: 'system',
        correlationId,
        data: data ?? {},
      };
  }

  if (emitEventHandler) {
    emitEventHandler(event);
  } else if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel('cb-events');
    bc.postMessage(event);
    bc.close();
  }
}

// Global console helper
if (typeof window !== 'undefined') {
  (window as any).__cbMock = {
    serviceDown: (service: string, down = true) => setServiceFailing(service, down),
    failMatching: (fail = true) => setFailMatching(fail),
    setMatchingDelay: (ms: number) => setMatchingDelay(ms),
    setBriefScenario: (scenario: 'ok' | 'slow' | 'fail') => setBriefScenario(scenario),
    setBriefDelay: (ms: number) => setBriefDelay(ms),
    setReviewScenario: (scenario: 'pass' | 'mixed' | 'fail') => setReviewScenario(scenario),
    failNextRelease: () => triggerFailNextRelease(),
    failAiVerification: (fail = true) => setFailAiVerification(fail),
    resetReview,
    emitEvent: emitTestEvent,
    expireToken,
    setSuspended,
  };
}
