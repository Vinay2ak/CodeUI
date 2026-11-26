import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Info,
  FileCode2,
  TriangleAlert,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { aiApi } from "../../services/ai/api";
import { workspaceApi } from "../../services/workspace/api";
import { Chip } from "../../components/ui/Chip";
import { ApiError } from "../../lib/errors";
import { env } from "../../lib/env";
import { formatRelativeTime } from "../../lib/format";
import { formatRange } from "../ai-assistant/citations";
import type { FileItem } from "../../services/workspace/types";

interface AiContextTabProps {
  taskId: string;
  onOpenFile?: (path: string) => void;
  workspaceFiles?: FileItem[];
}

export const AiContextTab: React.FC<AiContextTabProps> = ({
  taskId,
  onOpenFile,
  workspaceFiles: propFiles,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const {
    data: aiContext,
    isLoading: isAiLoading,
    error: aiError,
    refetch,
  } = useQuery({
    queryKey: ["ai", taskId],
    queryFn: () => aiApi.getContext(taskId),
    enabled: Boolean(taskId),
  });

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => workspaceApi.getTask(taskId),
    enabled: Boolean(taskId),
  });

  const { data: fileTreeData } = useQuery({
    queryKey: ["workspace", "files", taskId],
    queryFn: () => workspaceApi.getFiles(taskId),
    enabled: Boolean(taskId) && !propFiles,
  });

  const workspacePaths = useMemo(() => {
    const list = propFiles || fileTreeData?.items || [];
    return new Set(list.map((f) => f.path));
  }, [propFiles, fileTreeData]);

  const copyCommand = (command: string, idx: number) => {
    navigator.clipboard.writeText(command);
    setCopiedIdx(idx);
    setTimeout(() => {
      setCopiedIdx((current) => (current === idx ? null : current));
    }, 2000);
  };

  if (isAiLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-raised rounded" />
        <div className="h-20 bg-raised rounded-xl" />
        <div className="h-28 bg-raised rounded-xl" />
        <div className="h-24 bg-raised rounded-xl" />
      </div>
    );
  }

  if (aiError) {
    const apiError = aiError instanceof ApiError ? aiError : null;
    if (apiError?.status === 404) {
      return (
        <div className="py-12 text-center space-y-2">
          <Info
            className="h-8 w-8 text-muted mx-auto mb-2"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h4 className="text-sm font-semibold text-ink">
            No AI context for this task.
          </h4>
        </div>
      );
    }

    if (apiError?.code === "AI_NOT_CONFIGURED") {
      return (
        <div className="py-12 text-center space-y-2">
          <Info
            className="h-8 w-8 text-muted mx-auto mb-2"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h4 className="text-sm font-semibold text-ink">
            The AI assistant isn't enabled on this server.
          </h4>
        </div>
      );
    }

    const correlationId = apiError?.correlationId || "err_ai";
    return (
      <div className="rounded-lg border border-line bg-raised p-4 text-center space-y-2">
        <p className="text-sm text-ink">
          {apiError?.detail || "Failed to load AI code context."}
        </p>
        <p className="text-xs text-muted font-mono">Reference: {correlationId}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!aiContext) {
    return (
      <div className="py-12 text-center text-muted text-sm">
        No AI context for this task.
      </div>
    );
  }

  const shortCommit = aiContext.repoCommitSha
    ? aiContext.repoCommitSha.substring(0, 7)
    : "HEAD";
  const relativeTime = aiContext.generatedAt
    ? formatRelativeTime(aiContext.generatedAt)
    : "recently";

  return (
    <div className="space-y-6 text-sm">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-2 border-b border-line gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Chip
            tone="neutral"
            icon={
              <Info
                className="h-3.5 w-3.5 text-primary"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            }
          >
            AI · advisory
          </Chip>
          {env.useMocks && (
            <span className="text-xs text-muted font-medium">Simulated</span>
          )}
        </div>
        <span className="text-xs text-muted font-mono">
          Generated from commit {shortCommit} · {relativeTime}
        </span>
      </div>

      {/* Original requirement block */}
      <div className="rounded-lg border border-line bg-raised p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
          <span>Original requirement</span>
          <span className="font-mono text-ink lowercase">
            {task?.criteria?.length ?? 0} acceptance criteria
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {task?.brief?.[0] || "No requirement brief available."}
        </p>
      </div>

      {/* Summary */}
      {aiContext.summary && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Summary
          </h3>
          <p className="rounded-lg border border-line bg-raised p-3.5 text-xs text-muted leading-relaxed">
            {aiContext.summary}
          </p>
        </section>
      )}

      {/* Key Findings */}
      {aiContext.findings && aiContext.findings.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Findings
          </h3>
          <ul className="space-y-2">
            {aiContext.findings.map((finding, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-muted leading-relaxed"
              >
                <span
                  className="text-primary font-bold mt-0.5"
                  aria-hidden="true"
                >
                  •
                </span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Relevant Files */}
      {aiContext.relevantFiles && aiContext.relevantFiles.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Relevant Files
          </h3>
          <div className="space-y-2.5">
            {aiContext.relevantFiles.map((file) => {
              const rangeStr = formatRange(file.startLine, file.endLine);
              const pathDisplay = rangeStr
                ? `${file.path}:${rangeStr}`
                : file.path;
              const inWorkspace = workspacePaths.has(file.path);
              const percent = Math.round(file.score * 100);

              return (
                <div
                  key={file.path}
                  className="rounded-lg border border-line bg-surface p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 font-mono text-xs text-ink font-medium">
                      <FileCode2
                        className="h-3.5 w-3.5 text-primary shrink-0"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <span className="truncate">{pathDisplay}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-medium text-ink">
                        {percent}% relevant
                      </span>
                      {inWorkspace ? (
                        onOpenFile && (
                          <button
                            type="button"
                            onClick={() => onOpenFile(file.path)}
                            className="inline-flex items-center rounded border border-line-strong bg-raised px-2 py-0.5 text-[11px] font-mono text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
                          >
                            Open
                          </button>
                        )
                      ) : (
                        <Chip
                          tone="neutral"
                          icon={
                            <TriangleAlert
                              className="h-3 w-3 text-muted"
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          }
                        >
                          Not in workspace
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* Relevance Bar */}
                  <div className="w-full h-1 bg-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${percent}%` }}
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Relevance score ${percent}%`}
                    />
                  </div>

                  {file.reason && (
                    <p className="text-xs text-muted pt-0.5">{file.reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dependencies */}
      {aiContext.dependencies && aiContext.dependencies.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Dependencies
          </h3>
          <div className="space-y-2">
            {aiContext.dependencies.map((dep, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-line bg-surface p-2.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-ink">
                      {dep.name}
                    </span>
                    <Chip tone="neutral">{dep.kind}</Chip>
                  </div>
                  {dep.note && <p className="text-xs text-muted">{dep.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Affected Areas */}
      {aiContext.affectedAreas && aiContext.affectedAreas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Affected Areas
          </h3>
          <div className="space-y-2">
            {aiContext.affectedAreas.map((area, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-line bg-surface p-2.5 space-y-0.5"
              >
                <div className="text-xs font-medium text-ink">{area.name}</div>
                {area.note && <p className="text-xs text-muted">{area.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Setup Hints */}
      {aiContext.setupHints && aiContext.setupHints.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Setup Hints
          </h3>
          <p className="text-xs text-muted">
            Suggestions only. Nothing runs automatically.
          </p>
          <div className="space-y-2">
            {aiContext.setupHints.map((hint, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-line bg-surface p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2 bg-raised rounded p-2">
                  <code className="font-mono text-xs text-ink truncate select-all">
                    {hint.command}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCommand(hint.command, idx)}
                    className="inline-flex items-center gap-1 rounded border border-line-strong px-2 py-0.5 text-[11px] text-muted hover:text-ink hover:bg-surface cursor-pointer shrink-0 transition-colors"
                    aria-label={`Copy command ${hint.command}`}
                  >
                    {copiedIdx === idx ? (
                      <>
                        <Check
                          className="h-3 w-3 text-ok"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy
                          className="h-3 w-3"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                {hint.note && <p className="text-xs text-muted">{hint.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested Approach */}
      {aiContext.approach && aiContext.approach.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Suggested Approach
          </h3>
          <ol className="space-y-2 list-decimal list-inside">
            {aiContext.approach.map((step, idx) => (
              <li
                key={idx}
                className="rounded-lg border border-line bg-surface p-3 text-xs text-muted leading-relaxed"
              >
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};
