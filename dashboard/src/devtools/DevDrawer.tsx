import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Radio,
  Clock,
  Terminal,
  Activity,
  Server,
  Zap,
} from 'lucide-react';
import { useSession } from '../features/session/session';
import { env } from '../lib/env';
import { callLog, CallLogEntry } from '../lib/callLog';
import { useEventStore } from '../realtime/store';
import {
  mockState,
  expireToken,
  setSuspended,
  setServiceFailing,
  setFailMatching,
  setMatchingDelay,
  setBriefScenario,
  setBriefDelay,
  setReviewScenario,
  triggerFailNextRelease,
  setFailAiVerification,
  resetReview,
  emitTestEvent,
  dropConnection,
  subscribeMockControls,
} from '../mocks/controls';
import { Button } from '../components/ui/button';

export const DevDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<CallLogEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState('user.registered');
  const [, setTick] = useState(0);

  const { accessToken, user } = useSession();
  const { status: realtimeStatus } = useEventStore();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Subscribe to callLog
  useEffect(() => {
    setLogs(callLog.getLogs());
    return callLog.subscribe(() => {
      setLogs([...callLog.getLogs()]);
    });
  }, []);

  // Subscribe to mock state changes
  useEffect(() => {
    return subscribeMockControls(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Listen to open-dev-drawer custom event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-dev-drawer', handleOpen);
    return () => window.removeEventListener('open-dev-drawer', handleOpen);
  }, []);

  // Trap focus when open
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Decode JWT payload
  let claims: any = null;
  let remainingTimeStr = 'None';

  if (accessToken && accessToken.includes('.')) {
    try {
      claims = JSON.parse(atob(accessToken.split('.')[1]));
      if (claims?.exp) {
        const remainingMs = claims.exp * 1000 - Date.now();
        if (remainingMs > 0) {
          const totalSec = Math.floor(remainingMs / 1000);
          const min = Math.floor(totalSec / 60);
          const sec = totalSec % 60;
          remainingTimeStr = `${min}m ${sec}s`;
        } else {
          remainingTimeStr = 'Expired';
        }
      }
    } catch {
      claims = null;
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) {
    return null;
  }

  const servicesList = [
    'project',
    'talent',
    'payment',
    'workspace',
    'admin',
    'notification',
    'github',
    'codeContext',
    'verification',
    'review',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className="relative w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col h-full z-10 overflow-hidden text-text"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 id="dev-drawer-title" className="text-base font-bold">
              Developer Tools
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
              Ctrl+Shift+D
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Developer Tools"
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Session & JWT */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <Zap className="w-4 h-4 text-warning" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Session & Token Claims
              </h3>
            </div>

            <div className="p-3 rounded-md bg-surface-raised/50 border border-border text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Subject (sub):</span>
                <span className="font-semibold">{claims?.sub || user?.id || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Role:</span>
                <span className="font-semibold text-primary">{claims?.role || user?.role || 'None'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Token Expiration:</span>
                <div className="flex items-center gap-1 text-warning">
                  <Clock className="w-3 h-3" />
                  <span>{remainingTimeStr}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Token Gen:</span>
                <span>{mockState.tokenGen}</span>
              </div>
            </div>

            {env.VITE_USE_MOCKS && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expireToken}
                  className="text-xs"
                >
                  Expire access token (mock)
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setSuspended(true)}
                  className="text-xs"
                >
                  Simulate suspension (mock)
                </Button>
              </div>
            )}
          </section>

          {/* Section 2: Mock Service Failure Controls */}
          {env.VITE_USE_MOCKS && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <Server className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Service Failure Simulator (503)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {servicesList.map((svc) => {
                  const isFailing = !!mockState.failingServices[svc];
                  return (
                    <div
                      key={svc}
                      className="flex items-center justify-between p-2.5 rounded-md bg-surface-raised/40 border border-border"
                    >
                      <span className="font-mono text-xs font-medium">
                        {svc} service
                      </span>
                      <button
                        type="button"
                        onClick={() => setServiceFailing(svc, !isFailing)}
                        className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer border ${isFailing
                          ? 'bg-danger text-on-primary border-danger'
                          : 'bg-surface text-text-muted border-border hover:text-text'
                          }`}
                      >
                        {isFailing ? 'Failing with 503' : 'Healthy'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Matching Specific Simulation */}
              <div className="p-3 rounded-md bg-surface-raised/50 border border-border space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Fail Talent Matching</span>
                  <button
                    type="button"
                    onClick={() => setFailMatching(!mockState.failMatching)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer border ${mockState.failMatching
                      ? 'bg-danger text-on-primary border-danger'
                      : 'bg-surface text-text-muted border-border hover:text-text'
                      }`}
                  >
                    {mockState.failMatching ? 'Failing (status: failed)' : 'Normal'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="matching-delay-input" className="text-xs text-text-muted">
                    Matching Delay (ms)
                  </label>
                  <input
                    id="matching-delay-input"
                    type="number"
                    min="0"
                    step="500"
                    value={mockState.matchingDelayMs}
                    onChange={(e) => setMatchingDelay(Number(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs rounded bg-surface border border-border text-right font-mono text-text"
                  />
                </div>
              </div>

              {/* AI Brief Simulation */}
              <div className="p-3 rounded-md bg-surface-raised/50 border border-border space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">AI Brief Scenario</span>
                  <select
                    value={mockState.briefScenario}
                    onChange={(e) => setBriefScenario(e.target.value as 'ok' | 'slow' | 'fail')}
                    className="px-2 py-1 text-xs rounded bg-surface border border-border text-text font-mono"
                  >
                    <option value="ok">Normal (4.9s)</option>
                    <option value="slow">Slow (40s)</option>
                    <option value="fail">Fail (AI_TIMEOUT)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="brief-delay-input" className="text-xs text-text-muted">
                    AI Brief Delay (ms)
                  </label>
                  <input
                    id="brief-delay-input"
                    type="number"
                    min="0"
                    step="500"
                    value={mockState.briefDelayMs}
                    onChange={(e) => setBriefDelay(Number(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs font-mono rounded bg-surface border border-border text-text text-right focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Review & Verification Simulation */}
              <div className="p-3 rounded-md bg-surface-raised/50 border border-border space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Review Scenario</span>
                  <select
                    value={mockState.reviewScenario}
                    onChange={(e) =>
                      setReviewScenario(e.target.value as 'pass' | 'mixed' | 'fail')
                    }
                    className="px-2 py-1 text-xs rounded bg-surface border border-border text-text font-mono"
                  >
                    <option value="pass">Pass (All clean)</option>
                    <option value="mixed">Mixed (Default: docs fail, AI flags)</option>
                    <option value="fail">Fail (Test fail, secret risk)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Fail AI Verification</span>
                  <button
                    type="button"
                    onClick={() => setFailAiVerification(!mockState.failAiVerification)}
                    className={`px-2 py-0.5 text-xs rounded font-medium border cursor-pointer ${mockState.failAiVerification
                      ? 'bg-danger text-on-primary border-danger'
                      : 'bg-surface text-text-muted border-border hover:text-text'
                      }`}
                  >
                    {mockState.failAiVerification ? 'Failing (503)' : 'Normal'}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <button
                    type="button"
                    onClick={triggerFailNextRelease}
                    className={`px-2 py-1 text-xs rounded border cursor-pointer font-medium ${mockState.failNextRelease
                      ? 'bg-warning/20 text-warning border-warning'
                      : 'bg-surface text-text-muted border-border hover:text-text'
                      }`}
                  >
                    {mockState.failNextRelease ? 'Next Release Will Fail (503)' : 'Fail Next Release (503)'}
                  </button>
                  <button
                    type="button"
                    onClick={resetReview}
                    className="px-2 py-1 text-xs rounded border border-border bg-surface text-text-muted hover:text-text cursor-pointer"
                  >
                    Reset Review State
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Section 3: Realtime Controls */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <Radio className="w-4 h-4 text-success" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Realtime & Events
              </h3>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-md bg-surface-raised/50 border border-border text-xs">
              <span className="text-text-muted">Connection Status:</span>
              <span className="font-mono font-bold capitalize text-primary">
                {realtimeStatus}
              </span>
            </div>

            {env.VITE_USE_MOCKS && (
              <div className="space-y-2.5 pt-1">
                <div className="flex gap-2">
                  <select
                    value={selectedEventType}
                    onChange={(e) => setSelectedEventType(e.target.value)}
                    className="flex-1 text-xs rounded-md bg-surface border border-border px-3 py-1.5 text-text focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <option value="project.posted">project.posted</option>
                    <option value="user.registered">user.registered</option>
                    <option value="project.status_changed">project.status_changed</option>
                    <option value="payment.held">payment.held</option>
                    <option value="payment.released">payment.released</option>
                    <option value="task.assigned">task.assigned</option>
                    <option value="service.degraded">service.degraded</option>
                    <option value="submission.status_changed">submission.status_changed</option>
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => emitTestEvent(selectedEventType)}
                    className="text-xs whitespace-nowrap"
                  >
                    Emit test event
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dropConnection(5000)}
                  className="w-full text-xs"
                >
                  Drop connection (5 s)
                </Button>
              </div>
            )}
          </section>

          {/* Section 4: API Calls Log */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  API Call Log (Last 20)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => callLog.clear()}
                className="text-xs text-text-muted hover:text-text cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">
                  No requests captured yet
                </div>
              ) : (
                logs.map((log) => {
                  const isErr = log.status >= 400;
                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-md bg-surface-raised/40 border border-border text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-primary">{log.method}</span>
                          <span className="truncate max-w-[180px] sm:max-w-[220px]" title={log.path}>
                            {log.path}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isErr
                              ? 'bg-danger/20 text-danger border border-danger/40'
                              : 'bg-success/20 text-success border border-success/40'
                              }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-text-muted text-[11px]">{log.ms}ms</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-text-muted font-mono pt-0.5">
                        <span className="truncate max-w-[260px]" title={log.correlationId}>
                          {log.correlationId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(log.correlationId, log.id)}
                          title="Copy Correlation ID"
                          className="p-1 rounded hover:bg-surface text-text-muted hover:text-text cursor-pointer"
                        >
                          {copiedId === log.id ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
