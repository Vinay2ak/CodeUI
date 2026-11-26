import { http, HttpResponse } from 'msw';
import { isServiceFailing, mockState, emitTestEvent } from './controls';
import {
  CurrentSubmission,
  ProjectPayment,
} from '../features/review/types';
import {
  getMockSubmission,
  getMockRun,
  getMockAiReport,
  getMockPayment,
} from './data/review';
import { initialProjects } from './data';

const MOCK_REVIEW_KEY = 'mock.review.v1';

export interface MockReviewStorage {
  submissions: Record<string, CurrentSubmission>;
  payments: Record<string, ProjectPayment>;
  aiVerificationStatus: Record<
    string,
    'not_requested' | 'running' | 'ready' | 'failed' | 'unavailable'
  >;
  aiVerificationPolls: Record<string, number>;
  idempotency: Record<string, any>;
}

export function getStoredReviewData(): MockReviewStorage {
  if (typeof sessionStorage === 'undefined') {
    return {
      submissions: {},
      payments: {},
      aiVerificationStatus: {},
      aiVerificationPolls: {},
      idempotency: {},
    };
  }
  try {
    const raw = sessionStorage.getItem(MOCK_REVIEW_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          submissions: {},
          payments: {},
          aiVerificationStatus: {},
          aiVerificationPolls: {},
          idempotency: {},
        };
  } catch {
    return {
      submissions: {},
      payments: {},
      aiVerificationStatus: {},
      aiVerificationPolls: {},
      idempotency: {},
    };
  }
}

export function saveStoredReviewData(data: MockReviewStorage): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MOCK_REVIEW_KEY, JSON.stringify(data));
  } catch {}
}

export const reviewMockHandlers = [
  // 1. GET /api/v1/projects/:id/submissions/current
  http.get('/api/v1/projects/:id/submissions/current', ({ params }) => {
    if (isServiceFailing('review')) {
      return new HttpResponse(
        JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Review service is unavailable.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const projectId = String(params.id);
    const storage = getStoredReviewData();

    if (storage.submissions[projectId]) {
      return HttpResponse.json(storage.submissions[projectId]);
    }

    // Check project status in initialProjects
    const project = initialProjects.find((p) => p.id === projectId);
    if (project && project.status !== 'in_review' && project.status !== 'completed') {
      const emptySubmission: CurrentSubmission = {
        submissionId: '',
        version: 0,
        versionCount: 0,
        status: 'none',
        submittedAt: new Date().toISOString(),
        developerName: project.freelancerName || 'Developer',
        summary: '',
        notes: '',
        commitSha: '',
        feedback: null,
        decidedAt: null,
      };
      return HttpResponse.json(emptySubmission);
    }

    const defaultSubmission = getMockSubmission();
    return HttpResponse.json(defaultSubmission);
  }),

  // 2. POST /api/v1/projects/:id/review
  http.post('/api/v1/projects/:id/review', async ({ params, request }) => {
    if (isServiceFailing('review')) {
      return new HttpResponse(
        JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Review service is unavailable.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const projectId = String(params.id);
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const storage = getStoredReviewData();

    if (idempotencyKey && storage.idempotency[idempotencyKey]) {
      return HttpResponse.json(storage.idempotency[idempotencyKey]);
    }

    const body = (await request.json()) as any;
    const { submissionId, decision, feedback, flaggedItems } = body || {};

    const currentSub = storage.submissions[projectId] || getMockSubmission();

    if (currentSub.status === 'approved' || currentSub.status === 'changes_requested') {
      return new HttpResponse(
        JSON.stringify({
          code: 'CONFLICT',
          message: 'The submission changed or was already decided.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (decision === 'approve') {
      const updated: CurrentSubmission = {
        ...currentSub,
        status: 'approved',
        decidedAt: new Date().toISOString(),
      };
      storage.submissions[projectId] = updated;

      const resBody = { submissionId, status: 'approved' as const };
      if (idempotencyKey) {
        storage.idempotency[idempotencyKey] = resBody;
      }
      saveStoredReviewData(storage);

      emitTestEvent('submission.status_changed', {
        projectId,
        submissionId,
        status: 'approved',
      });

      return HttpResponse.json(resBody);
    }

    if (decision === 'changes_requested') {
      const updated: CurrentSubmission = {
        ...currentSub,
        status: 'changes_requested',
        feedback: feedback || null,
        decidedAt: new Date().toISOString(),
      };
      storage.submissions[projectId] = updated;

      const resBody = { submissionId, status: 'changes_requested' as const };
      if (idempotencyKey) {
        storage.idempotency[idempotencyKey] = resBody;
      }
      saveStoredReviewData(storage);

      emitTestEvent('submission.status_changed', {
        projectId,
        submissionId,
        status: 'changes_requested',
        feedback,
        flaggedItems,
      });

      return HttpResponse.json(resBody);
    }

    return new HttpResponse(
      JSON.stringify({ code: 'UNPROCESSABLE_ENTITY', message: 'Invalid review decision.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }),

  // 3. GET /api/v1/submissions/:id/automated-run
  http.get('/api/v1/submissions/:id/automated-run', () => {
    if (isServiceFailing('verification')) {
      return new HttpResponse(
        JSON.stringify({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Verification service is unavailable.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const run = getMockRun(mockState.reviewScenario);
    return HttpResponse.json(run);
  }),

  // 4. GET /api/v1/submissions/:id/automated-run/checks/:checkId/log
  http.get('/api/v1/submissions/:id/automated-run/checks/:checkId/log', ({ params }) => {
    if (isServiceFailing('verification')) {
      return new HttpResponse(
        JSON.stringify({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Verification service is unavailable.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const checkId = String(params.checkId);
    const run = getMockRun(mockState.reviewScenario);
    const check = run.checks.find((c) => c.id === checkId);

    if (!check) {
      return new HttpResponse(
        JSON.stringify({ code: 'NOT_FOUND', message: 'Check not found.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const lines = check.logTail ? check.logTail.split('\n') : [];
    return HttpResponse.json({
      lines,
      truncated: check.logTruncated,
    });
  }),

  // 5. GET /api/v1/submissions/:id/ai-verification
  http.get('/api/v1/submissions/:id/ai-verification', ({ params }) => {
    if (isServiceFailing('review')) {
      return new HttpResponse(
        JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Review service is unavailable.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (mockState.failAiVerification) {
      return HttpResponse.json({
        status: 'failed',
        report: null,
        error: {
          code: 'AI_VERIFICATION_FAILED',
          message: 'AI verification service is unavailable right now.',
        },
      });
    }

    const submissionId = String(params.id);
    const storage = getStoredReviewData();

    const currentStatus = storage.aiVerificationStatus[submissionId] || 'not_requested';

    if (currentStatus === 'not_requested') {
      return HttpResponse.json({
        status: 'not_requested',
        report: null,
        error: null,
      });
    }

    if (currentStatus === 'running') {
      const polls = (storage.aiVerificationPolls[submissionId] || 0) + 1;
      storage.aiVerificationPolls[submissionId] = polls;

      if (polls >= 2) {
        storage.aiVerificationStatus[submissionId] = 'ready';
        saveStoredReviewData(storage);
        return HttpResponse.json({
          status: 'ready',
          report: getMockAiReport(mockState.reviewScenario),
          error: null,
        });
      }

      saveStoredReviewData(storage);
      return HttpResponse.json({
        status: 'running',
        report: null,
        error: null,
      });
    }

    // status === 'ready'
    return HttpResponse.json({
      status: 'ready',
      report: getMockAiReport(mockState.reviewScenario),
      error: null,
    });
  }),

  // 6. POST /api/v1/submissions/:id/ai-verification
  http.post('/api/v1/submissions/:id/ai-verification', ({ params }) => {
    if (isServiceFailing('review')) {
      return new HttpResponse(
        JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Review service is unavailable.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const submissionId = String(params.id);
    const storage = getStoredReviewData();

    storage.aiVerificationStatus[submissionId] = 'running';
    storage.aiVerificationPolls[submissionId] = 0;
    saveStoredReviewData(storage);

    return new HttpResponse(JSON.stringify({ status: 'running' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }),

  // 7. GET /api/v1/projects/:id/payment
  http.get('/api/v1/projects/:id/payment', ({ params }) => {
    if (isServiceFailing('payment')) {
      return new HttpResponse(
        JSON.stringify({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Payment service is unavailable.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const projectId = String(params.id);
    const storage = getStoredReviewData();

    if (storage.payments[projectId]) {
      return HttpResponse.json(storage.payments[projectId]);
    }

    const defaultPayment = getMockPayment();
    return HttpResponse.json(defaultPayment);
  }),

  // 8. POST /api/v1/projects/:id/payment/release
  http.post('/api/v1/projects/:id/payment/release', ({ params, request }) => {
    if (isServiceFailing('payment')) {
      return new HttpResponse(
        JSON.stringify({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Payment service is unavailable.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (mockState.failNextRelease) {
      mockState.failNextRelease = false;
      return new HttpResponse(
        JSON.stringify({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Approved. Releasing the payment failed.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const projectId = String(params.id);
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const storage = getStoredReviewData();

    if (idempotencyKey && storage.idempotency[idempotencyKey]) {
      return HttpResponse.json(storage.idempotency[idempotencyKey]);
    }

    const currentSub = storage.submissions[projectId] || getMockSubmission();
    if (currentSub.status !== 'approved') {
      return new HttpResponse(
        JSON.stringify({
          code: 'CONFLICT',
          message: 'Project must be approved before payment release.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payment: ProjectPayment = {
      ...(storage.payments[projectId] || getMockPayment()),
      state: 'released',
    };
    storage.payments[projectId] = payment;

    // Update in-memory project status to completed
    const proj = initialProjects.find((p) => p.id === projectId);
    if (proj) {
      proj.status = 'completed';
    }

    const resBody = { state: 'released' as const };
    if (idempotencyKey) {
      storage.idempotency[idempotencyKey] = resBody;
    }
    saveStoredReviewData(storage);

    emitTestEvent('payment.released', {
      paymentId: 'pay-webhook-1',
      projectTitle: proj ? proj.title : 'Fix duplicate payment webhook retries',
      amount: payment.amount,
    });

    return HttpResponse.json(resBody);
  }),
];
