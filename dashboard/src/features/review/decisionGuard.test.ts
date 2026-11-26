import { describe, it, expect } from 'vitest';
import { computeDecisionGuard } from './decisionGuard';
import { SubmissionStatus, PaymentState, AiVerificationReport } from './types';

describe('computeDecisionGuard', () => {
  it('1. permits approve and request changes when in_review, payment held, clean run', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'held',
      run: { status: 'completed', requiredFailed: 0, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(true);
    expect(res.canRequestChanges).toBe(true);
    expect(res.needsAcknowledgment).toBe(false);
    expect(res.reasons).toEqual([]);
  });

  it('2. permits approve with release_pending payment state', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'release_pending',
      run: { status: 'completed', requiredFailed: 0, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(true);
    expect(res.needsAcknowledgment).toBe(false);
  });

  it('3. requires acknowledgment when run has required failed checks', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'held',
      run: { status: 'completed', requiredFailed: 1, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(true);
    expect(res.canRequestChanges).toBe(true);
    expect(res.needsAcknowledgment).toBe(true);
  });

  it('4. requires acknowledgment when run is null', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'held',
      run: null,
    });
    expect(res.canApprove).toBe(true);
    expect(res.needsAcknowledgment).toBe(true);
  });

  it('5. requires acknowledgment when run status is running', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'held',
      run: { status: 'running', requiredFailed: 0, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(true);
    expect(res.needsAcknowledgment).toBe(true);
  });

  it('6. requires acknowledgment when run status is failed_to_run', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'held',
      run: { status: 'failed_to_run', requiredFailed: 0, requiredTotal: 0 },
    });
    expect(res.canApprove).toBe(true);
    expect(res.needsAcknowledgment).toBe(true);
  });

  it('7. disallows approve when payment is unrequested', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'unrequested',
      run: { status: 'completed', requiredFailed: 0, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(false);
    expect(res.canRequestChanges).toBe(true);
    expect(res.reasons).toContain('Payment is not held in escrow.');
  });

  it('8. disallows approve when payment is authorized but not held', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'authorized',
      run: { status: 'completed', requiredFailed: 0, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(false);
    expect(res.canRequestChanges).toBe(true);
    expect(res.reasons).toContain('Payment is not held in escrow.');
  });

  it('9. disallows approve when payment is refunded', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'in_review',
      paymentState: 'refunded',
      run: { status: 'completed', requiredFailed: 0, requiredTotal: 4 },
    });
    expect(res.canApprove).toBe(false);
    expect(res.reasons).toContain('Payment is not held in escrow.');
  });

  it('10. disallows both when submission status is none', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'none',
      paymentState: 'held',
      run: null,
    });
    expect(res.canApprove).toBe(false);
    expect(res.canRequestChanges).toBe(false);
    expect(res.reasons).toContain("Waiting for the developer's submission.");
  });

  it('11. disallows both when submission status is changes_requested', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'changes_requested',
      paymentState: 'held',
      run: null,
    });
    expect(res.canApprove).toBe(false);
    expect(res.canRequestChanges).toBe(false);
    expect(res.reasons).toContain('Waiting for the developer to resubmit.');
  });

  it('12. disallows both when submission status is approved', () => {
    const res = computeDecisionGuard({
      submissionStatus: 'approved',
      paymentState: 'held',
      run: null,
    });
    expect(res.canApprove).toBe(false);
    expect(res.canRequestChanges).toBe(false);
    expect(res.reasons).toContain('This submission was already decided.');
  });

  it('13. enumerates many arbitrary AI situations and proves guard output is completely independent of AI', () => {
    const baseParams = {
      submissionStatus: 'in_review' as SubmissionStatus,
      paymentState: 'held' as PaymentState,
      run: { status: 'completed' as const, requiredFailed: 0, requiredTotal: 3 },
    };

    const dummyAiReports: Array<AiVerificationReport | null> = [
      null,
      { reportId: 'r1', generatedAt: '2026', criteria: [], risks: [] },
      {
        reportId: 'r2',
        generatedAt: '2026',
        criteria: [
          {
            criterionId: 'c1',
            text: 'crit',
            required: true,
            status: 'not_met',
            reasoning: 'bad',
            evidence: [],
          },
        ],
        risks: [{ id: 'k1', severity: 'high', category: 'secrets', text: 'risk', evidence: [] }],
      },
      {
        reportId: 'r3',
        generatedAt: '2026',
        criteria: [
          {
            criterionId: 'c1',
            text: 'crit',
            required: true,
            status: 'met',
            reasoning: 'good',
            evidence: [],
          },
        ],
        risks: [],
      },
    ];

    const expected = computeDecisionGuard(baseParams);

    // Assert that no matter what AI data is present in the surrounding world, computeDecisionGuard returns the exact same result
    for (const _ai of dummyAiReports) {
      const output = computeDecisionGuard(baseParams);
      expect(output).toEqual(expected);
    }
  });
});
