import React, { useState } from "react";
import { Loader2, Copy, Check, X, FileCode } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { env } from "../../lib/env";
import { isSafePath } from "../../lib/safeText";
import type { FailureExplanation } from "../ai-assistant/types";

export interface ExplainDrawerProps {
  testId: string;
  explanation: FailureExplanation | null;
  isLoading: boolean;
  elapsedSeconds: number;
  error: { code?: string; message?: string; retryAfter?: number } | null;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  knownFiles: string[];
  isStale: boolean;
}

export const ExplainDrawer: React.FC<ExplainDrawerProps> = ({
  testId,
  explanation,
  isLoading,
  elapsedSeconds,
  error,
  onRetry,
  onStop,
  onClose,
  onOpenFile,
  knownFiles,
  isStale,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!explanation) return;
    const lines = [
      `AI Failure Explanation for ${testId}`,
      "",
      `Explanation: ${explanation.explanation}`,
      "",
      `Likely Cause: ${explanation.likelyCause}`,
      "",
      "Suspected Locations:",
      ...explanation.suspectedLocations.map(
        (loc) =>
          `  - ${loc.path}${loc.startLine ? `:${loc.startLine}` : ""}${
            loc.endLine && loc.endLine !== loc.startLine ? `-${loc.endLine}` : ""
          } (${loc.reason})`
      ),
      "",
      "Next Steps:",
      ...explanation.nextSteps.map((step, idx) => `  ${idx + 1}. ${step}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`AI explanation for ${testId}`}
      className="mt-2 rounded-lg border border-line bg-raised p-3 text-xs space-y-3"
    >
      {/* Header chips & close */}
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip tone="info">AI · advisory</Chip>
          {env.useMocks && <Chip tone="neutral">Simulated</Chip>}
          {isStale && <Chip tone="warning">Code changed since this explanation</Chip>}
        </div>

        <div className="flex items-center gap-1.5">
          {explanation && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              aria-label="Copy explanation to clipboard"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close explanation"
            className="p-1 rounded text-muted hover:text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-between py-2 text-muted">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            <span>Reading the failure… ({elapsedSeconds}s)</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onStop}>
            Stop
          </Button>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="space-y-2 py-1">
          {error.code === "RATE_LIMITED" ? (
            <div className="text-warning">
              Rate limit exceeded. Try again in {error.retryAfter || 20}s.
            </div>
          ) : error.code === "AI_NOT_CONFIGURED" ? (
            <div className="text-muted">
              The AI assistant isn't enabled on this server.
            </div>
          ) : (
            <div className="text-danger">
              {error.message || "Something went wrong."}
            </div>
          )}
          {error.code !== "AI_NOT_CONFIGURED" && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Explanation content */}
      {!isLoading && !error && explanation && (
        <div className="space-y-3">
          <div>
            <div className="font-semibold text-muted text-[11px] uppercase tracking-wider mb-0.5">
              Explanation
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-wrap">
              {explanation.explanation}
            </p>
          </div>

          <div>
            <div className="font-semibold text-muted text-[11px] uppercase tracking-wider mb-0.5">
              Likely Cause
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-wrap">
              {explanation.likelyCause}
            </p>
          </div>

          {explanation.suspectedLocations.length > 0 && (
            <div>
              <div className="font-semibold text-muted text-[11px] uppercase tracking-wider mb-1">
                Suspected Locations
              </div>
              <ul className="space-y-1.5">
                {explanation.suspectedLocations.map((loc, idx) => {
                  const isInWorkspace =
                    isSafePath(loc.path) && knownFiles.includes(loc.path);
                  const rangeStr =
                    loc.startLine != null
                      ? loc.endLine != null && loc.endLine !== loc.startLine
                        ? `:${loc.startLine}-${loc.endLine}`
                        : `:${loc.startLine}`
                      : "";

                  return (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded bg-surface border border-line px-2 py-1 font-mono text-[11px]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCode className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                        <span className="text-ink truncate">
                          {loc.path}
                          {rangeStr}
                        </span>
                        <span className="text-muted font-sans text-[11px] truncate">
                          — {loc.reason}
                        </span>
                      </div>
                      {isInWorkspace ? (
                        <button
                          type="button"
                          onClick={() => onOpenFile(loc.path)}
                          className="font-sans text-[11px] font-semibold text-primary hover:underline ml-2 shrink-0"
                        >
                          Open
                        </button>
                      ) : (
                        <span className="font-sans text-[11px] text-muted ml-2 shrink-0">
                          Not in workspace
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {explanation.nextSteps.length > 0 && (
            <div>
              <div className="font-semibold text-muted text-[11px] uppercase tracking-wider mb-1">
                Next Steps
              </div>
              <ol className="list-decimal list-inside space-y-1 text-ink leading-relaxed">
                {explanation.nextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
