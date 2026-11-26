import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  RefreshCw,
  Lock,
  BadgeCheck,
  FileCode,
  AlertTriangle,
  Bell,
  Inbox,
} from 'lucide-react';
import { useEventStore } from '../../realtime/store';
import { formatEventSentence } from '../../realtime/formatEvent';
import { formatRelativeTime } from '../../lib/format';
import { CbEvent } from '../../realtime/types';

function getEventIcon(type: string) {
  switch (type) {
    case 'user.registered':
      return <UserPlus className="w-4 h-4 text-accent" />;
    case 'project.status_changed':
      return <RefreshCw className="w-4 h-4 text-accent" />;
    case 'payment.held':
      return <Lock className="w-4 h-4 text-money" />;
    case 'payment.released':
      return <BadgeCheck className="w-4 h-4 text-money" />;
    case 'task.assigned':
      return <FileCode className="w-4 h-4 text-accent" />;
    case 'service.degraded':
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

export interface ActivityFeedProps {
  onEventClick?: (event: CbEvent) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ onEventClick }) => {
  const { events } = useEventStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (events.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
        <Inbox className="w-8 h-8 opacity-40" />
        <p className="text-sm font-medium">Waiting for events…</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul role="list" className="divide-y divide-border/70">
        {events.map((event: CbEvent) => {
          return (
            <li
              key={event.id}
              onClick={onEventClick ? () => onEventClick(event) : undefined}
              className={`py-3.5 px-3 sm:px-4 flex items-start gap-3.5 hover:bg-secondary/45 transition-colors rounded-xl ${
                onEventClick ? 'cursor-pointer' : ''
              }`}
            >
              <div className="mt-0.5 p-2 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {formatEventSentence(event)}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono text-[11px] bg-secondary px-2 py-0.5 rounded-full border border-border">
                    {event.source}
                  </span>
                  <span>•</span>
                  <span className="font-mono tabular-nums">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
