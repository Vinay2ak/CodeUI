import { CbEvent, ProjectStatusChangedData, PaymentHeldData, PaymentReleasedData, TaskAssignedData, ServiceDegradedData, UserRegisteredData } from './types';
import { formatMoney } from '../lib/format';

export function formatEventSentence(event: CbEvent): string {
  switch (event.type) {
    case 'project.posted': {
      const data = event.data as any;
      return `New project posted: ${data.title} (${formatMoney(data.budget || 0)})`;
    }
    case 'user.registered': {
      const data = event.data as UserRegisteredData;
      return `New ${data.role} joined: ${data.displayName}`;
    }
    case 'project.status_changed': {
      const data = event.data as ProjectStatusChangedData;
      const statusLabels: Record<string, string> = {
        draft: 'Draft',
        in_progress: 'In progress',
        in_review: 'In review',
        completed: 'Completed',
      };
      const formattedTo = statusLabels[data.to] || data.to;
      return `${data.title} moved to ${formattedTo}`;
    }
    case 'payment.held': {
      const data = event.data as PaymentHeldData;
      return `${formatMoney(data.amount)} held in escrow for ${data.projectTitle}`;
    }
    case 'payment.released': {
      const data = event.data as PaymentReleasedData;
      return `${formatMoney(data.amount)} released for ${data.projectTitle}`;
    }
    case 'task.assigned': {
      const data = event.data as TaskAssignedData;
      return `Task "${data.title}" assigned in ${data.projectTitle}`;
    }
    case 'service.degraded': {
      const data = event.data as ServiceDegradedData;
      return `Service ${data.service} is ${data.status}`;
    }
    case 'submission.status_changed': {
      const data = event.data as any;
      if (data?.status === 'in_review') {
        const title = data.projectTitle || data.title || 'Project';
        return `Submission ready for review: “${title}”`;
      }
      return `Submission ${data?.status || 'updated'}`;
    }
    default:
      return `${event.type}: ${JSON.stringify(event.data)}`;
  }
}

