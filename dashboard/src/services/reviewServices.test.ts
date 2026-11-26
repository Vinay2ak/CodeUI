import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { reviewApi } from './review/api';
import { verificationApi } from './verification/api';
import { paymentApi } from './payment/api';
import { resetReview, triggerFailNextRelease, setServiceFailing } from '../mocks/controls';

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  resetReview();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('Phase 2 Review and Verification Services and Mocks', () => {
  it('1. fetches current submission for an in_review project', async () => {
    const sub = await reviewApi.getCurrentSubmission('proj-1');
    expect(sub.submissionId).toBe('sub-webhook-2026');
    expect(sub.version).toBe(2);
    expect(sub.status).toBe('in_review');
    expect(sub.developerName).toBe('Ravi Freelancer');
    expect(sub.commitSha.length).toBe(40);
  });

  it('2. fetches automated run and check logs', async () => {
    const run = await verificationApi.getAutomatedRun('sub-webhook-2026');
    expect(run).not.toBeNull();
    expect(run?.checks.length).toBeGreaterThanOrEqual(4);
    expect(run?.diff.files.length).toBeGreaterThanOrEqual(2);

    const logRes = await verificationApi.getCheckLog('sub-webhook-2026', 'chk-test');
    expect(logRes.lines.length).toBeGreaterThan(0);
    // Secrets in log must be redacted by adapter
    for (const line of logRes.lines) {
      expect(line).not.toContain('eyJhbGciOi');
    }
  });

  it('3. requests AI verification and polls until ready', async () => {
    await reviewApi.requestAiVerification('sub-webhook-2026', 'idem-ai-1');

    // Poll 1: running
    const poll1 = await reviewApi.getAiVerification('sub-webhook-2026');
    expect(poll1.status).toBe('running');

    // Poll 2: ready
    const poll2 = await reviewApi.getAiVerification('sub-webhook-2026');
    expect(poll2.status).toBe('ready');
    expect(poll2.report).not.toBeNull();
    expect(poll2.report?.criteria.length).toBeGreaterThan(0);
  });

  it('4. approves submission and releases payment via paymentApi', async () => {
    // Attempt release before approval -> expects 409
    await expect(paymentApi.releasePayment('proj-1', 'idem-pay-fail')).rejects.toThrow();

    // Approve submission
    const res = await reviewApi.decide(
      'proj-1',
      { submissionId: 'sub-webhook-2026', decision: 'approve' },
      'idem-rev-1'
    );
    expect(res.status).toBe('approved');

    // Fetch updated submission
    const updatedSub = await reviewApi.getCurrentSubmission('proj-1');
    expect(updatedSub.status).toBe('approved');

    // Now release payment
    const payRes = await paymentApi.releasePayment('proj-1', 'idem-pay-1');
    expect(payRes.state).toBe('released');

    // Fetch project payment
    const payment = await paymentApi.getProjectPayment('proj-1');
    expect(payment.state).toBe('released');
    expect(payment.amount).toBe(4500);
  });

  it('5. handles failNextRelease correctly', async () => {
    // Approve first
    await reviewApi.decide(
      'proj-1',
      { submissionId: 'sub-webhook-2026', decision: 'approve' },
      'idem-rev-fail-1'
    );

    // Trigger next release failure
    triggerFailNextRelease();

    // Attempt release -> fails with 503
    await expect(paymentApi.releasePayment('proj-1', 'idem-fail-next')).rejects.toThrow();

    // Next retry succeeds
    const retryRes = await paymentApi.releasePayment('proj-1', 'idem-fail-retry');
    expect(retryRes.state).toBe('released');
  });

  it('6. handles requesting changes with feedback', async () => {
    const res = await reviewApi.decide(
      'proj-1',
      {
        submissionId: 'sub-webhook-2026',
        decision: 'changes_requested',
        feedback: 'Please fix retry limit cap in app/retry.py',
        flaggedItems: ['chk-docs', 'crit-2'],
      },
      'idem-changes-1'
    );
    expect(res.status).toBe('changes_requested');

    const sub = await reviewApi.getCurrentSubmission('proj-1');
    expect(sub.status).toBe('changes_requested');
    expect(sub.feedback).toContain('Please fix retry limit cap');
  });

  it('7. isolates service down errors (503)', async () => {
    setServiceFailing('verification', true);
    await expect(verificationApi.getAutomatedRun('sub-webhook-2026')).rejects.toThrow();
    setServiceFailing('verification', false);

    setServiceFailing('review', true);
    await expect(reviewApi.getCurrentSubmission('proj-1')).rejects.toThrow();
    setServiceFailing('review', false);

    setServiceFailing('payment', true);
    await expect(paymentApi.getProjectPayment('proj-1')).rejects.toThrow();
    setServiceFailing('payment', false);
  });
});
