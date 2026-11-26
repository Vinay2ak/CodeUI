import React, { useEffect, useState, useRef } from "react";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  FileCode,
  Save,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { Run, TestStatus } from "../../services/submission/types";
import { TEST_RULES } from "../../mocks/data/rules";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { Alert } from "../../components/ui/Alert";
import { aiFeature } from "../../lib/features";
import { aiApi } from "../../services/ai/api";
import type { FailureExplanation } from "../ai-assistant/types";
import { ExplainDrawer } from "./ExplainDrawer";
import { isStale as computeStaleness } from "../ai-assistant/staleness";

interface TestsPanelProps {
  taskId: string;
  isWorkspaceRunning: boolean;
  hasUnsavedChanges: boolean;
  isStale: boolean;
  latestRun: Run | null;
  isRunningTests: boolean;
  onRunTests: () => void;
  onSaveAll: () => Promise<void>;
  onOpenFile: (path: string) => void;
  files?: { path: string }[];
  lastSavedAt?: number | null;
}

export const TestsPanel: React.FC<TestsPanelProps> = ({
  taskId,
  isWorkspaceRunning,
  hasUnsavedChanges,
  isStale,
  latestRun,
  isRunningTests,
  onRunTests,
  onSaveAll,
  onOpenFile,
  files = [],
  lastSavedAt = null,
}) => {
  const [announcedSummary, setAnnouncedSummary] = useState<string | null>(null);
  const prevRunStatusRef = useRef<string | undefined>(latestRun?.status);
  const prevRunIdRef = useRef<string | undefined>(latestRun?.runId);

  const canExplain = aiFeature("explain");
  const [isAiConfigured, setIsAiConfigured] = useState<boolean>(true);

  // Per-test explain state
  const [openTestIds, setOpenTestIds] = useState<Record<string, boolean>>({});
  const [explanations, setExplanations] = useState<Record<string, FailureExplanation>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [elapsedMap, setElapsedMap] = useState<Record<string, number>>({});
  const [errorMap, setErrorMap] = useState<
    Record<string, { code?: string; message?: string; retryAfter?: number }>
  >({});

  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const timerIntervalsRef = useRef<Record<string, any>>({});

  // Check AI capabilities on mount
  useEffect(() => {
    let cancelled = false;
    aiApi.getCapabilities().then((caps) => {
      if (!cancelled) {
        if (caps.provider === "none" || caps.features.explain === false) {
          setIsAiConfigured(false);
        } else {
          setIsAiConfigured(true);
        }
      }
    }).catch(() => {
      if (!cancelled) setIsAiConfigured(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear explanations when runId changes
  useEffect(() => {
    if (latestRun?.runId && latestRun.runId !== prevRunIdRef.current) {
      setExplanations({});
      setOpenTestIds({});
      setErrorMap({});
      setLoadingMap({});
      setElapsedMap({});

      // Clear session storage for previous runs of this task
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith(`cb_ai_explain_${taskId}_`)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => sessionStorage.removeItem(k));
        } catch {
          // Ignored
        }
      }
    }
    prevRunIdRef.current = latestRun?.runId;
  }, [latestRun?.runId, taskId]);

  // Announce completion summary once per completed run
  useEffect(() => {
    if (
      latestRun &&
      latestRun.status === "completed" &&
      prevRunStatusRef.current !== "completed"
    ) {
      const passed = latestRun.results.filter((r) => r.status === "passed").length;
      const total = latestRun.results.length;

      const rulesMap = new Map(TEST_RULES.map((r) => [r.testId, r]));
      const requiredTests = latestRun.results.filter((r) => rulesMap.get(r.testId)?.required);
      const requiredPassed = requiredTests.filter((r) => r.status === "passed").length;

      const summary = `${passed} of ${total} passed · ${requiredPassed} required of ${requiredTests.length}`;
      setAnnouncedSummary(summary);
    }
    prevRunStatusRef.current = latestRun?.status;
  }, [latestRun]);

  const handleExplain = async (testId: string) => {
    if (!latestRun?.runId) return;

    setOpenTestIds((prev) => ({ ...prev, [testId]: true }));
    setErrorMap((prev) => ({ ...prev, [testId]: undefined! }));

    // 1. Check memory cache
    if (explanations[testId]) {
      return;
    }

    // 2. Check sessionStorage cache
    const cacheKey = `cb_ai_explain_${taskId}_${latestRun.runId}_${testId}`;
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setExplanations((prev) => ({ ...prev, [testId]: parsed }));
          return;
        }
      } catch {
        // Ignored
      }
    }

    // 3. Initiate request
    const controller = new AbortController();
    abortControllersRef.current[testId] = controller;
    setLoadingMap((prev) => ({ ...prev, [testId]: true }));
    setElapsedMap((prev) => ({ ...prev, [testId]: 0 }));

    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedMap((prev) => ({
        ...prev,
        [testId]: Math.floor((Date.now() - start) / 1000),
      }));
    }, 1000);
    timerIntervalsRef.current[testId] = interval;

    try {
      const res = await aiApi.explainFailure(
        taskId,
        { runId: latestRun.runId, testId },
        { signal: controller.signal }
      );
      clearInterval(interval);
      setLoadingMap((prev) => ({ ...prev, [testId]: false }));
      setExplanations((prev) => ({ ...prev, [testId]: res }));

      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res));
        } catch {
          // Ignored
        }
      }
    } catch (err: any) {
      clearInterval(interval);
      setLoadingMap((prev) => ({ ...prev, [testId]: false }));
      if (err?.name === "AbortError") {
        return;
      }

      if (err?.code === "AI_NOT_CONFIGURED" || err?.status === 503) {
        if (err?.code === "AI_NOT_CONFIGURED") {
          setIsAiConfigured(false);
        }
      }

      let retryAfter = 20;
      if (err?.code === "RATE_LIMITED" || err?.status === 429) {
        retryAfter = err.retryAfter || 20;
      }

      setErrorMap((prev) => ({
        ...prev,
        [testId]: {
          code: err?.code || (err?.status === 429 ? "RATE_LIMITED" : "UNKNOWN"),
          message: err?.detail || err?.message || "Something went wrong.",
          retryAfter,
        },
      }));
    }
  };

  const handleStopExplain = (testId: string) => {
    if (abortControllersRef.current[testId]) {
      abortControllersRef.current[testId].abort();
      delete abortControllersRef.current[testId];
    }
    if (timerIntervalsRef.current[testId]) {
      clearInterval(timerIntervalsRef.current[testId]);
      delete timerIntervalsRef.current[testId];
    }
    setLoadingMap((prev) => ({ ...prev, [testId]: false }));
  };

  const handleCloseExplain = (testId: string) => {
    handleStopExplain(testId);
    setOpenTestIds((prev) => ({ ...prev, [testId]: false }));
  };

  const rulesMap = new Map(TEST_RULES.map((r) => [r.testId, r]));
  const results = latestRun ? latestRun.results : [];
  const totalTests = TEST_RULES.length;
  const completedCount = results.filter(
    (r) => r.status === "passed" || r.status === "failed"
  ).length;
  const progressPercent =
    totalTests > 0 ? Math.round((completedCount / totalTests) * 100) : 0;

  const knownFilesList = files.map((f) => f.path);

  const getStatusItem = (status: TestStatus) => {
    switch (status) {
      case "passed":
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />,
          label: "Passed",
          colorClass: "text-success",
        };
      case "failed":
        return {
          icon: <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />,
          label: "Failed",
          colorClass: "text-danger",
        };
      case "running":
        return {
          icon: <Loader2 className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />,
          label: "Running",
          colorClass: "text-primary",
        };
      case "pending":
      default:
        return {
          icon: <Clock className="h-4 w-4 text-muted" aria-hidden="true" />,
          label: "Pending",
          colorClass: "text-muted",
        };
    }
  };

  return (
    <div className="h-full flex flex-col bg-canvas overflow-hidden text-xs">
      {/* Polite Live Region for completion summary */}
      <div className="sr-only" aria-live="polite">
        {announcedSummary || ""}
      </div>

      {/* Action Header */}
      <div className="flex items-center justify-between p-3 border-b border-line bg-surface shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            onClick={onRunTests}
            disabled={!isWorkspaceRunning || isRunningTests || hasUnsavedChanges}
          >
            {isRunningTests ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Run tests (Ctrl+Enter)</span>
          </Button>

          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 text-warning bg-warning-bg border border-warning-border px-2.5 py-1 rounded">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Save your changes first</span>
              <button
                type="button"
                onClick={() => onSaveAll()}
                className="underline font-semibold ml-1 hover:text-ink flex items-center gap-1"
              >
                <Save className="h-3 w-3" aria-hidden="true" />
                <span>Save all</span>
              </button>
            </div>
          )}

          {canExplain && !isAiConfigured && (
            <span className="text-[11px] text-muted italic">
              AI explanations aren't enabled on this server.
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {latestRun && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-muted">
              {completedCount} / {totalTests} completed
            </span>
            <div
              className="w-32 h-2 bg-raised rounded-full overflow-hidden border border-line"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Test run progress ${progressPercent}%`}
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stale Warning Banner */}
      {isStale && (
        <div className="p-3 border-b border-line">
          <Alert tone="warning" title="Stale Test Results">
            Code changed since this run. Run the tests again to update verification.
          </Alert>
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {!latestRun ? (
          <div className="py-12 text-center text-muted">
            <p>No test runs executed yet for this task.</p>
            <p className="mt-1">Click "Run tests" above or press Ctrl+Enter to begin.</p>
          </div>
        ) : (
          results.map((res) => {
            const rule = rulesMap.get(res.testId);
            const statusInfo = getStatusItem(res.status);
            const isRequired = rule?.required ?? true;
            const owningFile = rule?.file || "app/main.py";
            const isFailing =
              res.status === "failed" ||
              (res.status as string) === "timed_out" ||
              (res.status as string) === "error";

            const isExplainOpen = !!openTestIds[res.testId];
            const explanation = explanations[res.testId] || null;
            const isExplainStale = explanation
              ? computeStaleness(explanation.generatedAt, lastSavedAt)
              : false;

            return (
              <div
                key={res.testId}
                className="rounded-lg border border-line bg-surface p-3 space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusInfo.icon}
                    <span className="font-mono font-semibold text-ink truncate">
                      {res.testId}
                    </span>
                    <span className={`font-medium ${statusInfo.colorClass}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {res.durationMs !== undefined && (
                      <span className="font-mono text-muted text-[11px]">
                        {res.durationMs}ms
                      </span>
                    )}
                    <Chip tone={isRequired ? "warning" : "neutral"}>
                      {isRequired ? "Required" : "Optional"}
                    </Chip>
                  </div>
                </div>

                {/* Error message block with file button and Explain Failure button */}
                {isFailing && res.message && (
                  <div className="rounded border border-danger-border bg-danger-bg p-2.5 space-y-2 mt-1">
                    <pre className="font-mono text-danger text-[11px] whitespace-pre-wrap leading-relaxed">
                      {res.message}
                    </pre>
                    <div className="flex items-center justify-between pt-1 border-t border-danger-border/40 gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted">Occurred in:</span>
                        <button
                          type="button"
                          onClick={() => onOpenFile(owningFile)}
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-primary hover:underline"
                        >
                          <FileCode className="h-3 w-3" aria-hidden="true" />
                          <span>{owningFile}</span>
                        </button>
                      </div>

                      {canExplain && isAiConfigured && (
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Explain failure for ${res.testId}`}
                          onClick={() => handleExplain(res.testId)}
                        >
                          <HelpCircle className="h-3 w-3" aria-hidden="true" />
                          <span>Explain failure</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Explain failure drawer */}
                {isExplainOpen && (
                  <ExplainDrawer
                    testId={res.testId}
                    explanation={explanation}
                    isLoading={!!loadingMap[res.testId]}
                    elapsedSeconds={elapsedMap[res.testId] || 0}
                    error={errorMap[res.testId] || null}
                    onRetry={() => handleExplain(res.testId)}
                    onStop={() => handleStopExplain(res.testId)}
                    onClose={() => handleCloseExplain(res.testId)}
                    onOpenFile={onOpenFile}
                    knownFiles={knownFilesList}
                    isStale={isExplainStale}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
