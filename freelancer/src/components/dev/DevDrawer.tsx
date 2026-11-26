import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  X,
  Copy,
  Check,
  Zap,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { sessionStore } from "../../session/session";
import { decodeJwt } from "../../lib/jwt";
import { getCallLogs, subscribeCallLog, CallLogEntry } from "../../lib/callLog";
import { realtimeManager } from "../../realtime/manager";
import { env } from "../../lib/env";
import { Button } from "../ui/Button";

interface DevDrawerProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
}

export const DevDrawer: React.FC<DevDrawerProps> = ({ open, onClose, taskId }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [serviceDownStates, setServiceDownStates] = useState({
    workspace: false,
    submission: false,
    ai: false,
    payment: false,
    notification: false,
  });

  const [aiScenario, setAiScenario] = useState<
    "ok" | "slow" | "fail" | "not_configured" | "no_evidence" | "rate_limited" | "hostile"
  >("ok");

  const [selectedEventType, setSelectedEventType] = useState("workspace.status_changed");

  const session = useSyncExternalStore(
    (cb) => sessionStore.subscribe(cb),
    () => sessionStore.getState()
  );

  const callLogs = useSyncExternalStore(
    (cb) => subscribeCallLog(cb),
    () => getCallLogs()
  );

  const realtime = useSyncExternalStore(
    (cb) => realtimeManager.subscribe(cb),
    () => realtimeManager.getState()
  );

  const decodedClaims = session.accessToken ? decodeJwt(session.accessToken) : null;
  const expSeconds = decodedClaims?.exp
    ? Math.max(0, decodedClaims.exp - Math.floor(Date.now() / 1000))
    : 0;

  // Esc closes drawer and focus trapping
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleService = (
    svc: "workspace" | "submission" | "ai" | "payment" | "notification"
  ) => {
    const next = !serviceDownStates[svc];
    setServiceDownStates((prev) => ({ ...prev, [svc]: next }));
    window.__cbMock?.serviceDown(svc, next);
  };

  const handleEmitEvent = () => {
    const sampleData: Record<string, unknown> = {
      "workspace.status_changed": { taskId, status: "running" },
      "test.run.progress": { taskId, runId: "test_run", testId: "t_custom", status: "passed" },
      "test.run.completed": { taskId, runId: "test_run", passed: 5, failed: 0, requiredPassed: true },
      "submission.status_changed": { taskId, status: "in_review", note: "Sample note" },
      "payment.state_changed": { taskId, state: "approved" },
      "task.assigned": { taskId, title: "Test task", projectTitle: "Payments" },
    };
    window.__cbMock?.emitEvent(selectedEventType, sampleData[selectedEventType] || { taskId });
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-sm"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-md h-full bg-surface border-l border-line p-5 shadow-md flex flex-col overflow-y-auto space-y-6 text-xs text-ink"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 id="dev-drawer-title" className="text-sm font-bold text-ink">
              Developer Diagnostics (Ctrl+Shift+D)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close developer drawer"
            className="p-1 rounded text-muted hover:text-ink hover:bg-raised"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 1. Session & Token Claims */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">
              Session Claims
            </h3>
            <span className="font-mono text-primary flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Token exp in {expSeconds}s
            </span>
          </div>

          <div className="rounded-lg border border-line bg-raised p-2.5 font-mono text-[11px] space-y-1">
            <div>sub: {decodedClaims?.sub || "none"}</div>
            <div>role: {decodedClaims?.role || "none"}</div>
            <div>exp: {decodedClaims?.exp || "none"}</div>
          </div>

          {env.useMocks && (
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => window.__cbMock?.expireToken()}
              >
                Expire access token (mock)
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={() => window.__cbMock?.setSuspended(true)}
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Simulate suspension</span>
              </Button>
            </div>
          )}
        </section>

        {/* 2. Mock Scenarios */}
        {env.useMocks && (
          <section className="space-y-2">
            <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">
              Scenarios (Mock)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.__cbMock?.applyReferenceFix(taskId)}
              >
                Apply reference fix
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.__cbMock?.simulateOwnerDecision(taskId, "approve")}
              >
                Simulate owner approval
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.__cbMock?.simulateOwnerDecision(taskId, "changes")}
              >
                Simulate changes requested
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.__cbMock?.resetTask(taskId)}
              >
                Reset task
              </Button>
            </div>
          </section>
        )}

        {/* 3. Service Failures (Mock) */}
        {env.useMocks && (
          <section className="space-y-2">
            <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">
              Service Failure Toggles (503)
            </h3>
            <div className="space-y-1.5 rounded-lg border border-line bg-raised p-2.5">
              {(
                ["workspace", "submission", "ai", "payment", "notification"] as const
              ).map((svc) => (
                <label
                  key={svc}
                  className="flex items-center justify-between cursor-pointer py-1"
                >
                  <span className="capitalize">{svc} service</span>
                  <input
                    type="checkbox"
                    checked={serviceDownStates[svc]}
                    onChange={() => handleToggleService(svc)}
                    className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        {/* AI Scenarios & Diagnostics (Mock) */}
        {env.useMocks && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">
                AI Assistant Scenarios
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAiScenario("ok");
                    window.__cbMock?.resetAi();
                  }}
                >
                  Reset AI
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    window.__cbMock?.failNextAiJob(true);
                  }}
                >
                  Fail next AI job
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5">
              <label className="block text-xs text-muted mb-1">Simulated Scenario</label>
              <select
                value={aiScenario}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setAiScenario(val);
                  window.__cbMock?.setAiScenario(val);
                }}
                className="w-full rounded border border-line-strong bg-input px-2 py-1 text-xs text-ink font-mono"
              >
                <option value="ok">ok (normal response)</option>
                <option value="slow">slow (25s latency)</option>
                <option value="fail">fail (503 AI_UNAVAILABLE)</option>
                <option value="not_configured">not_configured (503 AI_NOT_CONFIGURED)</option>
                <option value="no_evidence">no_evidence (ungrounded answer)</option>
                <option value="rate_limited">rate_limited (429 on 3rd query)</option>
                <option value="hostile">hostile (injected scripts/secrets/traversal)</option>
              </select>
            </div>
          </section>
        )}

        {/* 4. Realtime status & Events */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">
              Realtime Transport
            </h3>
            <span className="font-mono text-xs capitalize text-primary">
              {realtime.status}
            </span>
          </div>

          {env.useMocks && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  className="flex-1 rounded border border-line-strong bg-input px-2 py-1 text-xs text-ink font-mono"
                >
                  <option value="workspace.status_changed">workspace.status_changed</option>
                  <option value="test.run.progress">test.run.progress</option>
                  <option value="test.run.completed">test.run.completed</option>
                  <option value="submission.status_changed">submission.status_changed</option>
                  <option value="payment.state_changed">payment.state_changed</option>
                  <option value="task.assigned">task.assigned</option>
                </select>
                <Button variant="secondary" size="sm" onClick={handleEmitEvent}>
                  Emit test event
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => window.__cbMock?.dropConnection(5000)}
              >
                Drop connection (5 s)
              </Button>
            </div>
          )}
        </section>

        {/* 5. Last 20 API Calls */}
        <section className="space-y-2 flex-1 min-h-0 flex flex-col">
          <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">
            API Calls Ring Buffer ({callLogs.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-1 rounded-lg border border-line bg-raised p-2 font-mono text-[11px]">
            {callLogs.length === 0 ? (
              <div className="text-muted text-center py-4">No API calls recorded</div>
            ) : (
              callLogs.map((entry: CallLogEntry, idx: number) => {
                const isError = entry.status >= 400;
                return (
                  <div
                    key={idx}
                    className="p-1.5 rounded border border-line bg-surface flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink">{entry.method}</span>
                        <span className="text-muted truncate">{entry.path}</span>
                        <span
                          className={`font-semibold ${
                            isError ? "text-danger" : "text-success"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted flex items-center gap-2 mt-0.5">
                        <span>{entry.ms}ms</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{entry.correlationId}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(entry.correlationId)}
                      title="Copy Correlation ID"
                      className="p-1 rounded text-muted hover:text-ink hover:bg-raised shrink-0"
                    >
                      {copiedId === entry.correlationId ? (
                        <Check className="h-3 w-3 text-success" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
