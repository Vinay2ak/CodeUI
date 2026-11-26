import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AiVerificationReport,
  AiVerificationResponse,
  AiVerificationCriterion,
  AutomatedRun,
} from '../types';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/button';
import { validateEvidence } from '../evidence';
import { deriveSignals } from '../signals';
import { reviewApi } from '../../../services/review/api';

interface AiVerificationSectionProps {
  submissionId: string;
  run: AutomatedRun | null;
  onReportChange?: (report: AiVerificationReport | null) => void;
}

export const AiVerificationSection: React.FC<AiVerificationSectionProps> = ({
  submissionId,
  run,
  onReportChange,
}) => {
  const [status, setStatus] = useState<AiVerificationResponse['status']>('not_requested');
  const [report, setReport] = useState<AiVerificationReport | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  const isMock = import.meta.env.VITE_USE_MOCKS === 'true';

  // Elapsed seconds timer when running
  useEffect(() => {
    if (status !== 'running') {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Initial fetch check on mount
  useEffect(() => {
    let isCancelled = false;
    async function checkStatus() {
      try {
        const res = await reviewApi.getAiVerification(submissionId);
        if (isCancelled) return;
        setStatus(res.status);
        if (res.report) {
          const validated = run ? validateEvidence(res.report, run.diff.files) : res.report;
          setReport(validated);
          if (onReportChange) onReportChange(validated);
        }
        if (res.error) {
          setError(res.error);
        }
      } catch {
        // Leave as not_requested or unavailable
      }
    }
    checkStatus();
    return () => {
      isCancelled = true;
    };
  }, [submissionId]);

  // Polling loop when status === 'running'
  useEffect(() => {
    if (status !== 'running') return;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      try {
        const res = await reviewApi.getAiVerification(submissionId);
        if (res.status === 'ready' && res.report) {
          const validated = run ? validateEvidence(res.report, run.diff.files) : res.report;
          setReport(validated);
          setStatus('ready');
          if (onReportChange) onReportChange(validated);
        } else if (res.status === 'failed' || res.status === 'unavailable') {
          setStatus(res.status);
          setError(res.error || { code: 'AI_ERROR', message: 'Verification failed' });
        } else {
          timer = setTimeout(poll, 1500);
        }
      } catch {
        setStatus('unavailable');
        setError({ code: 'UNAVAILABLE', message: 'Service unreachable' });
      }
    };

    timer = setTimeout(poll, 1500);
    return () => clearTimeout(timer);
  }, [status, submissionId, run]);

  const handleStartVerification = async () => {
    setStatus('running');
    setError(null);
    try {
      await reviewApi.requestAiVerification(submissionId);
    } catch {
      setStatus('unavailable');
      setError({ code: 'UNAVAILABLE', message: 'Unable to start AI verification' });
    }
  };

  const toggleReasoning = (criterionId: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [criterionId]: !prev[criterionId],
    }));
  };

  const signals = deriveSignals(run, report);

  const getStatusDotAndText = (criterionStatus: AiVerificationCriterion['status']) => {
    switch (criterionStatus) {
      case 'met':
        return (
          <span className="inline-flex items-center text-xs font-semibold text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block mr-1.5" />
            Met
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center text-xs font-semibold text-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block mr-1.5" />
            Partially met
          </span>
        );
      case 'not_met':
        return (
          <span className="inline-flex items-center text-xs font-semibold text-danger">
            <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block mr-1.5" />
            Not met
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-semibold text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted inline-block mr-1.5" />
            Not evaluated
          </span>
        );
    }
  };

  return (
    <section aria-labelledby="ai-verification-heading" className="p-6 rounded-xl border border-border bg-surface space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
            3
          </span>
          <h2 id="ai-verification-heading" className="text-base font-semibold text-text">
            AI requirement verification
          </h2>
          <Chip size="sm" tone="primary" label="Advisory" />
        </div>

        {status === 'ready' && report && (
          <div className="text-xs text-text-muted font-medium">
            {signals.criteriaCounts.met} met · {signals.criteriaCounts.partial} partially met ·{' '}
            {signals.criteriaCounts.not_met} not met
          </div>
        )}
      </div>

      {/* State: not_requested */}
      {status === 'not_requested' && (
        <div className="py-8 px-4 text-center rounded-lg border border-dashed border-border bg-surface-raised/40 space-y-3">
          <Sparkles className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Compare the changes with the acceptance criteria. This uses the AI service and can take a minute.
          </p>
          <Button size="md" variant="primary" onClick={handleStartVerification}>
            Run AI verification
          </Button>
        </div>
      )}

      {/* State: running */}
      {status === 'running' && (
        <div className="py-8 px-4 text-center rounded-lg border border-border bg-surface-raised space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-text">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Analyzing changes… ({elapsedSeconds}s)</span>
            {isMock && (
              <Chip size="sm" tone="neutral" label="Simulated analysis" />
            )}
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <div className="h-4 bg-border/40 animate-pulse rounded w-full" />
            <div className="h-4 bg-border/40 animate-pulse rounded w-5/6 mx-auto" />
            <div className="h-4 bg-border/40 animate-pulse rounded w-3/4 mx-auto" />
          </div>
        </div>
      )}

      {/* State: failed or unavailable */}
      {(status === 'failed' || status === 'unavailable') && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                AI verification is unavailable right now. The automated checks above are not affected.
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleStartVerification}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          </div>
          {error && (
            <p className="text-xs text-danger/80 font-mono">
              Reference: {error.code} - {error.message}
            </p>
          )}
        </div>
      )}

      {/* State: ready */}
      {status === 'ready' && report && (
        <div className="space-y-5">
          {/* Quiet Disagreement Alert */}
          {signals.disagreement === 'checks_pass_ai_flags' && (
            <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/30 text-text text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                The automated checks passed, but the AI review flags {signals.disagreeingCriteria} criteria. Review the evidence before deciding.
              </span>
            </div>
          )}

          {signals.disagreement === 'checks_fail_ai_clean' && (
            <div className="p-3.5 rounded-lg bg-warning/10 border border-warning/30 text-text text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <span>
                A required check failed while the AI review found every criterion met. Review the logs before deciding.
              </span>
            </div>
          )}

          {/* Criteria Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <caption className="sr-only">Acceptance criteria verification</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                  <th scope="col" className="pb-2.5 font-medium">Criterion</th>
                  <th scope="col" className="pb-2.5 font-medium">Status</th>
                  <th scope="col" className="pb-2.5 font-medium">Evidence</th>
                  <th scope="col" className="pb-2.5 font-medium">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {report.criteria.map((c) => {
                  const isExpanded = !!expandedReasoning[c.criterionId];
                  return (
                    <tr key={c.criterionId} className="hover:bg-surface-raised/40 transition-colors align-top">
                      <td className="py-3 pr-3 max-w-xs">
                        <div className="space-y-1">
                          <p className="text-text text-xs font-medium leading-snug">
                            {c.text}
                          </p>
                          <Chip
                            size="sm"
                            tone={c.required ? 'primary' : 'neutral'}
                            label={c.required ? 'Required' : 'Optional'}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusDotAndText(c.status)}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        {c.evidence.length === 0 ? (
                          <span className="text-xs text-text-muted">No evidence cited</span>
                        ) : (
                          <div className="space-y-1.5">
                            {c.evidence.map((ev, i) => (
                              <div key={i} className="text-xs font-mono">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-text">
                                    {ev.path}
                                    {ev.startLine !== null && `:${ev.startLine}`}
                                    {ev.endLine !== null && `-${ev.endLine}`}
                                  </span>
                                  {ev.inDiff === false && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-warning bg-warning/15 px-1.5 py-0.5 rounded border border-warning/30">
                                      <AlertTriangle className="w-3 h-3" />
                                      Not in diff
                                    </span>
                                  )}
                                </div>
                                {ev.snippet && (
                                  <pre className="text-[11px] bg-surface-raised p-1.5 rounded border border-border overflow-x-auto whitespace-pre-wrap mt-1">
                                    {ev.snippet}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-3 max-w-xs">
                        <div className="text-xs text-text-muted space-y-1">
                          <p className={isExpanded ? '' : 'line-clamp-2'}>
                            {c.reasoning || 'No analysis provided.'}
                          </p>
                          {c.reasoning.length > 80 && (
                            <button
                              type="button"
                              onClick={() => toggleReasoning(c.criterionId)}
                              className="text-primary hover:underline text-[11px] font-medium inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  Less <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  More <ChevronDown className="w-3 h-3" />
                                </>
                              )}
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

          {/* Collapsible Risks Details */}
          {report.risks && report.risks.length > 0 && (
            <details className="space-y-3 pt-3 border-t border-border">
              <summary className="cursor-pointer text-xs font-semibold text-text hover:text-primary transition-colors flex items-center justify-between select-none">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  Risks and edge cases ({report.risks.length})
                </span>
                <span className="text-text-muted font-normal">
                  {report.risks.filter((r) => r.severity === 'high').length} High,{' '}
                  {report.risks.filter((r) => r.severity === 'medium').length} Medium,{' '}
                  {report.risks.filter((r) => r.severity === 'low').length} Low
                </span>
              </summary>
              <div className="space-y-2.5 pt-2">
                {report.risks.map((risk) => (
                  <div
                    key={risk.id}
                    className="p-3 rounded-lg border border-border bg-surface-raised text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Chip
                          size="sm"
                          tone={
                            risk.severity === 'high'
                              ? 'danger'
                              : risk.severity === 'medium'
                              ? 'warning'
                              : 'neutral'
                          }
                          icon={risk.severity === 'high' ? <AlertTriangle className="w-3 h-3" /> : undefined}
                          label={risk.severity.toUpperCase()}
                        />
                        <span className="text-text-muted uppercase tracking-wider font-semibold text-[10px]">
                          {risk.category.replace('_', ' ')}
                        </span>
                      </div>
                      {risk.evidence.length > 0 && (
                        <div className="font-mono text-text-muted text-[11px]">
                          {risk.evidence.map((e, idx) => (
                            <span key={idx}>
                              {e.path}
                              {e.startLine && `:${e.startLine}`}
                              {e.endLine && `-${e.endLine}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-text font-medium leading-relaxed">{risk.text}</p>
                    {risk.category === 'secrets' && (
                      <p className="text-text-muted text-[11px] italic">
                        Secret values are never displayed.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Exact Footer Notice */}
          <div className="pt-2 text-xs text-text-muted italic border-t border-border/60">
            AI verification is advisory. Payment release requires explicit Project Owner approval.
          </div>
        </div>
      )}
    </section>
  );
};
