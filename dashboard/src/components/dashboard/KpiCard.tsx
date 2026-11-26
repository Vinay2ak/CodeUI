import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'money';
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}) => {
  return (
    <Card
      className={`rounded-2xl border-border bg-card shadow-sm flex flex-col justify-between transition-colors ${className}`}
    >
      <CardHeader className="relative p-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-xs font-medium text-muted-foreground">
            {label}
          </CardDescription>
          {icon && (
            <div
              className={`p-2 rounded-xl border ${
                tone === 'money'
                  ? 'bg-money/10 text-money border-money/25'
                  : 'bg-secondary text-foreground border-border'
              }`}
            >
              {icon}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 pt-2" role="status" aria-label={`Loading ${label}`}>
            <Skeleton height={30} width="60%" className="rounded-lg" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-center justify-between text-danger pt-2 gap-2"
          >
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Failed to load</span>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={`Retry loading ${label}`}
                className="text-xs text-foreground underline hover:text-accent cursor-pointer p-1"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <CardTitle
            className={`pt-1.5 text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums ${
              tone === 'money' ? 'text-money' : 'text-foreground'
            }`}
          >
            {value}
          </CardTitle>
        )}
      </CardHeader>

      {hint && !error && (
        <CardFooter className="p-5 pt-1 text-xs text-muted-foreground">
          {isLoading ? (
            <Skeleton height={14} width="45%" className="rounded-md" />
          ) : (
            <span className="truncate">{hint}</span>
          )}
        </CardFooter>
      )}
    </Card>
  );
};
