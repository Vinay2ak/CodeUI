import { http, HttpResponse } from 'msw';
import { mockState, isServiceFailing, emitTestEvent } from './controls';
import {
  initialProjects,
  getPaymentsSummary,
  initialTasks,
  initialAdminUsers,
  initialServicesHealth,
  initialNotifications,
} from './data';
import { mockFreelancers } from './data/freelancers';
import { rankFreelancers } from './matching';
import { postProjectSchema } from '../features/post-project/schema';
import { sizeFromBudget } from '../features/post-project/size';
import { roleCanSeeEvent } from './simulator';
import { UserRole } from '../realtime/types';
import type { ProjectDetail } from '../services/project/types';
import { aiBriefMockHandlers } from './aiBriefMock';
import { reviewMockHandlers } from './reviewMock';

function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function getMockCookie(): any | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)mock_rt=([^;]*)/);
  if (!match) return null;
  try {
    const jsonStr = atob(decodeURIComponent(match[1]));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function setMockCookie(user: any): void {
  if (typeof document === 'undefined') return;
  const encoded = btoa(JSON.stringify(user));
  document.cookie = `mock_rt=${encodeURIComponent(encoded)}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearMockCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'mock_rt=; path=/; max-age=0; SameSite=Lax';
}

// Expose helper on window for console testing
if (typeof window !== 'undefined') {
  (window as any).__setMockUser = (role: UserRole = 'owner') => {
    const users = {
      owner: {
        id: 'user-owner-1',
        email: 'asha.owner@example.com',
        displayName: 'Asha Owner',
        role: 'owner',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      freelancer: {
        id: 'user-freelancer-1',
        email: 'ravi.freelancer@example.com',
        displayName: 'Ravi Freelancer',
        role: 'freelancer',
        status: 'active',
        createdAt: '2026-01-10T00:00:00.000Z',
      },
      admin: {
        id: 'user-admin-1',
        email: 'admin.user@example.com',
        displayName: 'Admin User',
        role: 'admin',
        status: 'active',
        createdAt: '2025-10-01T00:00:00.000Z',
      },
    };
    setMockCookie(users[role]);
    window.location.reload();
  };
}

// Create fake JWT: header.payload.sig
function createFakeToken(user: any, gen: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 15 * 60; // 15 min
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      exp,
      gen,
    })
  );
  const sig = 'mock_sig';
  return `${header}.${payload}.${sig}`;
}

// Validate Bearer token
function validateAuthHeader(
  authHeader: string | null,
  corrId: string
): { isValid: boolean; payload?: any; errorResponse?: Response } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      errorResponse: HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthenticated',
          status: 401,
          code: 'UNAUTHENTICATED',
          detail: 'Missing or malformed Authorization header',
          correlationId: corrId,
        },
        { status: 401, headers: { 'X-Correlation-Id': corrId } }
      ),
    };
  }

  const token = authHeader.substring(7);
  try {
    const parts = token.split('.');
    if (parts.length < 2) throw new Error('Invalid token');
    const payload = JSON.parse(atob(parts[1]));

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.gen !== mockState.tokenGen || payload.exp <= nowSec) {
      return {
        isValid: false,
        errorResponse: HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Token Expired',
            status: 401,
            code: 'TOKEN_EXPIRED',
            detail: 'The access token has expired',
            correlationId: corrId,
          },
          { status: 401, headers: { 'X-Correlation-Id': corrId } }
        ),
      };
    }

    return { isValid: true, payload };
  } catch {
    return {
      isValid: false,
      errorResponse: HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Token Expired',
          status: 401,
          code: 'TOKEN_EXPIRED',
          detail: 'Invalid token structure',
          correlationId: corrId,
        },
        { status: 401, headers: { 'X-Correlation-Id': corrId } }
      ),
    };
  }
}

// Random delay between 300ms and 800ms
async function applyRandomLatency(extraDelay = 0) {
  const ms = Math.floor(Math.random() * (800 - 300 + 1)) + 300 + extraDelay;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------- Persistence & Storage Helpers ----------------
const PROJECTS_KEY = 'mock.projects.v1';
const SHORTLISTS_KEY = 'mock.shortlists.v1';
const IDEMPOTENCY_KEY = 'mock.idempotency.v1';

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

function getStoredShortlists(): Record<string, string[]> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SHORTLISTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredShortlists(map: Record<string, string[]>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SHORTLISTS_KEY, JSON.stringify(map));
  } catch {}
}

function getIdempotencyRecord(key: string): ProjectDetail | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${IDEMPOTENCY_KEY}.${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setIdempotencyRecord(key: string, project: ProjectDetail): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`${IDEMPOTENCY_KEY}.${key}`, JSON.stringify(project));
  } catch {}
}

const matchPollCounts = new Map<string, number>();

function toProjectDetail(p: any): ProjectDetail {
  return {
    id: p.id,
    title: p.title,
    description: p.description || 'Production issue requiring expert debugging and verification.',
    blockerType: p.blockerType || 'HARD_BUG',
    stacks: p.stacks || ['PYTHON_FASTAPI'],
    specialties: p.specialties || ['PAYMENT_WEBHOOKS', 'TESTING'],
    skills: p.skills || ['Python', 'FastAPI'],
    budget: p.budget || 5000,
    urgency: p.urgency || 'THIS_WEEK',
    size: p.size || sizeFromBudget(p.budget || 5000).value,
    repoUrl: p.repoUrl || (p.repo ? `https://github.com/${p.repo}` : null),
    verificationMode: p.verificationMode || 'AUTO_TESTS_AND_REVIEW',
    createdAt: p.createdAt || p.updatedAt || new Date().toISOString(),
    matchingStatus: p.matchingStatus || 'ready',
    status: p.status || 'open',
    repo: p.repo || 'acme/repo',
    freelancerName: p.freelancerName || null,
    updatedAt: p.updatedAt || new Date().toISOString(),
    tags: p.tags,
  };
}

export const identityHandlers = [
  // 1. Identity: POST /auth/refresh
  http.post('*/api/v1/auth/refresh', async () => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const mockUser = getMockCookie();
    if (!mockUser) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Refresh Invalid',
          status: 401,
          code: 'REFRESH_INVALID',
          detail: 'No mock_rt refresh cookie found',
          correlationId: corrId,
        },
        { status: 401, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const accessToken = createFakeToken(mockUser, mockState.tokenGen);
    return HttpResponse.json(
      {
        accessToken,
        expiresIn: 900,
      },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  }),

  // 2. Identity: POST /auth/logout
  http.post('*/api/v1/auth/logout', async () => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();
    clearMockCookie();
    return new HttpResponse(null, {
      status: 204,
      headers: { 'X-Correlation-Id': corrId },
    });
  }),

  // 3. Identity: GET /users/me
  http.get('*/api/v1/users/me', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const mockUser = getMockCookie();
    if (!mockUser) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthenticated',
          status: 401,
          code: 'UNAUTHENTICATED',
          detail: 'No user session found',
          correlationId: corrId,
        },
        { status: 401, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(mockUser, {
      headers: { 'X-Correlation-Id': corrId },
    });
  }),

  // 3b. Identity: GET /users/me/owner-profile
  http.get('*/api/v1/users/me/owner-profile', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const mockUser = getMockCookie();
    if (!mockUser || mockUser.role !== 'owner') {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          code: 'NOT_FOUND',
          detail: 'Owner profile not found',
          correlationId: corrId,
        },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(
      {
        ownerType: 'STARTUP_TEAM',
        organizationName: 'CodeBridge Tech Labs',
        roleTitle: 'Engineering Lead',
        timezone: 'Asia/Kolkata',
        primaryStack: ['PYTHON_FASTAPI', 'REACT_TS'],
        typicalBlocker: 'HARD_BUG',
        defaultBudgetRange: 'FEATURE_INTEGRATION',
        preferredVerificationMode: 'AUTO_TESTS_AND_REVIEW',
      },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  })
];

export const projectHandlers = [
  // 4. Project: GET /projects
  http.get('*/api/v1/projects', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('project')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Project service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const stored = getStoredProjects();
    const combined = [...stored, ...initialProjects.map(toProjectDetail)];

    return HttpResponse.json(
      { items: combined },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  }),

  // 4b. Project: GET /projects/:id
  http.get('*/api/v1/projects/:id', async ({ request, params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('project')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Project service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const id = String(params.id);
    if (id === 'p-other-owner' || id === 'p-forbidden') {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'FORBIDDEN',
          detail: 'You do not have access to this project',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const stored = getStoredProjects();
    const foundStored = stored.find((p) => p.id === id);
    if (foundStored) {
      return HttpResponse.json(foundStored, {
        headers: { 'X-Correlation-Id': corrId },
      });
    }

    const foundInitial = initialProjects.find((p) => p.id === id);
    if (foundInitial) {
      return HttpResponse.json(toProjectDetail(foundInitial), {
        headers: { 'X-Correlation-Id': corrId },
      });
    }

    return HttpResponse.json(
      {
        type: 'about:blank',
        title: 'Project Not Found',
        status: 404,
        code: 'NOT_FOUND',
        detail: `Project with id ${id} not found`,
        correlationId: corrId,
      },
      { status: 404, headers: { 'X-Correlation-Id': corrId } }
    );
  }),

  // 4b-del. Project: DELETE /projects/:id
  http.delete('*/api/v1/projects/:id', async ({ params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();
    const id = String(params.id);
    const stored = getStoredProjects();
    const filtered = stored.filter((p) => p.id !== id);
    saveStoredProjects(filtered);
    return HttpResponse.json({ success: true, id }, {
      status: 200,
      headers: { 'X-Correlation-Id': corrId },
    });
  }),

  // 4b-cancel. Project: POST /projects/:id/cancel
  http.post('*/api/v1/projects/:id/cancel', async ({ params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();
    const id = String(params.id);
    const stored = getStoredProjects();
    const filtered = stored.filter((p) => p.id !== id);
    saveStoredProjects(filtered);
    return HttpResponse.json({ success: true, id, status: 'CANCELLED' }, {
      status: 200,
      headers: { 'X-Correlation-Id': corrId },
    });
  }),

  // 4c. Project: POST /projects (Post a Project by Owner)
  http.post('*/api/v1/projects', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('project')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Project service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    // Check Idempotency-Key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const existing = getIdempotencyRecord(idempotencyKey);
      if (existing) {
        return HttpResponse.json(existing, {
          status: 201,
          headers: { 'X-Correlation-Id': corrId, 'Idempotency-Key': idempotencyKey },
        });
      }
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // Validate with Zod postProjectSchema
    const normalizedBody = {
      ...body,
      blockerType: body.blockerType || body.blocker_type || 'HARD_BUG',
      repoUrl: body.repoUrl !== undefined ? body.repoUrl : body.repo_url,
      verificationMode: body.verificationMode || body.verification_mode || 'AUTO_TESTS_AND_REVIEW',
      stacks: body.stacks || (Array.isArray(body.required_skills) && body.required_skills.length ? body.required_skills : ['PYTHON_FASTAPI']),
      skills: body.skills || body.required_skills || [],
      urgency: body.urgency || 'THIS_WEEK',
    };
    const parseResult = postProjectSchema.safeParse(normalizedBody);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: String(e.path[0] ?? ''),
        message: e.message,
      }));
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Failed',
          status: 422,
          code: 'VALIDATION_FAILED',
          detail: 'The submitted project details are invalid.',
          correlationId: corrId,
          errors,
        },
        { status: 422, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const data = parseResult.data;
    const stored = getStoredProjects();
    const projectId = `p-${Date.now()}`;
    const now = new Date().toISOString();

    const repoSlug = data.repoUrl
      ? data.repoUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/, '')
      : 'acme/service';

    const newProject: ProjectDetail = {
      id: projectId,
      title: data.title,
      description: data.description,
      blockerType: data.blockerType,
      stacks: data.stacks,
      specialties: data.specialties,
      skills: data.skills,
      budget: data.budget,
      urgency: data.urgency,
      size: sizeFromBudget(data.budget).value,
      repoUrl: data.repoUrl || null,
      verificationMode: data.verificationMode,
      createdAt: now,
      updatedAt: now,
      matchingStatus: body.status === 'draft' ? 'pending' : 'computing',
      status: body.status === 'draft' ? 'draft' : 'open',
      repo: repoSlug,
      freelancerName: null,
    };

    stored.unshift(newProject);
    saveStoredProjects(stored);

    if (idempotencyKey) {
      setIdempotencyRecord(idempotencyKey, newProject);
    }

    // Emit event
    emitTestEvent('project.posted', {
      projectId: newProject.id,
      title: newProject.title,
      budget: newProject.budget,
    });

    return HttpResponse.json(newProject, {
      status: 201,
      headers: {
        'X-Correlation-Id': corrId,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
    });
  })
];

export const talentHandlers = [
  // 4d. Talent: GET /talent/matches/:projectId
  http.get('*/api/v1/talent/matches/:projectId', async ({ request, params }) => {
    await applyRandomLatency(mockState.matchingDelayMs);
    const corrId = generateCorrelationId();

    if (isServiceFailing('talent')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Talent matching service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const projectId = String(params.projectId);
    if (projectId === 'p-other-owner' || projectId === 'p-forbidden') {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'FORBIDDEN',
          detail: 'You do not have access to this project',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const stored = getStoredProjects();
    const project =
      stored.find((p) => p.id === projectId) ||
      initialProjects.map(toProjectDetail).find((p) => p.id === projectId);

    if (!project) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Project Not Found',
          status: 404,
          code: 'NOT_FOUND',
          detail: `Project with id ${projectId} not found`,
          correlationId: corrId,
        },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.failMatching) {
      return HttpResponse.json(
        {
          status: 'failed',
          computedAt: null,
          totalCandidates: 0,
          items: [],
        },
        { headers: { 'X-Correlation-Id': corrId } }
      );
    }

    // Polling simulation: first 2 requests respond with 'computing', 3rd responds with 'ready'
    const count = matchPollCounts.get(projectId) ?? 0;
    matchPollCounts.set(projectId, count + 1);

    if (count < 2) {
      return HttpResponse.json(
        {
          status: 'computing',
          computedAt: null,
          totalCandidates: 0,
          items: [],
        },
        { headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const shortlists = getStoredShortlists();
    const shortlistedSet = new Set(shortlists[projectId] ?? []);
    const items = rankFreelancers(project, mockFreelancers, shortlistedSet);

    return HttpResponse.json(
      {
        status: 'ready',
        computedAt: new Date().toISOString(),
        totalCandidates: mockFreelancers.length,
        items,
      },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  }),

  // 4e. Talent: GET /talent/freelancers/:id
  http.get('*/api/v1/talent/freelancers/:id', async ({ request, params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('talent')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Talent service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const id = String(params.id);
    const freelancer = mockFreelancers.find((f) => f.id === id);
    if (!freelancer) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Freelancer Not Found',
          status: 404,
          code: 'NOT_FOUND',
          detail: `Freelancer ${id} not found`,
          correlationId: corrId,
        },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(freelancer, {
      headers: { 'X-Correlation-Id': corrId },
    });
  }),

  // 4f. Shortlist: PUT /projects/:projectId/shortlist/:freelancerId
  http.put('*/api/v1/projects/:projectId/shortlist/:freelancerId', async ({ request, params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const projectId = String(params.projectId);
    const freelancerId = String(params.freelancerId);

    const map = getStoredShortlists();
    const list = new Set(map[projectId] ?? []);
    list.add(freelancerId);
    map[projectId] = Array.from(list);
    saveStoredShortlists(map);

    return new HttpResponse(null, {
      status: 204,
      headers: { 'X-Correlation-Id': corrId },
    });
  }),

  // 4g. Shortlist: DELETE /projects/:projectId/shortlist/:freelancerId
  http.delete('*/api/v1/projects/:projectId/shortlist/:freelancerId', async ({ request, params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const projectId = String(params.projectId);
    const freelancerId = String(params.freelancerId);

    const map = getStoredShortlists();
    if (map[projectId]) {
      map[projectId] = map[projectId].filter((id) => id !== freelancerId);
      saveStoredShortlists(map);
    }

    return new HttpResponse(null, {
      status: 204,
      headers: { 'X-Correlation-Id': corrId },
    });
  }),
  // Identity Service alias for freelancer profile
  http.get('*/api/v1/freelancers/:id', async ({ params }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();
    const freelancerId = String(params.id);
    const freelancer = mockFreelancers.find((f) => f.id === freelancerId);

    if (!freelancer) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          code: 'NOT_FOUND',
          detail: 'Freelancer not found',
          correlationId: corrId,
        },
        { status: 404, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(
      {
        id: freelancer.id,
        full_name: freelancer.displayName,
        bio: freelancer.headline,
        skills: freelancer.skills,
        experience_years: 5,
        availability: freelancer.availability === 'IMMEDIATE' ? 'AVAILABLE' : 'BUSY',
      },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  }),
];

export const paymentHandlers = [
  // 5. Payment: GET /payments/summary
  http.get('*/api/v1/payments/summary', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('payment')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Payment service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    return HttpResponse.json(getPaymentsSummary(), {
      headers: { 'X-Correlation-Id': corrId },
    });
  }),
  http.get('*/api/v1/payment/summary', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('payment')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Payment service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    return HttpResponse.json(getPaymentsSummary(), {
      headers: { 'X-Correlation-Id': corrId },
    });
  }),
];

export const workspaceHandlers = [
  // 6. Workspace: GET /tasks/mine (freelancer only)
  http.get('*/api/v1/tasks/mine', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('workspace')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Workspace service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    if (auth.payload.role !== 'freelancer') {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'FORBIDDEN',
          detail: 'Tasks can only be accessed by freelancers',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(
      { items: initialTasks },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  })
];

export const adminHandlers = [
  // 7. Admin: GET /admin/users (admin only)
  http.get('*/api/v1/admin/users', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('admin')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Admin service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    if (auth.payload.role !== 'admin') {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'FORBIDDEN',
          detail: 'Admin user list forbidden for non-admin users',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    return HttpResponse.json(
      { items: initialAdminUsers },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  }),

  // 8. Admin: GET /admin/services/health (admin only)
  http.get('*/api/v1/admin/services/health', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('admin')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Admin service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    if (auth.payload.role !== 'admin') {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'FORBIDDEN',
          detail: 'Admin health forbidden for non-admin users',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    // Reflect failing services in health status
    const healthRows = initialServicesHealth.map((row) => {
      if (isServiceFailing(row.name)) {
        return { ...row, status: 'down' as const, latencyMs: 0 };
      }
      return row;
    });

    return HttpResponse.json(
      { services: healthRows },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  })
];

export const notificationHandlers = [
  // 9. Notification: GET /notifications
  http.get('*/api/v1/notifications', async ({ request }) => {
    await applyRandomLatency();
    const corrId = generateCorrelationId();

    if (isServiceFailing('notification')) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'Notification service is currently unavailable',
          correlationId: corrId,
        },
        { status: 503, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    if (mockState.isSuspended) {
      return HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Account Suspended',
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          detail: 'Your account is suspended',
          correlationId: corrId,
        },
        { status: 403, headers: { 'X-Correlation-Id': corrId } }
      );
    }

    const auth = validateAuthHeader(request.headers.get('Authorization'), corrId);
    if (!auth.isValid) return auth.errorResponse!;

    const userRole = (auth.payload.role || 'owner') as UserRole;
    const filtered = initialNotifications
      .filter((n) => roleCanSeeEvent(userRole, n.type))
      .slice(0, 20);

    return HttpResponse.json(
      { items: filtered },
      { headers: { 'X-Correlation-Id': corrId } }
    );
  })
];

export const serviceHandlers: Record<string, any[]> = {
  identity: identityHandlers,
  project: projectHandlers,
  talent: talentHandlers,
  payment: paymentHandlers,
  workspace: workspaceHandlers,
  notification: notificationHandlers,
  admin: adminHandlers,
  review: reviewMockHandlers,
  verification: reviewMockHandlers,
};

export const handlers = [
  ...identityHandlers,
  ...projectHandlers,
  ...aiBriefMockHandlers,
  ...reviewMockHandlers,
  ...talentHandlers,
  ...paymentHandlers,
  ...workspaceHandlers,
  ...adminHandlers,
  ...notificationHandlers,
];
