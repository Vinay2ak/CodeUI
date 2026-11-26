import React, { useState, useEffect, useRef, useMemo, useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Info,
  MessageSquareText,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  FileCode2,
  TriangleAlert,
  X,
  Square,
  AlertCircle,
} from "lucide-react";
import { aiApi } from "../../services/ai/api";
import { workspaceApi } from "../../services/workspace/api";
import { Chip } from "../../components/ui/Chip";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { env } from "../../lib/env";
import { ApiError } from "../../lib/errors";
import { parseRetryAfter } from "../../lib/rateLimit";
import { isSafePath } from "../../lib/safeText";
import { parseAnswerBlocks, AnswerBlock } from "../ai-assistant/answerBlocks";
import { validateCitations, formatRange } from "../ai-assistant/citations";
import { isStale } from "../ai-assistant/staleness";
import { buildAskRequest } from "../ai-assistant/requests";
import {
  loadAskHistory,
  saveAskHistory,
  askHistoryReducer,
} from "../ai-assistant/askHistory";
import type { FileItem } from "../../services/workspace/types";

interface AskAiPanelProps {
  taskId: string;
  files: FileItem[];
  onOpenFile: (path: string) => void;
  lastSavedAt?: number | null;
  activeEditorFile?: string | null;
}

export const AskAiPanel: React.FC<AskAiPanelProps> = ({
  taskId,
  files,
  onOpenFile,
  lastSavedAt = null,
  activeEditorFile,
}) => {
  const [history, dispatch] = useReducer(askHistoryReducer, [], () =>
    loadAskHistory(taskId)
  );

  const [question, setQuestion] = useState("");
  const [focusFile, setFocusFile] = useState<string | null>(activeEditorFile || null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync focus file when active editor file changes, if user hasn't explicitly dismissed it
  useEffect(() => {
    if (activeEditorFile && isSafePath(activeEditorFile)) {
      setFocusFile(activeEditorFile);
    }
  }, [activeEditorFile]);

  // Load task history on taskId change
  useEffect(() => {
    dispatch({ type: "SET_HISTORY", history: loadAskHistory(taskId) });
  }, [taskId]);

  // Save history on changes
  useEffect(() => {
    saveAskHistory(taskId, history);
  }, [taskId, history]);

  // Query capabilities
  const { data: capabilities, isLoading: isCapLoading } = useQuery({
    queryKey: ["ai", "capabilities"],
    queryFn: () => aiApi.getCapabilities(),
    staleTime: 60000,
  });

  // Query task for suggestions
  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => workspaceApi.getTask(taskId),
    enabled: Boolean(taskId),
  });

  const workspacePaths = useMemo(() => {
    return new Set(files.map((f) => f.path));
  }, [files]);

  // Derive 3 fixed prompt suggestions based on task metadata
  const suggestions = useMemo(() => {
    const list: string[] = [];
    if (task?.criteria && task.criteria.length > 0) {
      list.push(`Where is ${task.criteria[0].text.toLowerCase()} handled?`);
      if (task.criteria.length > 1) {
        list.push(`How to verify "${task.criteria[1].text}"?`);
      }
      if (task.criteria.length > 2) {
        list.push(`Which files implement "${task.criteria[2].text}"?`);
      }
    }
    // Fallbacks if criteria are sparse
    if (list.length < 1) list.push("Where is the webhook handled?");
    if (list.length < 2) list.push("Why do duplicate events cause double charges?");
    if (list.length < 3) list.push("Which tests cover retries?");
    return list.slice(0, 3);
  }, [task]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  // Pending elapsed seconds timer
  const isPending = history.some((t) => t.status === "pending");
  useEffect(() => {
    if (!isPending) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPending]);

  // Scroll to bottom of conversation on new turns
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [history.length, isPending]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => {
      setCopiedCodeId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const sendQuestion = async (qText: string) => {
    const trimmed = qText.trim();
    if (trimmed.length < 3 || trimmed.length > 500 || isPending || rateLimitSeconds > 0) {
      return;
    }

    const turnId = `turn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    dispatch({ type: "ADD_QUESTION", id: turnId, question: trimmed });
    setQuestion("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 60-second timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const askReq = buildAskRequest({
        question: trimmed,
        focusPath: focusFile && workspacePaths.has(focusFile) ? focusFile : undefined,
      });

      const answer = await aiApi.askQuestion(taskId, askReq, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      dispatch({ type: "SET_ANSWER", id: turnId, answer });
      setAnnouncement("Answer ready");
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        if (elapsedSeconds >= 59) {
          dispatch({
            type: "SET_ERROR",
            id: turnId,
            error: "The assistant took too long. Try again.",
          });
        } else {
          dispatch({
            type: "SET_ERROR",
            id: turnId,
            error: "Request cancelled.",
          });
        }
        return;
      }

      if (err instanceof ApiError) {
        if (err.status === 429) {
          const retrySec = err.retryAfter || parseRetryAfter(String(err.retryAfter)) || 20;
          setRateLimitSeconds(retrySec);
          dispatch({
            type: "SET_ERROR",
            id: turnId,
            error: `You've reached the question limit. Try again in ${retrySec}s.`,
          });
          return;
        }

        if (err.code === "AI_NOT_CONFIGURED" || capabilities?.provider === "none") {
          dispatch({
            type: "SET_ERROR",
            id: turnId,
            error: "The AI assistant isn't enabled on this server.",
          });
          return;
        }

        if (err.status === 503 || err.code === "AI_UNAVAILABLE") {
          dispatch({
            type: "SET_ERROR",
            id: turnId,
            error:
              "The AI assistant is unavailable right now. The workspace and tests are not affected.",
          });
          return;
        }

        dispatch({
          type: "SET_ERROR",
          id: turnId,
          error: err.detail || "Failed to get an answer.",
        });
        return;
      }

      dispatch({
        type: "SET_ERROR",
        id: turnId,
        error: "An unexpected error occurred while communicating with the AI service.",
      });
    } finally {
      abortControllerRef.current = null;
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(question);
    }
  };

  // Quota line: find the latest remaining quota from the most recent answer
  const lastDoneTurn = [...history].reverse().find((t) => t.status === "done" && t.answer);
  const remainingQuestions = lastDoneTurn?.answer?.remaining ?? null;

  const isNotConfigured =
    !isCapLoading &&
    capabilities &&
    (capabilities.provider === "none" || !capabilities.features?.ask);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Screen-reader live announcement region */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {/* Header bar */}
      <div className="px-3 py-2 border-b border-line flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} aria-hidden="true" />
            <span>Ask about this task's code</span>
          </h3>
          <Chip
            tone="neutral"
            icon={<Info className="h-3 w-3 text-primary" strokeWidth={1.5} aria-hidden="true" />}
          >
            AI · advisory
          </Chip>
          {env.useMocks && <span className="text-xs text-muted font-medium">Simulated</span>}
        </div>
        <span className="text-[11px] text-muted hidden sm:inline">
          Answers come from this task's repository snapshot. Don't paste secrets.
        </span>
      </div>

      {/* Not configured notice */}
      {isNotConfigured ? (
        <div className="flex-1 p-6 flex items-center justify-center text-center">
          <div className="max-w-sm space-y-2">
            <Info className="h-8 w-8 text-muted mx-auto" strokeWidth={1.5} aria-hidden="true" />
            <h4 className="text-sm font-semibold text-ink">
              The AI assistant isn't enabled on this server.
            </h4>
            <p className="text-xs text-muted">
              AI code intelligence is not configured or disabled for this environment.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Conversation history log */}
          <div
            ref={logScrollRef}
            role="log"
            aria-live="off"
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
          >
            {history.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-muted">
                  Ask any question about the codebase, functions, architecture, or test suites.
                </p>
                {/* Suggestions */}
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuestion(s);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-md border border-line bg-raised px-2.5 py-1 text-xs text-ink hover:bg-surface hover:border-line-strong transition-colors cursor-pointer text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history.map((turn) => {
                const isTurnStale =
                  turn.answer?.generatedAt &&
                  isStale(turn.answer.generatedAt, lastSavedAt);
                const validatedCits = turn.answer?.citations
                  ? validateCitations(workspacePaths, turn.answer.citations)
                  : [];
                const isNoEvidence =
                  turn.answer?.grounding === "no_evidence" || validatedCits.length === 0;

                return (
                  <div key={turn.id} className="space-y-3 border-b border-line/60 pb-3 last:border-b-0">
                    {/* User Question */}
                    <div className="flex items-start gap-2 justify-end">
                      <div className="max-w-[85%] rounded-lg bg-raised border border-line p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-3 text-[11px] text-muted font-medium">
                          <span>You</span>
                          {focusFile && (
                            <span className="font-mono text-primary flex items-center gap-1">
                              <FileCode2 className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                              {focusFile}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink whitespace-pre-wrap font-sans">{turn.question}</p>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex items-start gap-2">
                      <div className="w-full max-w-[92%] rounded-lg bg-surface border border-line p-3 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span className="font-semibold text-primary">AI Assistant</span>
                          {isTurnStale && (
                            <Chip tone="neutral">Code changed since this answer</Chip>
                          )}
                        </div>

                        {/* Pending indicator */}
                        {turn.status === "pending" && (
                          <div className="flex items-center justify-between gap-3 py-2" aria-live="polite">
                            <div className="flex items-center gap-2 text-xs text-muted">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" strokeWidth={1.5} />
                              <span>Thinking… ({elapsedSeconds}s)</span>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleStop}
                              className="text-xs py-0.5 px-2"
                            >
                              <Square className="h-3 w-3 mr-1" strokeWidth={1.5} aria-hidden="true" />
                              Stop
                            </Button>
                          </div>
                        )}

                        {/* Error state */}
                        {turn.status === "error" && (
                          <div className="space-y-2">
                            <Alert tone="danger" title="Assistant Error">
                              {turn.error}
                            </Alert>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => sendQuestion(turn.question)}
                              className="text-xs"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" strokeWidth={1.5} aria-hidden="true" />
                              Try again
                            </Button>
                          </div>
                        )}

                        {/* Finished Answer */}
                        {turn.status === "done" && turn.answer && (
                          <div className="space-y-2.5">
                            {/* Answer text blocks */}
                            <div className="space-y-2 text-xs text-ink leading-relaxed font-sans">
                              {parseAnswerBlocks(turn.answer.answer).map((block: AnswerBlock, bIdx: number) => {
                                if (block.type === "code") {
                                  const codeId = `${turn.id}_b_${bIdx}`;
                                  return (
                                    <div
                                      key={bIdx}
                                      className="relative rounded-md border border-line bg-canvas p-2.5 font-mono text-[11px] overflow-x-auto my-1"
                                    >
                                      <div className="flex items-center justify-between pb-1.5 border-b border-line mb-1.5 text-muted text-[10px]">
                                        <span>{block.lang || "code"}</span>
                                        <button
                                          type="button"
                                          onClick={() => copyCode(block.text, codeId)}
                                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted hover:text-ink hover:bg-raised transition-colors cursor-pointer"
                                          aria-label="Copy code block"
                                        >
                                          {copiedCodeId === codeId ? (
                                            <>
                                              <Check className="h-2.5 w-2.5 text-ok" strokeWidth={1.5} />
                                              <span>Copied</span>
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
                                              <span>Copy</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                      <pre className="overflow-x-auto">
                                        <code>{block.text}</code>
                                      </pre>
                                    </div>
                                  );
                                }
                                return (
                                  <p key={bIdx} className="whitespace-pre-wrap">
                                    {block.text}
                                  </p>
                                );
                              })}
                            </div>

                            {/* Citations section */}
                            {validatedCits.length > 0 && (
                              <div className="pt-2 border-t border-line space-y-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                  Citations
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {validatedCits.map((cit, cIdx) => {
                                    const range = formatRange(cit.startLine, cit.endLine);
                                    const label = range ? `${cit.path}:${range}` : cit.path;

                                    if (cit.inWorkspace) {
                                      return (
                                        <button
                                          key={cIdx}
                                          type="button"
                                          onClick={() => onOpenFile(cit.path)}
                                          className="inline-flex items-center gap-1 rounded border border-line bg-raised px-2 py-0.5 font-mono text-[11px] text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
                                          title={`Open ${cit.path}`}
                                        >
                                          <FileCode2 className="h-3 w-3 text-primary shrink-0" strokeWidth={1.5} />
                                          <span>{label}</span>
                                        </button>
                                      );
                                    }
                                    return (
                                      <span
                                        key={cIdx}
                                        className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-muted cursor-not-allowed"
                                      >
                                        <span className="truncate">{label}</span>
                                        <Chip tone="neutral" icon={<TriangleAlert className="h-2.5 w-2.5" strokeWidth={1.5} />}>
                                          Not in workspace
                                        </Chip>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Grounding notice */}
                            {isNoEvidence && (
                              <div className="pt-1">
                                <Alert tone="info">
                                  <div className="flex items-center justify-between gap-2">
                                    <span>No supporting code was found for this answer.</span>
                                    <span className="text-[10px] font-mono uppercase text-muted">Not grounded in code</span>
                                  </div>
                                </Alert>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer Footer */}
          <div className="p-2.5 sm:p-3 border-t border-line bg-surface space-y-2 shrink-0">
            {/* Context chips & quota */}
            <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {focusFile && workspacePaths.has(focusFile) && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-0.5 text-[11px] font-mono text-ink">
                    <FileCode2 className="h-3 w-3 text-primary" strokeWidth={1.5} aria-hidden="true" />
                    <span>About {focusFile}</span>
                    <button
                      type="button"
                      onClick={() => setFocusFile(null)}
                      className="p-0.5 text-muted hover:text-ink cursor-pointer"
                      aria-label="Remove focus file"
                    >
                      <X className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </span>
                )}
                {rateLimitSeconds > 0 && (
                  <span className="text-[11px] text-warning flex items-center gap-1 font-mono">
                    <AlertCircle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                    Limit reached. Retry in {rateLimitSeconds}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-muted">
                {remainingQuestions !== null && (
                  <span className="font-mono">{remainingQuestions} questions left this hour</span>
                )}
                <span className="font-mono">{question.length}/500</span>
              </div>
            </div>

            {/* Input area */}
            <div className="flex gap-2">
              <label htmlFor="ask-ai-input" className="sr-only">
                Your question
              </label>
              <textarea
                ref={textareaRef}
                id="ask-ai-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this task's code… (Enter sends, Shift+Enter for newline)"
                rows={2}
                maxLength={500}
                disabled={isPending || rateLimitSeconds > 0}
                className="flex-1 rounded-md border border-line-strong bg-input px-3 py-1.5 text-xs text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 resize-none font-sans"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => sendQuestion(question)}
                disabled={question.trim().length < 3 || isPending || rateLimitSeconds > 0}
                className="self-end px-3 py-2 text-xs"
              >
                Ask
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
