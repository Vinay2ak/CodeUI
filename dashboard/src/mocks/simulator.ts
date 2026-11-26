import { CbEvent, UserRole } from '../realtime/types';
import { initialProjects } from './data';

export function roleCanSeeEvent(role: UserRole, eventType: string): boolean {
  switch (eventType) {
    case 'project.posted':
      return role === 'owner' || role === 'admin';
    case 'user.registered':
      return role === 'admin';
    case 'project.status_changed':
      return role === 'owner' || role === 'admin';
    case 'payment.held':
      return role === 'owner' || role === 'admin';
    case 'payment.released':
      return role === 'owner' || role === 'freelancer' || role === 'admin';
    case 'task.assigned':
      return role === 'freelancer';
    case 'service.degraded':
      return role === 'admin';
    case 'submission.status_changed':
      return role === 'owner' || role === 'admin';
    default:
      return true;
  }
}

class EventSimulator {
  private timer: NodeJS.Timeout | number | null = null;
  private isRunning = false;
  private currentRole: UserRole = 'owner';
  private onEmitCallback: ((event: CbEvent) => void) | null = null;

  public setEmitCallback(callback: (event: CbEvent) => void) {
    this.onEmitCallback = callback;
  }

  public start(role: UserRole) {
    this.currentRole = role;
    this.isRunning = true;
    this.scheduleNext();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext() {
    if (!this.isRunning) return;

    // Random interval between 25 and 45 seconds
    const intervalMs = Math.floor(Math.random() * (45000 - 25000 + 1)) + 25000;

    this.timer = setTimeout(() => {
      if (!this.isRunning) return;
      this.emitRandomEvent();
      this.scheduleNext();
    }, intervalMs);
  }

  private emitRandomEvent() {
    const candidateTypes = [
      'user.registered',
      'project.status_changed',
      'payment.held',
      'payment.released',
      'task.assigned',
      'service.degraded',
    ].filter((t) => roleCanSeeEvent(this.currentRole, t));

    if (candidateTypes.length === 0) return;

    const chosenType = candidateTypes[Math.floor(Math.random() * candidateTypes.length)];
    const id = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const correlationId = `corr-${Math.random().toString(36).substring(2, 9)}`;
    const occurredAt = new Date().toISOString();

    const randomProj = initialProjects[Math.floor(Math.random() * initialProjects.length)];

    let event: CbEvent;

    switch (chosenType) {
      case 'user.registered':
        event = {
          id,
          type: chosenType,
          occurredAt,
          source: 'identity-service',
          correlationId,
          data: {
            userId: `usr-${Date.now().toString(36)}`,
            role: 'freelancer',
            displayName: 'Sarah Connor',
          },
        };
        break;

      case 'project.status_changed':
        event = {
          id,
          type: chosenType,
          occurredAt,
          source: 'project-service',
          correlationId,
          data: {
            projectId: randomProj.id,
            title: randomProj.title,
            from: 'in_progress',
            to: 'in_review',
          },
        };
        break;

      case 'payment.held':
        event = {
          id,
          type: chosenType,
          occurredAt,
          source: 'payment-service',
          correlationId,
          data: {
            paymentId: `pay-${Date.now().toString(36)}`,
            projectTitle: randomProj.title,
            amount: 500,
          },
        };
        break;

      case 'payment.released':
        event = {
          id,
          type: chosenType,
          occurredAt,
          source: 'payment-service',
          correlationId,
          data: {
            paymentId: `pay-${Date.now().toString(36)}`,
            projectTitle: randomProj.title,
            amount: 500,
          },
        };
        break;

      case 'task.assigned':
        event = {
          id,
          type: chosenType,
          occurredAt,
          source: 'workspace-service',
          correlationId,
          data: {
            taskId: `task-${Date.now().toString(36)}`,
            title: 'Verify edge test cases',
            projectTitle: randomProj.title,
          },
        };
        break;

      case 'service.degraded':
        event = {
          id,
          type: chosenType,
          occurredAt,
          source: 'health-service',
          correlationId,
          data: {
            service: 'ai',
            status: 'degraded',
          },
        };
        break;

      default:
        return;
    }

    if (this.onEmitCallback) {
      this.onEmitCallback(event);
    }
  }
}

export const simulator = new EventSimulator();

