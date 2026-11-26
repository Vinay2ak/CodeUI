import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { projectApi } from './project/api';
import { githubApi } from './github/api';
import { codeContextApi } from './codeContext/api';
import { setBriefScenario, setServiceFailing } from '../mocks/controls';
import { setAccessToken } from '../lib/authHeader';
import type { ConfirmedBrief } from '../types/aiVerification';
import type { CreateProjectPayload } from './project/types';

function createMockJwt(role = 'owner') {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      gen: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-owner-1',
      role,
    })
  );
  return `${header}.${payload}.signature`;
}

const server = setupServer(...handlers);

const validDraftPayload: CreateProjectPayload = {
  title: 'Webhook Event Deduplication Fix',
  description: 'Webhook events occasionally result in duplicate processing and state inconsistency under high load.',
  blockerType: 'HARD_BUG',
  stacks: ['PYTHON_FASTAPI'],
  specialties: ['BACKEND'],
  skills: ['FastAPI'],
  budget: 5000,
  urgency: 'THIS_WEEK',
  status: 'draft',
  repoUrl: 'https://github.com/acme/payments-api',
  verificationMode: 'AUTO_TESTS_AND_REVIEW',
};

describe('Phase 2 Services and Mocks', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
    setAccessToken(null);
  });

  beforeEach(() => {
    setAccessToken(createMockJwt());
    setBriefScenario('ok');
    setServiceFailing('project', false);
    setServiceFailing('github', false);
    setServiceFailing('codeContext', false);
  });

  it('creates a draft project and updates it via PATCH', async () => {
    const draft = await projectApi.createProject(validDraftPayload);

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe('draft');

    const updated = await projectApi.updateProject(draft.id, {
      title: 'Updated Draft Webhook Fix Here',
      budget: 6000,
    });

    expect(updated.title).toBe('Updated Draft Webhook Fix Here');
    expect(updated.budget).toBe(6000);
  });

  it('publishes a draft project via POST /publish', async () => {
    const draft = await projectApi.createProject({
      ...validDraftPayload,
      title: 'To Publish Project Title',
    });

    const published = await projectApi.publishProject(draft.id);
    expect(published.status).toBe('open');
  });

  it('saves and retrieves confirmed brief', async () => {
    const proj = await projectApi.createProject({
      ...validDraftPayload,
      title: 'Project with confirmed brief',
    });

    const mockBrief: ConfirmedBrief = {
      briefId: 'brief-test-1',
      generatedAt: '2026-03-12T00:00:00Z',
      repoCommitSha: 'sha12345',
      problemSummary: 'Problem description that is valid and detailed',
      suspectedFiles: [
        { path: 'src/file.ts', startLine: 1, endLine: 10, reason: 'bug', verified: true },
      ],
      rootCauseHypothesis: 'Null pointer in transaction',
      stepByStepPlan: [{ id: 's1', text: 'Step 1' }],
      acceptanceCriteria: [
        { id: 'c1', text: 'Works as expected', required: true, source: 'ai' },
      ],
      inputsHash: 'hash12345',
      confirmedAt: '2026-03-12T01:00:00Z',
    };

    const saved = await projectApi.saveBrief(proj.id, mockBrief);
    expect(saved.briefId).toBe('brief-test-1');

    const retrieved = await projectApi.getBrief(proj.id);
    expect(retrieved.briefId).toBe('brief-test-1');
    expect(retrieved.inputsHash).toBe('hash12345');
  });

  it('connects a GitHub repo and fetches status', async () => {
    const proj = await projectApi.createProject({
      ...validDraftPayload,
      title: 'GitHub Repo Project Test',
    });

    const connectRes = await githubApi.connectRepo(proj.id, 'https://github.com/acme/payments-api');
    expect(connectRes.status).toBe('connected');
    expect(connectRes.repo?.fullName).toBe('acme/payments-api');
    expect(connectRes.repo?.access).toBe('read-only');

    const statusRes = await githubApi.getRepoStatus(proj.id);
    expect(statusRes.status).toBe('connected');
    expect(statusRes.repo?.fullName).toBe('acme/payments-api');
  });

  it('handles needs-auth repo transitioning after polling', async () => {
    const proj = await projectApi.createProject({
      ...validDraftPayload,
      title: 'Auth Repo Project Test',
    });

    const connectRes = await githubApi.connectRepo(proj.id, 'https://github.com/acme/needs-auth');
    expect(connectRes.status).toBe('pending');
    expect(connectRes.authorizeUrl).toContain('authorize');

    // Poll 1
    const p1 = await githubApi.getRepoStatus(proj.id);
    expect(p1.status).toBe('pending');

    // Poll 2 -> turns connected
    const p2 = await githubApi.getRepoStatus(proj.id);
    expect(p2.status).toBe('connected');
    expect(p2.repo?.fullName).toBe('acme/needs-auth');
  });

  it('handles missing-repo and no-access error codes', async () => {
    const proj = await projectApi.createProject({
      ...validDraftPayload,
      title: 'Error Repo Project Test',
    });

    const missing = await githubApi.connectRepo(proj.id, 'https://github.com/acme/missing-repo');
    expect(missing.status).toBe('error');
    expect(missing.error?.code).toBe('REPO_NOT_FOUND');

    const noAccess = await githubApi.connectRepo(proj.id, 'https://github.com/acme/no-access');
    expect(noAccess.status).toBe('error');
    expect(noAccess.error?.code).toBe('ACCESS_DENIED');
  });

  it('starts and polls codeContext brief job, respects fail scenario', async () => {
    const proj = await projectApi.createProject({
      ...validDraftPayload,
      title: 'Job Project Test Title',
    });

    setBriefScenario('fail');
    const { jobId } = await codeContextApi.startBriefJob(proj.id, 'hash123');
    expect(jobId).toBeDefined();

    const job = await codeContextApi.getBriefJob(proj.id, jobId);
    expect(job.jobId).toBe(jobId);
    expect(['queued', 'running', 'failed']).toContain(job.status);
  });
});
