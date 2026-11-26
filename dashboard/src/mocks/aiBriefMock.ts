import { http, HttpResponse } from 'msw';
import { isServiceFailing, mockState, emitTestEvent } from './controls';
import type { ProjectDetail } from '../services/project/types';
import type { AiDeveloperBrief, ConfirmedBrief, RepoStatusResponse } from '../features/ai-brief/types';
import { adaptConfirmedBrief } from '../features/ai-brief/adapters';
import { sizeFromBudget } from '../features/post-project/size';

const MOCK_AI_KEY = 'mock.ai.v1';
const PROJECTS_KEY = 'mock.projects.v1';

export interface StoredJob {
  jobId: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  stage: 'fetching_tree' | 'selecting_files' | 'structuring_brief' | null;
  startedAt: string;
  inputsHash: string;
  scenario: 'ok' | 'slow' | 'fail';
  extraDelayMs: number;
}

export interface MockAiStorage {
  briefs: Record<string, ConfirmedBrief>;
  jobs: Record<string, StoredJob>;
  github: Record<
    string,
    {
      status: 'not_connected' | 'pending' | 'connected' | 'error' | 'revoked';
      repo: any | null;
      authorizeUrl?: string | null;
      error?: { code: string; message: string } | null;
      statusPollCount?: number;
    }
  >;
}

export function getStoredAiData(): MockAiStorage {
  if (typeof sessionStorage === 'undefined') {
    return { briefs: {}, jobs: {}, github: {} };
  }
  try {
    const raw = sessionStorage.getItem(MOCK_AI_KEY);
    return raw ? JSON.parse(raw) : { briefs: {}, jobs: {}, github: {} };
  } catch {
    return { briefs: {}, jobs: {}, github: {} };
  }
}

export function saveStoredAiData(data: MockAiStorage): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MOCK_AI_KEY, JSON.stringify(data));
  } catch {}
}

function getStoredProjects(): ProjectDetail[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredProjects(projects: ProjectDetail[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {}
}

function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateMockBrief(
  project: Partial<ProjectDetail> | null,
  commitSha = '4a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
  jobId = `job-${Date.now()}`
): AiDeveloperBrief {
  const title = project?.title || 'Payment Webhook Processing';
  const text = `${title} ${project?.description || ''} ${(project?.stacks || []).join(' ')}`.toLowerCase();

  if (text.includes('auth') || text.includes('jwt') || text.includes('token') || text.includes('login')) {
    return {
      briefId: `brief-${jobId}`,
      generatedAt: new Date().toISOString(),
      repoCommitSha: commitSha,
      problemSummary: `Analysis for "${title}": Token verification middleware does not properly reject expired signatures in edge cases.`,
      suspectedFiles: [
        { path: 'app/auth/jwt.py', startLine: 12, endLine: 45, reason: 'Clock skew tolerance too high in JWT validation', verified: true },
        { path: 'app/auth/deps.py', startLine: 18, endLine: 60, reason: 'Missing revocation check against active blacklist', verified: true },
        { path: 'tests/test_auth.py', startLine: 1, endLine: 40, reason: 'Expiry test suites pass expired mocks unconditionally', verified: true },
        { path: 'app/auth/legacy_tokens.py', startLine: null, endLine: null, reason: 'Legacy fallback path remains in production router', verified: false },
      ],
      rootCauseHypothesis: 'Expired token verification uses system clock without ntp synchronization checks.',
      stepByStepPlan: [
        { id: 'step-1', text: 'Enforce strict exp claim verification in JWT decode' },
        { id: 'step-2', text: 'Add token revocation cache lookup in dependency injector' },
        { id: 'step-3', text: 'Remove deprecated legacy auth fallback endpoints' },
        { id: 'step-4', text: 'Write regression test for expired token returns 401' },
        { id: 'step-5', text: 'Update auth middleware documentation' },
      ],
      acceptanceCriteria: [
        { id: 'crit-1', text: 'Expired JWTs return 401 Unauthorized immediately', required: true, source: 'ai' },
        { id: 'crit-2', text: 'Revoked tokens cannot access protected routes', required: true, source: 'ai' },
        { id: 'crit-3', text: 'Valid tokens authenticate in under 10ms', required: true, source: 'ai' },
        { id: 'crit-4', text: 'Token refresh flow preserves user session claims', required: true, source: 'ai' },
        { id: 'crit-5', text: 'Auth middleware test coverage exceeds 90%', required: false, source: 'ai' },
      ],
    };
  }

  if (text.includes('ci') || text.includes('test') || text.includes('workflow') || text.includes('pipeline')) {
    return {
      briefId: `brief-${jobId}`,
      generatedAt: new Date().toISOString(),
      repoCommitSha: commitSha,
      problemSummary: `Analysis for "${title}": Continuous integration pipeline fails intermittently during database migration steps.`,
      suspectedFiles: [
        { path: '.github/workflows/ci.yml', startLine: 10, endLine: 50, reason: 'PostgreSQL service healthcheck timeout too short', verified: true },
        { path: 'tests/conftest.py', startLine: 5, endLine: 30, reason: 'Test database fixtures do not wait for port readiness', verified: true },
        { path: 'tests/e2e/runner.py', startLine: 20, endLine: 65, reason: 'Parallel runners collision on shared schema name', verified: true },
        { path: 'scripts/legacy_test.sh', startLine: null, endLine: null, reason: 'Legacy shell runner contains hardcoded ports', verified: false },
      ],
      rootCauseHypothesis: 'Race condition between database container startup and migration runner execution.',
      stepByStepPlan: [
        { id: 'step-1', text: 'Add pg_isready polling step in ci workflow service definition' },
        { id: 'step-2', text: 'Configure isolated database schemas per test worker thread' },
        { id: 'step-3', text: 'Add retry handler to migration connection initiator' },
        { id: 'step-4', text: 'Remove deprecated legacy test shell script' },
        { id: 'step-5', text: 'Validate clean CI pass across 5 concurrent test runs' },
      ],
      acceptanceCriteria: [
        { id: 'crit-1', text: 'CI workflow completes cleanly with zero flaky database errors', required: true, source: 'ai' },
        { id: 'crit-2', text: 'Migration runner waits up to 30 seconds for database readiness', required: true, source: 'ai' },
        { id: 'crit-3', text: 'Parallel test runners execute on isolated schemas', required: true, source: 'ai' },
        { id: 'crit-4', text: 'All existing test suites pass without regressions', required: true, source: 'ai' },
        { id: 'crit-5', text: 'CI runtime remains under 4 minutes', required: false, source: 'ai' },
      ],
    };
  }

  // Webhook / Payment (Default match for webhook, payment, fastapi, or generic)
  return {
    briefId: `brief-${jobId}`,
    generatedAt: new Date().toISOString(),
    repoCommitSha: commitSha,
    problemSummary: `Analysis for "${title}": Duplicate webhook deliveries can result in double processing and state inconsistency.`,
    suspectedFiles: [
      {
        path: 'app/webhooks.py',
        startLine: 34,
        endLine: 71,
        reason: 'Missing idempotency check prior to dispatching state transition event',
        verified: true,
      },
      {
        path: 'app/retry.py',
        startLine: 5,
        endLine: 22,
        reason: 'Linear backoff causes server stampedes under high delivery volume',
        verified: true,
      },
      {
        path: 'app/state_machine.py',
        startLine: 10,
        endLine: 40,
        reason: 'State machine allows duplicate transitions from pending state',
        verified: true,
      },
      {
        path: 'tests/test_webhooks.py',
        startLine: 1,
        endLine: 60,
        reason: 'Missing assertions for concurrent duplicate webhook payloads',
        verified: true,
      },
      {
        path: 'app/legacy/handlers.py',
        startLine: null,
        endLine: null,
        reason: 'Deprecated event handler path referenced in legacy config',
        verified: false,
      },
    ],
    rootCauseHypothesis: 'Non-atomic check-then-insert logic in webhook handler allows parallel requests with the same event ID to bypass deduplication checks.',
    stepByStepPlan: [
      { id: 'step-1', text: 'Add idempotency key table with unique database constraint' },
      { id: 'step-2', text: 'Wrap event processing inside an atomic database transaction' },
      { id: 'step-3', text: 'Implement exponential backoff with jitter in retry policy' },
      { id: 'step-4', text: 'Verify payment state machine rejects duplicate transitions' },
      { id: 'step-5', text: 'Add concurrent webhook delivery test cases in tests/test_webhooks.py' },
    ],
    acceptanceCriteria: [
      { id: 'crit-1', text: 'Duplicate webhook events are processed only once', required: true, source: 'ai' },
      { id: 'crit-2', text: 'Retries use exponential backoff and stop after 5 attempts', required: true, source: 'ai' },
      { id: 'crit-3', text: 'An invalid signature returns 400 and is not retried', required: true, source: 'ai' },
      { id: 'crit-4', text: 'The payment state machine still works', required: true, source: 'ai' },
      { id: 'crit-5', text: 'The README documents idempotency', required: false, source: 'ai' },
    ],
  };
}

export const aiBriefMockHandlers = [
  // PATCH /projects/:id (draft only)
  http.patch('*/api/v1/projects/:id', async ({ request, params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('project')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'SERVICE_UNAVAILABLE', detail: 'Project service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const id = String(params.id);
    const stored = getStoredProjects();
    const index = stored.findIndex((p) => p.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', detail: 'Project not found', correlationId: corrId },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const project = stored[index];
    if (project.status !== 'draft') {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Conflict', status: 409, code: 'CONFLICT', detail: 'Only draft projects can be updated.', correlationId: corrId },
        { status: 409, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const updated: ProjectDetail = {
      ...project,
      title: body.title !== undefined ? body.title : project.title,
      description: body.description !== undefined ? body.description : project.description,
      budget: body.budget !== undefined ? body.budget : project.budget,
      blockerType: body.blocker_type || body.blockerType || project.blockerType,
      stacks: body.stacks || project.stacks,
      specialties: body.specialties || project.specialties,
      skills: body.skills || body.required_skills || project.skills,
      urgency: body.urgency || project.urgency,
      repoUrl: body.repo_url !== undefined ? body.repo_url : project.repoUrl,
      verificationMode: body.verification_mode || body.verificationMode || project.verificationMode,
      size: body.budget ? sizeFromBudget(body.budget).value : project.size,
      updatedAt: new Date().toISOString(),
    };

    stored[index] = updated;
    saveStoredProjects(stored);

    return HttpResponse.json(updated, { status: 200, headers: { 'X-Correlation-Id': corrId } });
  }),

  // POST /projects/:id/publish
  http.post('*/api/v1/projects/:id/publish', async ({ params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('project')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'SERVICE_UNAVAILABLE', detail: 'Project service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const id = String(params.id);
    const stored = getStoredProjects();
    const index = stored.findIndex((p) => p.id === id);
    if (index === -1) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', detail: 'Project not found', correlationId: corrId },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const project = stored[index];
    if (project.status !== 'draft') {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Conflict', status: 409, code: 'CONFLICT', detail: 'Project is already published or not a draft.', correlationId: corrId },
        { status: 409, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const published: ProjectDetail = {
      ...project,
      status: 'open',
      matchingStatus: 'computing',
      updatedAt: new Date().toISOString(),
    };

    stored[index] = published;
    saveStoredProjects(stored);

    emitTestEvent('project.posted', {
      projectId: published.id,
      title: published.title,
      budget: published.budget,
    });

    return HttpResponse.json(published, { status: 200, headers: { 'X-Correlation-Id': corrId } });
  }),

  // PUT /projects/:id/brief
  http.put('*/api/v1/projects/:id/brief', async ({ request, params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('project')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'SERVICE_UNAVAILABLE', detail: 'Project service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const id = String(params.id);
    const body = await request.json();
    const brief = adaptConfirmedBrief(body);

    const aiData = getStoredAiData();
    aiData.briefs[id] = brief;
    saveStoredAiData(aiData);

    return HttpResponse.json(brief, { status: 200, headers: { 'X-Correlation-Id': corrId } });
  }),

  // GET /projects/:id/brief
  http.get('*/api/v1/projects/:id/brief', async ({ params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('project')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'SERVICE_UNAVAILABLE', detail: 'Project service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const id = String(params.id);
    const aiData = getStoredAiData();
    const brief = aiData.briefs[id];

    if (!brief) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', detail: 'No confirmed brief found for this project.', correlationId: corrId },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(brief, { status: 200, headers: { 'X-Correlation-Id': corrId } });
  }),

  // POST /projects/:id/github/connect
  http.post('*/api/v1/projects/:id/github/connect', async ({ request, params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('github')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'GITHUB_UNAVAILABLE', detail: 'GitHub service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const projectId = String(params.id);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const repoUrl = String(body.repoUrl || '');
    let res: RepoStatusResponse & { authorizeUrl?: string | null; statusPollCount?: number };

    if (repoUrl.includes('missing-repo')) {
      res = {
        status: 'error',
        repo: null,
        authorizeUrl: null,
        error: { code: 'REPO_NOT_FOUND', message: "We can't find that repository." },
      };
    } else if (repoUrl.includes('no-access')) {
      res = {
        status: 'error',
        repo: null,
        authorizeUrl: null,
        error: { code: 'ACCESS_DENIED', message: 'Access was not granted.' },
      };
    } else if (repoUrl.includes('needs-auth')) {
      res = {
        status: 'pending',
        repo: null,
        authorizeUrl: 'https://github.com/login/oauth/authorize?client_id=cb-dev',
        error: null,
        statusPollCount: 0,
      };
    } else {
      const fullName = repoUrl
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/$/, '') || 'acme/payments-api';
      res = {
        status: 'connected',
        repo: {
          fullName,
          defaultBranch: 'main',
          headCommitSha: '4a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
          private: false,
          access: 'read-only',
        },
        authorizeUrl: null,
        error: null,
      };
    }

    const aiData = getStoredAiData();
    aiData.github[projectId] = res;
    saveStoredAiData(aiData);

    return HttpResponse.json(res, { status: 200, headers: { 'X-Correlation-Id': corrId } });
  }),

  // GET /projects/:id/github/status
  http.get('*/api/v1/projects/:id/github/status', async ({ params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('github')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'GITHUB_UNAVAILABLE', detail: 'GitHub service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const projectId = String(params.id);
    const aiData = getStoredAiData();
    const stored = aiData.github[projectId];

    if (!stored) {
      return HttpResponse.json(
        { status: 'not_connected', repo: null, authorizeUrl: null, error: null },
        { status: 200, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (stored.status === 'pending') {
      const count = (stored.statusPollCount || 0) + 1;
      stored.statusPollCount = count;
      if (count >= 2) {
        stored.status = 'connected';
        stored.repo = {
          fullName: 'acme/needs-auth',
          defaultBranch: 'main',
          headCommitSha: '9e8f7a6b5c4d3e2f1a0b4a8b7c6d5e4f3a2b1c0d',
          private: false,
          access: 'read-only',
        };
        stored.authorizeUrl = null;
      }
      aiData.github[projectId] = stored;
      saveStoredAiData(aiData);
    }

    return HttpResponse.json(stored, { status: 200, headers: { 'X-Correlation-Id': corrId } });
  }),

  // POST /projects/:id/ai-brief/jobs
  http.post('*/api/v1/projects/:id/ai-brief/jobs', async ({ request, params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('codeContext')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'AI_UNAVAILABLE', detail: 'AI service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const projectId = String(params.id);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const jobId = `job-${Date.now()}`;
    const job: StoredJob = {
      jobId,
      projectId,
      status: 'queued',
      stage: null,
      startedAt: new Date().toISOString(),
      inputsHash: body.inputsHash || '',
      scenario: mockState.briefScenario || 'ok',
      extraDelayMs: mockState.briefDelayMs || 0,
    };

    const aiData = getStoredAiData();
    aiData.jobs[jobId] = job;
    saveStoredAiData(aiData);

    return HttpResponse.json({ jobId }, { status: 202, headers: { 'X-Correlation-Id': corrId } });
  }),

  // GET /projects/:id/ai-brief/jobs/:jobId
  http.get('*/api/v1/projects/:id/ai-brief/jobs/:jobId', async ({ params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('codeContext')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'AI_UNAVAILABLE', detail: 'AI service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const jobId = String(params.jobId);
    const aiData = getStoredAiData();
    const job = aiData.jobs[jobId];

    if (!job) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND', detail: 'Job not found', correlationId: corrId },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (job.status === 'cancelled') {
      return HttpResponse.json(
        { jobId, status: 'cancelled', stage: job.stage, startedAt: job.startedAt, error: null, brief: null },
        { status: 200, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    const scenario = job.scenario;

    if (scenario === 'fail') {
      if (elapsed < 400) {
        return HttpResponse.json({ jobId, status: 'queued', stage: null, startedAt: job.startedAt, error: null, brief: null });
      } else if (elapsed < 1600) {
        return HttpResponse.json({ jobId, status: 'running', stage: 'fetching_tree', startedAt: job.startedAt, error: null, brief: null });
      } else if (elapsed < 3100) {
        return HttpResponse.json({ jobId, status: 'running', stage: 'selecting_files', startedAt: job.startedAt, error: null, brief: null });
      } else {
        return HttpResponse.json({
          jobId,
          status: 'failed',
          stage: 'structuring_brief',
          startedAt: job.startedAt,
          error: { code: 'AI_TIMEOUT', message: 'The analysis timed out.', correlationId: corrId },
          brief: null,
        });
      }
    }

    if (scenario === 'slow') {
      if (elapsed < 5000) {
        return HttpResponse.json({ jobId, status: 'queued', stage: null, startedAt: job.startedAt, error: null, brief: null });
      } else if (elapsed < 16000) {
        return HttpResponse.json({ jobId, status: 'running', stage: 'fetching_tree', startedAt: job.startedAt, error: null, brief: null });
      } else if (elapsed < 28000) {
        return HttpResponse.json({ jobId, status: 'running', stage: 'selecting_files', startedAt: job.startedAt, error: null, brief: null });
      } else if (elapsed < 40000) {
        return HttpResponse.json({ jobId, status: 'running', stage: 'structuring_brief', startedAt: job.startedAt, error: null, brief: null });
      }
    }

    // Normal scenario
    if (elapsed < 400) {
      return HttpResponse.json({ jobId, status: 'queued', stage: null, startedAt: job.startedAt, error: null, brief: null });
    } else if (elapsed < 1600) {
      return HttpResponse.json({ jobId, status: 'running', stage: 'fetching_tree', startedAt: job.startedAt, error: null, brief: null });
    } else if (elapsed < 3100) {
      return HttpResponse.json({ jobId, status: 'running', stage: 'selecting_files', startedAt: job.startedAt, error: null, brief: null });
    } else if (elapsed < 4900) {
      return HttpResponse.json({ jobId, status: 'running', stage: 'structuring_brief', startedAt: job.startedAt, error: null, brief: null });
    } else {
      const stored = getStoredProjects();
      const project = stored.find((p) => p.id === job.projectId) || null;
      const ghStatus = aiData.github[job.projectId];
      const commitSha = ghStatus?.repo?.headCommitSha || '4a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';
      const brief = generateMockBrief(project, commitSha, jobId);
      return HttpResponse.json({ jobId, status: 'completed', stage: 'structuring_brief', startedAt: job.startedAt, error: null, brief });
    }
  }),

  // POST /projects/:id/ai-brief/jobs/:jobId/cancel
  http.post('*/api/v1/projects/:id/ai-brief/jobs/:jobId/cancel', async ({ params }) => {
    const corrId = generateCorrelationId();
    if (isServiceFailing('codeContext')) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Service Unavailable', status: 503, code: 'AI_UNAVAILABLE', detail: 'AI service is unavailable', correlationId: corrId },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const jobId = String(params.jobId);
    const aiData = getStoredAiData();
    if (aiData.jobs[jobId]) {
      aiData.jobs[jobId].status = 'cancelled';
      saveStoredAiData(aiData);
    }

    return HttpResponse.json({ message: 'Job cancelled' }, { status: 202, headers: { 'X-Correlation-Id': corrId } });
  }),
];
