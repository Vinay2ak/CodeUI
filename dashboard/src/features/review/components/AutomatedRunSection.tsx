import React, { useState } from 'react';
import {
  CircleCheck,
  CircleX,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { AutomatedRun, DockerTestResult } from '../types';
import { formatExit, formatDuration, shortSha } from '../format';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/button';
import { verificationApi } from '../../../services/verification/api';

interface AutomatedRunSectionProps {
  run: AutomatedRun | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const AutomatedRunSection: React.FC<AutomatedRunSectionProps> = ({
  run,
  isLoading,
  isError,
  onRetry,
}) => {
  // First failing check expanded by default, or null if all pass
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(() => {
    if (!run) return null;
    const firstFail = run.checks.find((c) => c.status === 'failed' || c.status === 'error');
    return firstFail ? firstFail.id : null;
  });

  const [fullLogs, setFullLogs] = useState<Record<string, { lines: string[]; truncated: boolean }>>(
    {}
  );
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);
  const [logErrorId, setLogErrorId] = useState<string | null>(null);
  const [copiedCheckId, setCopiedCheckId] = useState<string | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const toggleExpand = (checkId: string) => {
    setExpandedCheckId((prev) => (prev === checkId ? null : checkId));
  };

  const handleLoadFullLog = async (checkId: string) => {
    if (!run) return;
    setLoadingLogId(checkId);
    setLogErrorId(null);
    try {
      const res = await verificationApi.getCheckLog(run.submissionId, checkId, 2000);
      setFullLogs((prev) => ({ ...prev, [checkId]: res }));
    } catch {
      setLogErrorId(checkId);
    } finally {
      setLoadingLogId(null);
    }
  };

  const handleCopyLog = (check: DockerTestResult) => {
    const full = fullLogs[check.id];
    const textToCopy = full ? full.lines.join('\n') : check.logTail;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCheckId(check.id);
    setTimeout(() => setCopiedCheckId(null), 2000);
  };

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Checks are still running…</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Unable to load automated check results.</span>
          </div>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    if (!run) {
      return (
        <p className="text-sm text-text-muted">No automated results for this submission.</p>
      );
    }

    if (run.status === 'failed_to_run') {
      return (
        <div className="flex items-center gap-2 text-sm text-danger font-medium">
          <AlertTriangle className="w-4 h-4" />
          <span>The checks could not be run: {run.message || 'Container initialization failed.'}</span>
        </div>
      );
    }

    const failedRequired = run.checks.filter(
      (c) => c.required && (c.status === 'failed' || c.status === 'error' || c.status === 'timed_out')
    ).length;

    if (failedRequired === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-success font-medium">
          <CircleCheck className="w-4 h-4" />
          <span>All required checks passed.</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-danger font-medium">
        <CircleX className="w-4 h-4" />
        <span>{failedRequired} required check(s) failed.</span>
      </div>
    );
  };

  const renderResultBadge = (check: DockerTestResult) => {
    const text = formatExit(check);
    if (check.status === 'passed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
          <CircleCheck className="w-3.5 h-3.5" />
          {text}
        </span>
      );
    }
    if (check.status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
          <CircleX className="w-3.5 h-3.5" />
          {text}
        </span>
      );
    }
    if (check.status === 'timed_out') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
          <Clock className="w-3.5 h-3.5" />
          {text}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted">
        <AlertTriangle className="w-3.5 h-3.5" />
        {text}
      </span>
    );
  };

  const files = run?.diff.files || [];
  const displayedFiles = showAllFiles ? files : files.slice(0, 20);

  return (
    <section aria-labelledby="checks-heading" className="p-6 rounded-xl border border-border bg-surface space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border gap-2">
        <div>
          <h2 id="checks-heading" className="text-base font-semibold text-text flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
              2
            </span>
            Automated check results
          </h2>
          {run && (
            <p className="text-xs text-text-muted mt-0.5">
              Run in an isolated container on commit{' '}
              <span className="font-mono text-text">{shortSha(run.commitSha)}</span>.
            </p>
          )}
        </div>
        {renderStatus()}
      </div>

      {/* Checks Table */}
      {run && run.checks.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">Automated check results</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                <th scope="col" className="pb-2.5 font-medium">Check</th>
                <th scope="col" className="pb-2.5 font-medium">Result</th>
                <th scope="col" className="pb-2.5 font-medium text-right">Duration</th>
                <th scope="col" className="pb-2.5 font-medium text-center">Required</th>
                <th scope="col" className="pb-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {run.checks.map((check) => {
                const isExpanded = expandedCheckId === check.id;
                const full = fullLogs[check.id];
                const displayedLog = full ? full.lines.join('\n') : check.logTail;
                const isTruncated = full ? full.truncated : check.logTruncated;

                return (
                  <React.Fragment key={check.id}>
                    <tr className="hover:bg-surface-raised/40 transition-colors">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-muted capitalize">
                            {check.kind}
                          </span>
                          <code className="text-xs font-mono text-text bg-surface-raised px-2 py-0.5 rounded border border-border">
                            {check.command}
                          </code>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {renderResultBadge(check)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-text-muted whitespace-nowrap">
                        {formatDuration(check.durationMs)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <Chip
                          size="sm"
                          tone={check.required ? 'primary' : 'neutral'}
                          label={check.required ? 'Required' : 'Optional'}
                        />
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`log-panel-${check.id}`}
                          onClick={() => toggleExpand(check.id)}
                          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Logs
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Collapsible Log Panel */}
                    {isExpanded && (
                      <tr id={`log-panel-${check.id}`}>
                        <td colSpan={5} className="py-3 px-1">
                          <div className="p-3 bg-surface-raised rounded-lg border border-border space-y-2">
                            <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                              <span className="font-semibold text-text-muted flex items-center gap-1.5">
                                Log output for {check.command}
                                {isTruncated && (
                                  <span className="text-xs font-normal text-warning">
                                    (Log truncated)
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                {!full && check.logTruncated && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLoadFullLog(check.id)}
                                    disabled={loadingLogId === check.id}
                                  >
                                    {loadingLogId === check.id ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                        Loading...
                                      </>
                                    ) : (
                                      'Load full log'
                                    )}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyLog(check)}
                                >
                                  {copiedCheckId === check.id ? (
                                    <>
                                      <Check className="w-3 h-3 mr-1 text-success" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 mr-1" />
                                      Copy log
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>

                            {logErrorId === check.id && (
                              <p className="text-xs text-danger">Failed to load full logs from server.</p>
                            )}

                            <pre
                              tabIndex={0}
                              aria-label={`${check.command} log`}
                              className="font-mono text-xs max-h-72 overflow-y-auto whitespace-pre-wrap text-text/90 leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary p-2 bg-surface rounded"
                            >
                              {displayedLog || 'No log output captured.'}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Diff File Summary */}
      {files.length > 0 && (
        <details open className="space-y-2 pt-3 border-t border-border/80">
          <summary className="cursor-pointer text-sm font-semibold text-text hover:text-primary transition-colors flex items-center gap-2 select-none">
            <FileCode className="w-4 h-4 text-text-muted" />
            Changed files ({files.length})
          </summary>
          <div className="pt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Changed files list</caption>
              <thead>
                <tr className="border-b border-border/60 text-text-muted">
                  <th scope="col" className="pb-1.5 font-medium">Status</th>
                  <th scope="col" className="pb-1.5 font-medium">File</th>
                  <th scope="col" className="pb-1.5 font-medium text-right">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {displayedFiles.map((f, i) => (
                  <tr key={`${f.path}-${i}`} className="hover:bg-surface-raised/30">
                    <td className="py-1.5 pr-3 capitalize text-text-muted">
                      {f.status}
                    </td>
                    <td className="py-1.5 pr-3 text-text truncate max-w-xs sm:max-w-md">
                      {f.path}
                    </td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                      <span className="text-success">+{f.additions}</span>{' '}
                      <span className="text-danger">-{f.deletions}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {files.length > 20 && !showAllFiles && (
              <div className="pt-2 text-center">
                <Button size="sm" variant="ghost" onClick={() => setShowAllFiles(true)}>
                  Show all {files.length} files
                </Button>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
};
