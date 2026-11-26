import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useEventStore, eventStore } from '../../realtime/store';
import { formatEventSentence } from '../../realtime/formatEvent';
import { formatRelativeTime } from '../../lib/format';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export const NotificationBell: React.FC = () => {
  const { events, unreadCount } = useEventStore();
  const latestEvents = events.slice(0, 10);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Notifications (${unreadCount} unread)`}
          className="relative h-9 w-9 rounded-xl border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-[0.98]"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground font-mono tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 rounded-2xl bg-popover border-border p-3 shadow-lg"
      >
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => eventStore.markAllRead()}
              className="text-xs font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5">
          {latestEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            latestEvents.map((event) => (
              <div
                key={event.id}
                className="p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-xs"
              >
                <p className="font-medium text-foreground leading-snug">
                  {formatEventSentence(event)}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">{event.source}</span>
                  <span className="font-mono tabular-nums">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
