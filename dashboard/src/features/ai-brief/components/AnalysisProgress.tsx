import React, { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle2, CircleDashed, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import type { AiBriefJob, AiBriefJobStage, AiFlowError } from '../types';
import { Button } from '../../../components/ui/button';
import { env } from '../../../lib/env';

export interface AnalysisProgressProps {
  job: AiBriefJob | null;
  onCancel: () => void;
  onRetry: () => void;
  error: AiFlowError | null;
}

const STAGES: { key: NonNullable<AiBriefJobStage>; label: string }[] = [
  { key: 'fetching_tree', label: 'Fetching read-only repository tree' },
  { key: 'selecting_files', label: 'Selecting relevant source files' },
  { key: 'structuring_brief', label: 'Structuring developer task brief' },
];

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  job,
  onCancel,
  onRetry,
  error,
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [dismissTimeoutAlert, setDismissTimeoutAlert] = useState(false);
  const announcedStages = useRef(new Set<string>());

  useEffect(() => {
    setElapsed(0);
    setDismissTimeoutAlert(false);
    announcedStages.current.clear();
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [job?.jobId]);

  const currentStage = job?.stage;
  const isQueued = job?.status === 'queued';
  const isFailed = job?.status === 'failed' || (error && error.where === 'analysis');

  useEffect(() => {
    if (currentStage && !announcedStages.current.has(currentStage)) {
      announcedStages.current.add(currentStage);
    }
  }, [currentStage]);

  const stageOrder = ['fetching_tree', 'selecting_files', 'structuring_brief'];
  const currentIndex = currentStage ? stageOrder.indexOf(currentStage) : -1;

  const getErrorCodeMessage = (code?: string) => {
    switch (code) {
      case 'AI_TIMEOUT':
        return 'The analysis timed out.';
      case 'REPO_TOO_LARGE':
        return 'This repository is too large to analyze.';
      case 'AI_UNAVAILABLE':
        return 'The AI service is unavailable right now.';
      default:
        return error?.message || job?.error?.message || 'Something went wrong.';
    }
  };

  const correlationId = error?.correlationId || job?.error?.correlationId;

  return (
    <div
      role="status"
      aria-live="polite"
      className="p-4 rounded-lg bg-surface border border-border space-y-4"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-text">
            {isFailed ? 'Analysis Failed' : 'Analyzing repository…'}
          </div>
          <div className="text-xs text-text-muted flex items-center gap-2">
            {isQueued && <span>Waiting to start…</span>}
            <span>Elapsed: {elapsed}s</span>
            {env.VITE_USE_MOCKS && (
              <>
                <span>&bull;</span>
                <span className="italic">Simulated analysis</span>
              </>
            )}
          </div>
        </div>

        {!isFailed && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
        )}
      </div>

      {/* 3-Stage List */}
      <div className="space-y-3">
        {STAGES.map((s, idx) => {
          let state: 'done' | 'active' | 'pending' | 'failed' = 'pending';

          if (isFailed) {
            if (idx === currentIndex || (currentIndex === -1 && idx === 0)) {
              state = 'failed';
            } else if (idx < currentIndex) {
              state = 'done';
            } else {
              state = 'pending';
            }
          } else {
            if (currentIndex === -1) {
              state = idx === 0 ? 'active' : 'pending';
            } else if (idx < currentIndex) {
              state = 'done';
            } else if (idx === currentIndex) {
              state = 'active';
            } else {
              state = 'pending';
            }
          }

          return (
            <div key={s.key} className="flex items-center gap-3 text-xs">
              {state === 'done' && (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" strokeWidth={1.5} />
              )}
              {state === 'active' && (
                <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin" strokeWidth={1.5} />
              )}
              {state === 'pending' && (
                <CircleDashed className="w-4 h-4 text-text-muted/60 shrink-0" strokeWidth={1.5} />
              )}
              {state === 'failed' && (
                <XCircle className="w-4 h-4 text-danger shrink-0" strokeWidth={1.5} />
              )}

              <span
                className={`font-medium ${
                  state === 'active'
                    ? 'text-text'
                    : state === 'done'
                    ? 'text-text-muted'
                    : state === 'failed'
                    ? 'text-danger'
                    : 'text-text-muted/60'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error State with Retry */}
      {isFailed && (
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs text-danger font-medium">
            {getErrorCodeMessage(error?.code || job?.error?.code)}
          </p>
          {correlationId && (
            <p className="text-xs font-mono text-text-muted">
              Reference: {correlationId}
            </p>
          )}
          <div className="pt-1 flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              Retry analysis
            </Button>
          </div>
        </div>
      )}

      {/* 2-minute long-running warning */}
      {elapsed >= 120 && !isFailed && !dismissTimeoutAlert && (
        <div className="p-3 rounded-md bg-surface-raised border border-border flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2 text-text">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>Still working. This is taking longer than usual.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDismissTimeoutAlert(true)}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              Keep waiting
            </button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
