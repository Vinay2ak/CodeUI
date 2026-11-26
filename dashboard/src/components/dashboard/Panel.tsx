import React from 'react';
import { RefreshCw, AlertCircle, Database } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ErrorBoundary } from '../../app/ErrorBoundary';
import { ApiError } from '../../lib/errors';

export interface PanelProps {
  id: string;
  title: string;
  serviceName: string;
  updatedAt?: string | Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isLoading?: boolean;
  error?: Error | ApiError | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const PanelContent: React.FC<PanelProps> = ({
  id,
  title,
  serviceName,
  updatedAt,
  onRefresh,
  isRefreshing = false,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'No data available',
  actions,
  children,
  className = '',
}) => {
  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const correlationId =
    (error as ApiError)?.correlationId || (error as any)?.correlation_id;

  return (
    <Card
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`rounded-2xl bg-card border-border shadow-sm flex flex-col overflow-hidden ${className}`}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-6 py-4 space-y-0 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <CardTitle
            id={`${id}-heading`}
            className="text-base font-semibold text-foreground"
          >
            {title}
          </CardTitle>
          <Badge
            variant="secondary"
            className="font-normal text-[11px] text-muted-foreground border-border"
          >
            {serviceName}
          </Badge>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {actions}
          {formattedTime && (
            <span className="text-xs text-muted-foreground hidden md:inline font-mono tabular-nums">
              Updated {formattedTime}
            </span>
          )}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading || isRefreshing}
              aria-label={`Refresh ${title}`}
              className="text-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? 'animate-spin text-accent' : ''
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 flex-1 flex flex-col justify-center min-h-[160px]">
        {isLoading ? (
          <div className="space-y-3 py-2" role="status" aria-label="Loading panel content">
            <Skeleton height={24} width="40%" />
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center text-center p-6 gap-3 rounded-xl bg-secondary/40 border border-danger/30"
          >
            <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {error.message || 'Failed to load panel data'}
              </p>
              {correlationId && (
                <p className="font-mono text-xs text-muted-foreground mt-1 select-all">
                  Reference: {correlationId}
                </p>
              )}
            </div>
            {onRefresh && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRefresh}
                className="mt-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <Database className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
};

export const Panel: React.FC<PanelProps> = (props) => {
  return (
    <ErrorBoundary fallbackTitle={`${props.title} Error`} onReset={props.onRefresh}>
      <PanelContent {...props} />
    </ErrorBoundary>
  );
};
