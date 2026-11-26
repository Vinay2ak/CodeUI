import React, { useState, useEffect, useRef } from 'react';
import {
  CurrentSubmission,
  AutomatedRun,
  AiVerificationReport,
} from '../types';
import { Button } from '../../../components/ui/button';
import { reviewApi } from '../../../services/review/api';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  submission: CurrentSubmission;
  run: AutomatedRun | null;
  report: AiVerificationReport | null;
  onSuccess: (message: string) => void;
}

interface FlagItem {
  id: string;
  label: string;
  type: 'check' | 'criterion';
}

export const ChangesDialog: React.FC<ChangesDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  submission,
  run,
  report,
  onSuccess,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [feedback, setFeedback] = useState('');
  const [flaggedMap, setFlaggedMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute prefilled items
  const flaggedItems: FlagItem[] = [];

  if (run) {
    for (const c of run.checks) {
      if (c.required && (c.status === 'failed' || c.status === 'error' || c.status === 'timed_out')) {
        flaggedItems.push({
          id: `check:${c.id}`,
          label: `Automated Check Failed: ${c.command}`,
          type: 'check',
        });
      }
    }
  }

  if (report) {
    for (const c of report.criteria) {
      if (c.status === 'partial' || c.status === 'not_met') {
        flaggedItems.push({
          id: `criterion:${c.criterionId}`,
          label: `Unsatisfied Acceptance Criterion: ${c.text}`,
          type: 'criterion',
        });
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      setFeedback('');
      setError(null);
      setIsSubmitting(false);

      // Prefill all checklist items to true by default
      const initialMap: Record<string, boolean> = {};
      for (const item of flaggedItems) {
        initialMap[item.id] = true;
      }
      setFlaggedMap(initialMap);

      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Focus trap and ESC handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Tab trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleFlag = (id: string) => {
    setFlaggedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const trimmedLength = feedback.trim().length;
  const isValidLength = trimmedLength >= 10 && trimmedLength <= 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLength || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const checkedItemIds = Object.keys(flaggedMap).filter((k) => flaggedMap[k]);
    const idempotencyKey = `idem-changes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await reviewApi.decide(
        projectId,
        {
          submissionId: submission.submissionId,
          decision: 'changes_requested',
          feedback: feedback.trim(),
          flaggedItems: checkedItemIds,
        },
        idempotencyKey
      );

      onSuccess('Changes requested successfully.');
      onClose();
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 409) {
        setError('This submission changed or was already decided. Please reload.');
      } else {
        setError('Failed to submit requested changes. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="changes-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 id="changes-dialog-title" className="text-lg font-bold text-text">
            Request changes
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-text-muted hover:text-text cursor-pointer p-1 rounded hover:bg-surface-raised"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="changes-feedback-input" className="text-sm font-semibold text-text block">
              What needs to change? <span className="text-danger">*</span>
            </label>
            <textarea
              id="changes-feedback-input"
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe the issues or unmet requirements for the developer to address..."
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Must be between 10 and 1000 characters.</span>
              <span className={`font-mono ${trimmedLength < 10 || trimmedLength > 1000 ? 'text-warning font-semibold' : ''}`}>
                {trimmedLength} / 1000
              </span>
            </div>
          </div>

          {/* Prefilled Flag Checklist */}
          {flaggedItems.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-text uppercase tracking-wider block">
                Include in your feedback
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2.5 bg-surface-raised rounded-lg border border-border">
                {flaggedItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 text-xs text-text cursor-pointer select-none hover:bg-surface/50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={!!flaggedMap[item.id]}
                      onChange={() => handleToggleFlag(item.id)}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="font-medium leading-snug">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              ref={cancelBtnRef}
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={!isValidLength || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending feedback…
                </>
              ) : (
                'Send feedback and request changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
