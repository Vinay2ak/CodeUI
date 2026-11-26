import React, { useState, useEffect, useRef } from 'react';
import {
  CurrentSubmission,
  AutomatedRun,
  AiVerificationReport,
  ProjectPayment,
} from '../types';
import { formatInr, shortSha } from '../format';
import { Button } from '../../../components/ui/button';
import { reviewApi } from '../../../services/review/api';
import { paymentApi } from '../../../services/payment/api';
import { AlertTriangle, Loader2, X, RefreshCw } from 'lucide-react';

interface ApproveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  submission: CurrentSubmission;
  run: AutomatedRun | null;
  report: AiVerificationReport | null;
  payment: ProjectPayment | null;
  needsAcknowledgment: boolean;
  onSuccess: (message: string) => void;
  onReload: () => void;
}

export const ApproveDialog: React.FC<ApproveDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  submission,
  run,
  report,
  payment,
  needsAcknowledgment,
  onSuccess,
  onReload,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [acknowledged, setAcknowledged] = useState(!needsAcknowledgment);
  const [step, setStep] = useState<'idle' | 'approving' | 'releasing' | 'step2_failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);

  // Generate stable idempotency keys for both steps
  const [k1] = useState(() => `idem-rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [k2] = useState(() => `idem-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (isOpen) {
      setAcknowledged(!needsAcknowledgment);
      setStep('idle');
      setErrorMessage(null);
      setIsConflict(false);
      // Explicitly focus Cancel button, never confirm button
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen, needsAcknowledgment]);

  // Focus trap and ESC handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Enter does NOT confirm
      if (e.key === 'Enter' && e.target !== cancelBtnRef.current) {
        e.preventDefault();
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

  const amount = payment?.amount ?? 0;
  const developer = submission.developerName;

  // Automated checks text
  let automatedChecksSummary = 'No automated results';
  if (run) {
    const failed = run.checks.filter(
      (c) => c.required && (c.status === 'failed' || c.status === 'error' || c.status === 'timed_out')
    ).length;
    if (failed === 0) {
      automatedChecksSummary = 'All required checks passed';
    } else {
      automatedChecksSummary = `${failed} required check(s) failed`;
    }
  }

  // AI review summary
  let aiReviewSummary = 'Not requested';
  if (report) {
    const met = report.criteria.filter((c) => c.status === 'met').length;
    const partial = report.criteria.filter((c) => c.status === 'partial').length;
    const notMet = report.criteria.filter((c) => c.status === 'not_met').length;
    aiReviewSummary = `${met} met, ${partial} partial, ${notMet} not met`;
  }

  const handleConfirm = async () => {
    setErrorMessage(null);
    setIsConflict(false);

    // Step 1: POST review approve
    if (step === 'idle') {
      setStep('approving');
      try {
        await reviewApi.decide(
          projectId,
          { submissionId: submission.submissionId, decision: 'approve' },
          k1
        );
      } catch (err: any) {
        const status = err?.status || err?.response?.status;
        if (status === 409) {
          setIsConflict(true);
          setErrorMessage('This submission changed. Reload to see the latest version.');
        } else if (status === 403 || status === 404) {
          setErrorMessage("You can't review this submission.");
        } else {
          setErrorMessage('The review service is unavailable. Nothing was changed.');
        }
        setStep('idle');
        return;
      }
    }

    // Step 2: POST payment release
    setStep('releasing');
    try {
      await paymentApi.releasePayment(projectId, k2);
      onSuccess(`Approved. ${formatInr(amount)} released to ${developer}.`);
      onClose();
    } catch {
      setStep('step2_failed');
      setErrorMessage('Approved. Releasing the payment failed.');
    }
  };

  const handleRetryRelease = async () => {
    setStep('releasing');
    setErrorMessage(null);
    try {
      await paymentApi.releasePayment(projectId, k2);
      onSuccess(`Approved. ${formatInr(amount)} released to ${developer}.`);
      onClose();
    } catch {
      setStep('step2_failed');
      setErrorMessage('Approved. Releasing the payment failed.');
    }
  };

  const isConfirmDisabled =
    (needsAcknowledgment && !acknowledged) ||
    step === 'approving' ||
    step === 'releasing';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approve-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 id="approve-dialog-title" className="text-lg font-bold text-text">
            Approve and release payment?
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

        {/* Definition List */}
        <dl className="grid grid-cols-2 gap-3 p-3.5 bg-surface-raised rounded-lg border border-border text-xs">
          <div>
            <dt className="text-text-muted font-medium">Developer</dt>
            <dd className="text-text font-semibold mt-0.5">{developer}</dd>
          </div>
          <div>
            <dt className="text-text-muted font-medium">Amount</dt>
            <dd className="font-mono tabular-nums text-money font-bold text-sm mt-0.5">
              {formatInr(amount)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted font-medium">Submission Version</dt>
            <dd className="text-text mt-0.5">Version {submission.version} of {submission.versionCount}</dd>
          </div>
          <div>
            <dt className="text-text-muted font-medium">Tested Commit</dt>
            <dd className="font-mono text-text mt-0.5">{shortSha(submission.commitSha)}</dd>
          </div>
          <div>
            <dt className="text-text-muted font-medium">Automated Checks</dt>
            <dd className="text-text mt-0.5">{automatedChecksSummary}</dd>
          </div>
          <div>
            <dt className="text-text-muted font-medium">AI Review</dt>
            <dd className="text-text mt-0.5">{aiReviewSummary}</dd>
          </div>
        </dl>

        <p className="text-sm text-text">
          This approves the work and moves{' '}
          <span className="font-mono font-bold text-money">{formatInr(amount)}</span> from escrow to{' '}
          <span className="font-semibold text-text">{developer}</span>. This can't be undone.
        </p>

        {/* Required Acknowledgment Checkbox */}
        {needsAcknowledgment && step !== 'step2_failed' && (
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-text select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span>I have reviewed the failed or missing checks.</span>
            </label>
          </div>
        )}

        {/* Error / Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {isConflict && (
              <Button size="sm" variant="outline" onClick={onReload}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Reload
              </Button>
            )}
            {step === 'step2_failed' && (
              <Button size="sm" variant="primary" onClick={handleRetryRelease}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Retry release
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={step === 'approving' || step === 'releasing'}
          >
            Cancel
          </Button>

          {step !== 'step2_failed' && (
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
            >
              {step === 'approving' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving…
                </>
              ) : step === 'releasing' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Releasing payment…
                </>
              ) : (
                `Approve and release ${formatInr(amount)}`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
