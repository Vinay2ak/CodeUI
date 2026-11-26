import React, { useState, useEffect, useRef } from "react";
import {
  FileSearch,
  FileText,
  Loader2,
  AlertTriangle,
  Save,
  X,
  ShieldAlert,
} from "lucide-react";
import { aiFeature } from "../../lib/features";
import { aiApi } from "../../services/ai/api";
import { env } from "../../lib/env";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { Alert } from "../../components/ui/Alert";
import type {
  SelfCheckReport,
  DraftSummary,
  IdentifiedRisk,
  JobStatus,
} from "../ai-assistant/types";
import {
  summarizeReport,
  flagEvidence,
  isReportStale,
  FlaggedSelfCheckReport,
} from "../ai-assistant/selfCheck";
import { applyDraft } from "../ai-assistant/draft";
import { nextJobDelay, MAX_JOB_POLLS } from "../ai-assistant/jobs";
import { isSafePath } from "../../lib/safeText";

export interface BeforeYouSubmitCardProps {
  taskId: string;
  hasUnsavedChanges: boolean;
  onSaveAll?: () => Promise<void>;
  onOpenFile?: (path: string) => void;
  files: { path: string }[];
  lastSavedAt: number | null;
  changedPaths: string[];
  notes: string;
  onApplyDraft: (newNotes: string) => void;
}

export const BeforeYouSubmitCard: React.FC<BeforeYouSubmitCardProps> = ({
  taskId,
  hasUnsavedChanges,
  onSaveAll,
  onOpenFile,
  files,
  lastSavedAt,
  changedPaths,
  notes,
  onApplyDraft,
}) => {
  const canSelfCheck = aiFeature("selfcheck");
  const canDraft = aiFeature("draft");

  // 1. Self-Check State
  const [report, setReport] = useState<SelfCheckReport | null>(null);
  const [isSelfCheckPolling, setIsSelfCheckPolling] = useState(false);
  const [selfCheckElapsed, setSelfCheckElapsed] = useState(0);
  const [selfCheckJobId, setSelfCheckJobId] = useState<string | null>(null);
  const [selfCheckError, setSelfCheckError] = useState<{
    code?: string;
    message?: string;
    retryAfter?: number;
  } | null>(null);
  const [keepWaitingSelfCheck, setKeepWaitingSelfCheck] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  // 2. Draft Summary State
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  const [isDraftPolling, setIsDraftPolling] = useState(false);
  const [draftElapsed, setDraftElapsed] = useState(0);
  const [draftJobId, setDraftJobId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<{
    code?: string;
    message?: string;
    retryAfter?: number;
  } | null>(null);

  const selfCheckCancelRef = useRef(false);
  const draftCancelRef = useRef(false);

  // Load cached reports from sessionStorage on mount or task change
  useEffect(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const scCache = sessionStorage.getItem(`cb_ai_selfcheck_${taskId}`);
        if (scCache) setReport(JSON.parse(scCache));
        const dsCache = sessionStorage.getItem(`cb_ai_draft_${taskId}`);
        if (dsCache) setDraft(JSON.parse(dsCache));
      } catch {
        // Ignored
      }
    }
  }, [taskId]);

  // Elapsed timer for self-check
  useEffect(() => {
    if (!isSelfCheckPolling) {
      setSelfCheckElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setSelfCheckElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isSelfCheckPolling]);

  // Elapsed timer for draft summary
  useEffect(() => {
    if (!isDraftPolling) {
      setDraftElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setDraftElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isDraftPolling]);

  // ==================== SELF CHECK HANDLERS ====================
  const handleStartSelfCheck = async () => {
    if (hasUnsavedChanges) return;

    selfCheckCancelRef.current = false;
    setSelfCheckError(null);
    setIsSelfCheckPolling(true);
    setKeepWaitingSelfCheck(false);

    try {
      const { jobId } = await aiApi.startSelfCheck(taskId);
      setSelfCheckJobId(jobId);

      // Poll job
      let attempt = 0;
      let completed = false;

      while (!completed && attempt < MAX_JOB_POLLS) {
        if (selfCheckCancelRef.current) break;

        const delayMs = nextJobDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (selfCheckCancelRef.current) break;

        const job = await aiApi.getJob<SelfCheckReport>(jobId);
        const status = job.status as JobStatus;

        if (status === "completed") {
          completed = true;
          const res = job.result as SelfCheckReport;
          setReport(res);
          setIsSelfCheckPolling(false);
          setSelfCheckJobId(null);
          if (typeof window !== "undefined" && window.sessionStorage) {
            try {
              sessionStorage.setItem(`cb_ai_selfcheck_${taskId}`, JSON.stringify(res));
            } catch {
              // Ignored
            }
          }
          return;
        }

        if (status === "failed") {
          completed = true;
          setIsSelfCheckPolling(false);
          setSelfCheckJobId(null);
          setSelfCheckError({
            code: job.error?.code || "AI_UNAVAILABLE",
            message:
              job.error?.message ||
              "The AI assistant is unavailable right now. Your tests and submission are not affected.",
          });
          return;
        }

        if (status === "cancelled") {
          completed = true;
          setIsSelfCheckPolling(false);
          setSelfCheckJobId(null);
          return;
        }

        attempt++;
      }

      if (!completed && !selfCheckCancelRef.current) {
        setIsSelfCheckPolling(false);
        setSelfCheckJobId(null);
        setSelfCheckError({
          code: "AI_TIMEOUT",
          message: "The analysis timed out.",
        });
      }
    } catch (err: any) {
      setIsSelfCheckPolling(false);
      setSelfCheckJobId(null);

      let code = err?.code || (err?.status === 429 ? "RATE_LIMITED" : "UNKNOWN");
      let message = err?.detail || err?.message || "Something went wrong.";
      let retryAfter = err?.retryAfter || (err?.status === 429 ? 20 : undefined);

      if (code === "AI_NOT_CONFIGURED" || err?.status === 503) {
        if (err?.code === "AI_NOT_CONFIGURED") {
          code = "AI_NOT_CONFIGURED";
          message = "The AI assistant isn't enabled on this server.";
        } else {
          code = "AI_UNAVAILABLE";
          message =
            "The AI assistant is unavailable right now. Your tests and submission are not affected.";
        }
      }

      setSelfCheckError({ code, message, retryAfter });
    }
  };

  const handleCancelSelfCheck = async () => {
    selfCheckCancelRef.current = true;
    if (selfCheckJobId) {
      try {
        await aiApi.cancelJob(selfCheckJobId);
      } catch {
        // Ignored
      }
    }
    setIsSelfCheckPolling(false);
    setSelfCheckJobId(null);
  };

  // ==================== DRAFT SUMMARY HANDLERS ====================
  const handleStartDraftSummary = async () => {
    if (hasUnsavedChanges) return;

    draftCancelRef.current = false;
    setDraftError(null);
    setIsDraftPolling(true);

    try {
      const { jobId } = await aiApi.startDraftSummary(taskId);
      setDraftJobId(jobId);

      let attempt = 0;
      let completed = false;

      while (!completed && attempt < MAX_JOB_POLLS) {
        if (draftCancelRef.current) break;

        const delayMs = nextJobDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (draftCancelRef.current) break;

        const job = await aiApi.getJob<DraftSummary>(jobId);
        const status = job.status as JobStatus;

        if (status === "completed") {
          completed = true;
          const res = job.result as DraftSummary;
          setDraft(res);
          setIsDraftPolling(false);
          setDraftJobId(null);
          if (typeof window !== "undefined" && window.sessionStorage) {
            try {
              sessionStorage.setItem(`cb_ai_draft_${taskId}`, JSON.stringify(res));
            } catch {
              // Ignored
            }
          }
          return;
        }

        if (status === "failed") {
          completed = true;
          setIsDraftPolling(false);
          setDraftJobId(null);
          setDraftError({
            code: job.error?.code || "AI_UNAVAILABLE",
            message:
              job.error?.message ||
              "The AI assistant is unavailable right now. Your tests and submission are not affected.",
          });
          return;
        }

        if (status === "cancelled") {
          completed = true;
          setIsDraftPolling(false);
          setDraftJobId(null);
          return;
        }

        attempt++;
      }

      if (!completed && !draftCancelRef.current) {
        setIsDraftPolling(false);
        setDraftJobId(null);
        setDraftError({
          code: "AI_TIMEOUT",
          message: "The analysis timed out.",
        });
      }
    } catch (err: any) {
      setIsDraftPolling(false);
      setDraftJobId(null);

      let code = err?.code || (err?.status === 429 ? "RATE_LIMITED" : "UNKNOWN");
      let message = err?.detail || err?.message || "Something went wrong.";
      let retryAfter = err?.retryAfter || (err?.status === 429 ? 20 : undefined);

      if (code === "AI_NOT_CONFIGURED" || err?.status === 503) {
        if (err?.code === "AI_NOT_CONFIGURED") {
          code = "AI_NOT_CONFIGURED";
          message = "The AI assistant isn't enabled on this server.";
        } else {
          code = "AI_UNAVAILABLE";
          message =
            "The AI assistant is unavailable right now. Your tests and submission are not affected.";
        }
      }

      setDraftError({ code, message, retryAfter });
    }
  };

  const handleCancelDraft = async () => {
    draftCancelRef.current = true;
    if (draftJobId) {
      try {
        await aiApi.cancelJob(draftJobId);
      } catch {
        // Ignored
      }
    }
    setIsDraftPolling(false);
    setDraftJobId(null);
  };

  const handleDraftAction = (mode: "insert" | "replace" | "append") => {
    if (!draft) return;
    const textToApply = draft.notes || draft.summary;
    const newNotes = applyDraft(notes, textToApply, mode, 500);
    onApplyDraft(newNotes);
  };

  const handleDiscardDraft = () => {
    setDraft(null);
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`cb_ai_draft_${taskId}`);
      } catch {
        // Ignored
      }
    }
  };

  // Precomputed values
  const flaggedReport: FlaggedSelfCheckReport | null = report
    ? flagEvidence(report, new Set(changedPaths))
    : null;
  const summaryCounts = report ? summarizeReport(report) : null;
  const isStaleReport = report ? isReportStale(report.generatedAt, lastSavedAt) : false;
  const knownFilesList = files.map((f) => f.path);

  const renderStatusDot = (status: string) => {
    let dotColor = "bg-muted";
    let text = "Not evaluated";

    if (status === "met") {
      dotColor = "bg-success";
      text = "Met";
    } else if (status === "partial") {
      dotColor = "bg-warning";
      text = "Partially met";
    } else if (status === "not_met") {
      dotColor = "bg-danger";
      text = "Not met";
    }

    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
        <span className="font-medium text-ink">{text}</span>
      </div>
    );
  };

  const renderRiskSeverity = (severity: string) => {
    switch (severity) {
      case "high":
        return <Chip tone="danger">High</Chip>;
      case "medium":
        return <Chip tone="warning">Medium</Chip>;
      case "low":
      default:
        return <Chip tone="neutral">Low</Chip>;
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-ink">Before you submit</h4>
          <Chip tone="info">AI · advisory</Chip>
          {env.useMocks && <Chip tone="neutral">Simulated</Chip>}
        </div>
      </div>

      {/* Unsaved changes warning if present */}
      {hasUnsavedChanges && (
        <div className="flex items-center justify-between gap-2 text-warning bg-warning-bg border border-warning-border px-3 py-2 rounded-lg text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Save your changes first</span>
          </div>
          {onSaveAll && (
            <button
              type="button"
              onClick={() => onSaveAll()}
              className="underline font-semibold hover:text-ink flex items-center gap-1 shrink-0"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              <span>Save all</span>
            </button>
          )}
        </div>
      )}

      {/* ==================== 1. AI SELF-CHECK ==================== */}
      {canSelfCheck && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted leading-relaxed">
              Compare your saved changes with the acceptance criteria. This uses the AI service.
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={hasUnsavedChanges || isSelfCheckPolling}
              onClick={handleStartSelfCheck}
            >
              {isSelfCheckPolling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Run AI self-check</span>
            </Button>
          </div>

          {/* Polling State */}
          {isSelfCheckPolling && (
            <div className="rounded-lg border border-line bg-raised p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-ink">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  <span>Analyzing your changes… ({selfCheckElapsed}s)</span>
                  {env.useMocks && <Chip tone="neutral">Simulated</Chip>}
                </div>
                <Button variant="secondary" size="sm" onClick={handleCancelSelfCheck}>
                  Cancel
                </Button>
              </div>

              {selfCheckElapsed >= 120 && !keepWaitingSelfCheck && (
                <div className="pt-2 border-t border-line flex items-center justify-between text-warning gap-2">
                  <span>Still working. This is taking longer than usual.</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setKeepWaitingSelfCheck(true)}
                    >
                      Keep waiting
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleCancelSelfCheck}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {!isSelfCheckPolling && selfCheckError && (
            <div className="rounded-lg border border-danger-border bg-danger-bg p-3 text-xs space-y-2">
              <div className="text-danger">
                {selfCheckError.message || "Failed to complete AI self-check."}
              </div>
              {selfCheckError.code !== "AI_NOT_CONFIGURED" && (
                <Button variant="secondary" size="sm" onClick={handleStartSelfCheck}>
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* Result State */}
          {!isSelfCheckPolling && flaggedReport && summaryCounts && (
            <div className="space-y-3 pt-2">
              {/* Out of date stale alert */}
              {isStaleReport && (
                <Alert tone="warning" title="Out of date">
                  Your code changed after this check. Run it again.
                </Alert>
              )}

              {/* Summary line */}
              <div className="flex items-center justify-between text-xs border-b border-line pb-2 flex-wrap gap-2">
                <span className="font-medium text-ink">
                  {summaryCounts.met} met · {summaryCounts.partial} partially met ·{" "}
                  {summaryCounts.notMet} not met
                </span>
                {isStaleReport && <Chip tone="warning">Out of date</Chip>}
              </div>

              {/* Real Table */}
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Self-check against acceptance criteria
                  </caption>
                  <thead className="bg-raised border-b border-line text-muted uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th scope="col" className="p-2.5">
                        Criterion
                      </th>
                      <th scope="col" className="p-2.5">
                        Status
                      </th>
                      <th scope="col" className="p-2.5">
                        Evidence
                      </th>
                      <th scope="col" className="p-2.5">
                        Reasoning
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {flaggedReport.criteria.map((crit) => {
                      const isExpanded = !!expandedReasoning[crit.criterionId];
                      return (
                        <tr key={crit.criterionId} className="hover:bg-raised/40 transition-colors">
                          <td className="p-2.5 align-top min-w-[140px]">
                            <div className="space-y-1">
                              <span className="text-ink font-medium leading-snug block">
                                {crit.text}
                              </span>
                              <Chip tone={crit.required ? "warning" : "neutral"}>
                                {crit.required ? "Required" : "Optional"}
                              </Chip>
                            </div>
                          </td>
                          <td className="p-2.5 align-top">
                            {renderStatusDot(crit.status)}
                          </td>
                          <td className="p-2.5 align-top min-w-[150px]">
                            {crit.evidence.length === 0 ? (
                              <span className="text-muted italic">None</span>
                            ) : (
                              <div className="space-y-1">
                                {crit.evidence.map((ev, i) => {
                                  const isInWorkspace =
                                    isSafePath(ev.path) && knownFilesList.includes(ev.path);
                                  const rangeStr =
                                    ev.startLine != null
                                      ? ev.endLine != null && ev.endLine !== ev.startLine
                                        ? `:${ev.startLine}-${ev.endLine}`
                                        : `:${ev.startLine}`
                                      : "";

                                  return (
                                    <div
                                      key={i}
                                      className="font-mono text-[11px] flex items-center gap-1.5 flex-wrap"
                                    >
                                      <span className="text-ink">
                                        {ev.path}
                                        {rangeStr}
                                      </span>
                                      {isInWorkspace && onOpenFile ? (
                                        <button
                                          type="button"
                                          onClick={() => onOpenFile(ev.path)}
                                          className="text-primary hover:underline font-sans text-[11px] font-semibold"
                                        >
                                          Open
                                        </button>
                                      ) : null}
                                      {!ev.inChangedFiles && (
                                        <Chip tone="neutral">Not in changed files</Chip>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 align-top max-w-[200px]">
                            <div className="text-ink leading-relaxed">
                              <p
                                className={
                                  isExpanded
                                    ? "whitespace-pre-wrap"
                                    : "line-clamp-2"
                                }
                              >
                                {crit.reasoning}
                              </p>
                              {crit.reasoning.length > 80 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedReasoning((prev) => ({
                                      ...prev,
                                      [crit.criterionId]: !prev[crit.criterionId],
                                    }))
                                  }
                                  className="text-primary hover:underline font-semibold text-[11px] mt-0.5 inline-block"
                                >
                                  {isExpanded ? "Less" : "More"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Collapsible Risks & Edge Cases */}
              {flaggedReport.risks && flaggedReport.risks.length > 0 && (
                <details className="rounded-lg border border-line bg-raised p-3 text-xs group">
                  <summary className="font-semibold text-ink cursor-pointer list-none flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
                      <span>Risks and edge cases ({flaggedReport.risks.length})</span>
                    </div>
                    <span className="text-muted text-[11px] group-open:hidden">Show</span>
                    <span className="text-muted text-[11px] hidden group-open:inline">Hide</span>
                  </summary>

                  <div className="mt-3 space-y-2.5 divide-y divide-line pt-2">
                    {flaggedReport.risks.map((risk: IdentifiedRisk) => (
                      <div key={risk.id} className="pt-2 first:pt-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {renderRiskSeverity(risk.severity)}
                          <span className="font-mono text-[11px] uppercase text-muted">
                            {risk.category}
                          </span>
                        </div>
                        <p className="text-ink">{risk.text}</p>
                        {risk.category === "secrets" && (
                          <p className="text-muted italic text-[11px]">
                            Secret values are never displayed.
                          </p>
                        )}
                        {risk.evidence && risk.evidence.length > 0 && (
                          <div className="font-mono text-[11px] text-muted">
                            {risk.evidence.map((ev, i) => (
                              <span key={i}>
                                {ev.path}
                                {ev.startLine ? `:${ev.startLine}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Mandatory Footer Notice */}
              <div className="pt-1 text-[11px] text-muted italic">
                AI self-check is advisory. Submitting requires the automated checks to pass.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 2. DRAFT SUMMARY ==================== */}
      {canDraft && (
        <div className="space-y-3 pt-3 border-t border-line">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted">Draft a structured review note from your changes:</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={hasUnsavedChanges || isDraftPolling}
              onClick={handleStartDraftSummary}
            >
              {isDraftPolling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Draft summary from my changes</span>
            </Button>
          </div>

          {/* Polling State */}
          {isDraftPolling && (
            <div className="rounded-lg border border-line bg-raised p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-ink">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                <span>Drafting summary from changes… ({draftElapsed}s)</span>
                {env.useMocks && <Chip tone="neutral">Simulated</Chip>}
              </div>
              <Button variant="secondary" size="sm" onClick={handleCancelDraft}>
                Cancel
              </Button>
            </div>
          )}

          {/* Error State */}
          {!isDraftPolling && draftError && (
            <div className="rounded-lg border border-danger-border bg-danger-bg p-3 text-xs space-y-2">
              <div className="text-danger">
                {draftError.message || "Failed to generate draft summary."}
              </div>
              {draftError.code !== "AI_NOT_CONFIGURED" && (
                <Button variant="secondary" size="sm" onClick={handleStartDraftSummary}>
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* Result Preview Card */}
          {!isDraftPolling && draft && (
            <div className="rounded-lg border border-line bg-raised p-3.5 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="font-semibold text-ink">Draft · review before using</span>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="text-muted hover:text-ink p-1 rounded"
                  aria-label="Discard draft"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div>
                <span className="text-muted uppercase text-[10px] tracking-wider font-semibold block mb-1">
                  Summary
                </span>
                <p className="text-ink leading-relaxed whitespace-pre-wrap">{draft.summary}</p>
              </div>

              {draft.filesModified.length > 0 && (
                <div>
                  <span className="text-muted uppercase text-[10px] tracking-wider font-semibold block mb-1">
                    Files Modified
                  </span>
                  <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                    {draft.filesModified.map((f, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-surface border border-line text-ink">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {draft.notes && (
                <div>
                  <span className="text-muted uppercase text-[10px] tracking-wider font-semibold block mb-1">
                    Notes
                  </span>
                  <p className="text-ink leading-relaxed whitespace-pre-wrap">{draft.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-line flex-wrap">
                {notes.trim().length === 0 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleDraftAction("insert")}
                  >
                    Insert draft
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleDraftAction("replace")}
                    >
                      Replace my text
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDraftAction("append")}
                    >
                      Append
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={handleDiscardDraft}>
                  Discard
                </Button>
              </div>

              {/* Advisory warning */}
              <p className="text-[11px] text-muted italic">
                AI drafts can be wrong. Check every statement before you submit.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
