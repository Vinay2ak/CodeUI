import { SubmissionStatus, PaymentState } from './types';

export interface RunSummary {
  status: 'running' | 'completed' | 'failed_to_run';
  requiredFailed: number;
  requiredTotal: number;
}

export interface DecisionGuardParams {
  projectStatus?: string;
  submissionStatus: SubmissionStatus;
  paymentState: PaymentState;
  run: RunSummary | null;
}

export interface DecisionGuardResult {
  canApprove: boolean;
  canRequestChanges: boolean;
  needsAcknowledgment: boolean;
  reasons: string[];
}

/**
 * Pure decision guard calculation.
 * Note: AI verification data is deliberately NOT a parameter or input to this function.
 */
export function computeDecisionGuard(params: DecisionGuardParams): DecisionGuardResult {
  const { submissionStatus, paymentState, run } = params;
  const reasons: string[] = [];

  let canApprove = false;
  let canRequestChanges = false;
  let needsAcknowledgment = false;

  // Status checks
  if (submissionStatus === 'none') {
    reasons.push("Waiting for the developer's submission.");
    return { canApprove: false, canRequestChanges: false, needsAcknowledgment: false, reasons };
  }

  if (submissionStatus === 'changes_requested') {
    reasons.push("Waiting for the developer to resubmit.");
    return { canApprove: false, canRequestChanges: false, needsAcknowledgment: false, reasons };
  }

  if (submissionStatus === 'approved') {
    reasons.push('This submission was already decided.');
    return { canApprove: false, canRequestChanges: false, needsAcknowledgment: false, reasons };
  }

  // When submissionStatus is in_review:
  if (submissionStatus === 'in_review') {
    canRequestChanges = true;

    // Approving also requires paymentState to be "held" or "release_pending"
    const isPaymentHeld = paymentState === 'held' || paymentState === 'release_pending';
    if (!isPaymentHeld) {
      reasons.push('Payment is not held in escrow.');
      canApprove = false;
    } else {
      canApprove = true;
    }

    // needsAcknowledgment is true when run is null, run.status is not "completed", or requiredFailed > 0
    if (!run) {
      needsAcknowledgment = true;
    } else if (run.status !== 'completed') {
      needsAcknowledgment = true;
    } else if (run.requiredFailed > 0) {
      needsAcknowledgment = true;
    }
  }

  return {
    canApprove,
    canRequestChanges,
    needsAcknowledgment,
    reasons,
  };
}
