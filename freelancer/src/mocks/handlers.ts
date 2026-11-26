import { http, HttpResponse, delay, HttpHandler } from "msw";
import { env } from "../lib/env";
import { MOCK_TASKS, MOCK_TASK_SUMMARIES, MOCK_ESCROWS } from "./data/tasks";
import { MOCK_AI_CONTEXTS } from "./data/ai";
import { answerQuestion } from "./data/aiAsk";
import { TEST_RULES } from "./data/rules";
import { buildSelfCheck } from "./data/selfCheck";
import { buildDraft } from "./data/draft";
import { T1_INITIAL_REPO } from "./data/repo";
import {
  getWorkspace,
  startMockWorkspace,
  stopMockWorkspace,
  resetMockWorkspace,
  getMockFiles,
  getMockFileContent,
  saveMockFileContent,
  startMockTestRun,
  getMockRun,
  submitMockSolution,
  getSubmissionState,
  getMockFileMap,
} from "./simulator";

// Down status flags for services
export const serviceDownState: Record<
  "workspace" | "submission" | "ai" | "payment" | "notification" | "project" | "profile" | "identity",
  boolean
> = {
  workspace: false,
  submission: false,
  ai: false,
  payment: false,
  notification: false,
  project: false,
  profile: false,
  identity: false,
};

export let isSuspendedMock = false;
export let forceExpireToken = false;

export type AiScenario =
  | "ok"
  | "slow"
  | "fail"
  | "not_configured"
  | "no_evidence"
  | "rate_limited"
  | "hostile";

export let aiScenarioState: AiScenario = "ok";
export let aiSessionQuota = 20;
export let aiQuestionCount = 0;
export const aiSeenIdempotencyKeys = new Map<string, any>();
export let failNextAiJobFlag = false;

export function failNextAiJob(fail = true) {
  failNextAiJobFlag = fail;
}

export interface MockAiJobRecord {
  jobId: string;
  taskId: string;
  kind: "self_check" | "draft_summary";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: number;
  error: { code: string; message: string } | null;
  result: any | null;
}

export const mockAiJobs = new Map<string, MockAiJobRecord>();

export function setAiScenario(scenario: AiScenario) {
  aiScenarioState = scenario;
}

export function resetAiState() {
  aiScenarioState = "ok";
  aiSessionQuota = 20;
  aiQuestionCount = 0;
  aiSeenIdempotencyKeys.clear();
  failNextAiJobFlag = false;
  mockAiJobs.clear();
}

export function setMockSuspended(suspended: boolean) {
  isSuspendedMock = suspended;
}

export function setForceExpireToken(expire: boolean) {
  forceExpireToken = expire;
}

function generateUuid(): string {
  return "corr_" + Math.random().toString(36).substring(2, 11);
}

function parseMockRtCookie(): any | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)mock_rt=([^;]*)/);
  if (!match) return null;
  try {
    const jsonStr = atob(decodeURIComponent(match[1]));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function writeMockRtCookie(user: any): void {
  if (typeof document === "undefined") return;
  const b64 = btoa(JSON.stringify(user));
  document.cookie = `mock_rt=${encodeURIComponent(b64)}; path=/; max-age=604800; SameSite=Lax`;
}

function clearMockRtCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "mock_rt=; path=/; max-age=0; SameSite=Lax";
}

function createFakeJwt(sub: string, role: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + env.mockTokenTtlSeconds;
  const payload = btoa(JSON.stringify({ sub, role, exp }));
  const signature = "fake_sig_" + Math.random().toString(36).substring(2);
  return `${header}.${payload}.${signature}`;
}

function verifyAuth(request: Request): {
  valid: boolean;
  status: number;
  code: string;
  detail: string;
  user?: { sub: string; role: string };
} {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return {
      valid: false,
      status: 401,
      code: "UNAUTHENTICATED",
      detail: "Missing or malformed Authorization header",
    };
  }

  const token = auth.substring(7);
  if (!token || forceExpireToken) {
    return {
      valid: false,
      status: 401,
      code: "TOKEN_EXPIRED",
      detail: "Access token is invalid or expired",
    };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("bad token");
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        status: 401,
        code: "TOKEN_EXPIRED",
        detail: "Access token has expired",
      };
    }

    if (isSuspendedMock) {
      return {
        valid: false,
        status: 403,
        code: "ACCOUNT_SUSPENDED",
        detail: "Freelancer account is suspended",
      };
    }

    return {
      valid: true,
      status: 200,
      code: "",
      detail: "",
      user: { sub: payload.sub, role: payload.role },
    };
  } catch {
    return {
      valid: false,
      status: 401,
      code: "TOKEN_INVALID",
      detail: "Malformed access token",
    };
  }
}

// ==================== IDENTITY HANDLERS ====================
export const identityHandlers: HttpHandler[] = [
  http.post("*/api/v1/auth/refresh", async () => {
    await delay(Math.floor(Math.random() * 400) + 300);
    const corrId = generateUuid();
    const cookieUser = parseMockRtCookie();

    if (!cookieUser) {
      return HttpResponse.json(
        {
          code: "REFRESH_INVALID",
          detail: "Missing or invalid refresh token cookie",
          correlationId: corrId,
        },
        { status: 401, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (cookieUser.status === "suspended" || isSuspendedMock) {
      return HttpResponse.json(
        {
          code: "ACCOUNT_SUSPENDED",
          detail: "Freelancer account is suspended",
          correlationId: corrId,
        },
        { status: 403, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const token = createFakeJwt(cookieUser.id || "usr_ravi", cookieUser.role || "freelancer");
    return HttpResponse.json(
      {
        accessToken: token,
        expiresIn: env.mockTokenTtlSeconds,
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),

  http.post("*/api/v1/auth/logout", async () => {
    await delay(300);
    const corrId = generateUuid();
    clearMockRtCookie();
    return new HttpResponse(null, {
      status: 204,
      headers: { "X-Correlation-Id": corrId },
    });
  }),

  http.get("*/api/v1/users/me", async () => {
    await delay(300);
    const corrId = generateUuid();
    const cookieUser = parseMockRtCookie();

    if (!cookieUser) {
      return HttpResponse.json(
        {
          code: "UNAUTHENTICATED",
          detail: "No active session",
          correlationId: corrId,
        },
        { status: 401, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(
      {
        id: cookieUser.id || "usr_ravi",
        email: cookieUser.email || "ravi@codebridge.dev",
        displayName: cookieUser.displayName || "Ravi Freelancer",
        role: cookieUser.role || "freelancer",
        status: isSuspendedMock ? "suspended" : cookieUser.status || "active",
        createdAt: cookieUser.createdAt || "2026-01-15T10:00:00Z",
        onboardingCompleted: cookieUser.onboardingCompleted !== false,
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),
];

// ==================== WORKSPACE HANDLERS ====================
export const workspaceHandlers: HttpHandler[] = [
  http.get("*/api/v1/tasks/mine", async ({ request }) => {
    await delay(Math.floor(Math.random() * 400) + 300);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json({ items: MOCK_TASK_SUMMARIES }, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.get("*/api/v1/tasks/:id", async ({ params, request }) => {
    await delay(Math.floor(Math.random() * 400) + 300);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const task = MOCK_TASKS[params.id as string];
    if (!task) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: "Task not found", correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(task, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.get("*/api/v1/workspaces/:taskId", async ({ params, request }) => {
    await delay(Math.floor(Math.random() * 400) + 300);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const ws = getWorkspace(params.taskId as string);
    return HttpResponse.json(ws, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.post("*/api/v1/workspaces/:taskId/start", async ({ params, request }) => {
    await delay(600);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    startMockWorkspace(params.taskId as string);
    return HttpResponse.json({ status: "running" }, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.post("*/api/v1/workspaces/:taskId/stop", async ({ params, request }) => {
    await delay(400);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    stopMockWorkspace(params.taskId as string);
    return HttpResponse.json({ status: "stopped" }, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.post("*/api/v1/workspaces/:taskId/reset", async ({ params, request }) => {
    await delay(800);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    resetMockWorkspace(params.taskId as string);
    return HttpResponse.json({ status: "running" }, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.get("*/api/v1/workspaces/:taskId/files", async ({ params, request }) => {
    await delay(Math.floor(Math.random() * 300) + 200);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const taskId = params.taskId as string;
    const files = getMockFiles(taskId);
    const ws = getWorkspace(taskId);

    return HttpResponse.json(
      {
        commit: ws.commit,
        items: files.map((f) => ({
          path: f.path,
          type: "file" as const,
          size: f.content.length,
        })),
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),

  http.get("*/api/v1/workspaces/:taskId/files/content", async ({ request, params }) => {
    await delay(Math.floor(Math.random() * 200) + 100);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const url = new URL(request.url);
    const filePath = url.searchParams.get("path") || "";
    const file = getMockFileContent(params.taskId as string, filePath);

    if (!file) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: "File not found", correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(file, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.put("*/api/v1/workspaces/:taskId/files/content", async ({ request, params }) => {
    await delay(200);
    const corrId = generateUuid();

    if (serviceDownState.workspace) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Workspace service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const body = (await request.json()) as { path: string; content: string };
    saveMockFileContent(params.taskId as string, body.path, body.content);

    return HttpResponse.json(
      { savedAt: new Date().toISOString() },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),
];

// ==================== SUBMISSION HANDLERS ====================
export const submissionHandlers: HttpHandler[] = [
  http.post("*/api/v1/submissions/runs", async ({ request }) => {
    await delay(400);
    const corrId = generateUuid();

    if (serviceDownState.submission) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Submission service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { taskId?: string };
    const taskId = body.taskId || "t1";
    const runId = startMockTestRun(taskId);

    return HttpResponse.json({ runId }, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.get("*/api/v1/submissions/runs/:runId", async ({ params, request }) => {
    await delay(200);
    const corrId = generateUuid();

    if (serviceDownState.submission) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Submission service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const run = getMockRun(params.runId as string);
    if (!run) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: "Run not found", correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(run, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.post("*/api/v1/submissions", async ({ request }) => {
    await delay(600);
    const corrId = generateUuid();

    if (serviceDownState.submission) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Submission service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const body = (await request.json()) as { taskId: string; notes?: string };
    if (!body.taskId) {
      return HttpResponse.json(
        { code: "BAD_REQUEST", detail: "Missing taskId", correlationId: corrId },
        { status: 400, headers: { "X-Correlation-Id": corrId } }
      );
    }

    try {
      const submissionId = submitMockSolution(body.taskId, body.notes || "");
      return HttpResponse.json(
        { submissionId, status: "in_review" },
        { headers: { "X-Correlation-Id": corrId } }
      );
    } catch (err: any) {
      return HttpResponse.json(
        {
          code: "SUBMISSION_LOCKED",
          detail: err?.message || "All required tests must pass before submission",
          correlationId: corrId,
        },
        { status: 422, headers: { "X-Correlation-Id": corrId } }
      );
    }
  }),

  http.get("*/api/v1/submissions/current", async ({ request }) => {
    await delay(300);
    const corrId = generateUuid();

    if (serviceDownState.submission) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Submission service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId") || "t1";
    const subState = getSubmissionState(taskId);

    return HttpResponse.json(subState, { headers: { "X-Correlation-Id": corrId } });
  }),
];

// ==================== AI HANDLERS ====================
export const aiHandlers: HttpHandler[] = [
  http.get("*/api/v1/ai/capabilities", async ({ request }) => {
    void request;
    const corrId = generateUuid();
    if (serviceDownState.ai || aiScenarioState === "fail") {
      return HttpResponse.json(
        { code: "AI_UNAVAILABLE", detail: "AI assistant service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "not_configured") {
      return HttpResponse.json(
        {
          provider: "none",
          features: { context: false, ask: false, explain: false, selfCheck: false, draft: false },
          limits: { askPerHour: null },
        },
        { headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(
      {
        provider: "mock",
        features: { context: true, ask: true, explain: true, selfCheck: true, draft: true },
        limits: { askPerHour: 20 },
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),

  http.get("*/api/v1/ai/context/:taskId", async ({ params, request }) => {
    if (aiScenarioState === "slow") {
      await delay(25000);
    } else {
      await delay(Math.floor(Math.random() * 400) + 300);
    }
    const corrId = generateUuid();

    if (serviceDownState.ai || aiScenarioState === "fail") {
      return HttpResponse.json(
        { code: "AI_UNAVAILABLE", detail: "AI context service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "not_configured") {
      return HttpResponse.json(
        { code: "AI_NOT_CONFIGURED", detail: "The AI assistant isn't enabled on this server.", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (authCheck.user?.role !== "freelancer") {
      return HttpResponse.json(
        { code: "FORBIDDEN", detail: "Access denied: role freelancer required", correlationId: corrId },
        { status: 403, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "hostile") {
      return HttpResponse.json(
        {
          generated_at: "2026-11-22T10:00:00Z",
          repo_commit_sha: "a1b2c3d\u001b[31m",
          summary:
            "<script>alert(1)</script> [click](javascript:alert(1)) \u001b[32mHostile summary with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789 and sk-test-1234567890abcdefghijkl",
          findings: ["<script>alert(1)</script> Finding with secret password=supersecretpassword123"],
          relevant_files: [
            { path: "../../etc/passwd", score: 0.99, reason: "Hostile path traversal" },
            { path: "app/nonexistent_file_xyz.py", score: 0.95, reason: "File not in workspace" },
            { path: "app/webhooks.py", score: 0.85, reason: "Real file with [click](javascript:alert(1))" },
          ],
          dependencies: [
            { name: "fake-lib", kind: "other", note: "token: sensitive_auth_token_value_xyz" },
          ],
          affected_areas: [
            { name: "Hostile area", note: "\u001b[31mANSI escape in note" },
          ],
          setup_hints: [
            { command: "rm -rf /", note: "Dangerous hint" },
          ],
          approach: ["Step 1 with <script>alert(1)</script>"],
        },
        { headers: { "X-Correlation-Id": corrId } }
      );
    }

    const ctx = MOCK_AI_CONTEXTS[params.taskId as string] || (params.taskId === "task-1" ? MOCK_AI_CONTEXTS.t1 : null);
    if (!ctx) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: "Context not found", correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(ctx, { headers: { "X-Correlation-Id": corrId } });
  }),

  http.post("*/api/v1/ai/tasks/:taskId/ask", async ({ params, request }) => {
    if (aiScenarioState === "slow") {
      await delay(25000);
    } else {
      await delay(Math.floor(Math.random() * 800) + 800);
    }
    const corrId = generateUuid();

    if (serviceDownState.ai || aiScenarioState === "fail") {
      return HttpResponse.json(
        { code: "AI_UNAVAILABLE", detail: "The AI assistant is unavailable right now. The workspace and tests are not affected.", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "not_configured") {
      return HttpResponse.json(
        { code: "AI_NOT_CONFIGURED", detail: "The AI assistant isn't enabled on this server.", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (authCheck.user?.role !== "freelancer") {
      return HttpResponse.json(
        { code: "FORBIDDEN", detail: "Access denied: role freelancer required", correlationId: corrId },
        { status: 403, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    if (idempotencyKey && aiSeenIdempotencyKeys.has(idempotencyKey)) {
      return HttpResponse.json(aiSeenIdempotencyKeys.get(idempotencyKey), {
        headers: { "X-Correlation-Id": corrId },
      });
    }

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json(
        { code: "VALIDATION_FAILED", detail: "Invalid JSON body", correlationId: corrId },
        { status: 422, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (question.length < 3 || question.length > 500) {
      return HttpResponse.json(
        {
          code: "VALIDATION_FAILED",
          detail: "Question must be between 3 and 500 characters",
          correlationId: corrId,
        },
        { status: 422, headers: { "X-Correlation-Id": corrId } }
      );
    }

    aiQuestionCount++;

    if (aiScenarioState === "rate_limited" && aiQuestionCount >= 3) {
      return HttpResponse.json(
        {
          code: "RATE_LIMITED",
          detail: "You've reached the question limit. Try again in 20s.",
          correlationId: corrId,
        },
        {
          status: 429,
          headers: {
            "X-Correlation-Id": corrId,
            "Retry-After": "20",
          },
        }
      );
    }

    aiSessionQuota = Math.max(0, aiSessionQuota - 1);

    if (aiScenarioState === "hostile") {
      const hostileCitations = [
        { path: "../../etc/passwd", start_line: 1, end_line: 10, snippet: "root:x:0:0" },
        { path: "app/unknown_never_exists.py", start_line: 1, end_line: 5, snippet: "fake" },
        ...Array.from({ length: 30 }, (_, i) => ({
          path: `app/fake_${i}.py`,
          start_line: 1,
          end_line: 2,
          snippet: `Snippet ${i}`,
        })),
      ];

      const hostileResponse = {
        answer_id: `ans_hostile_${Date.now()}`,
        generated_at: "2026-11-22T10:00:00Z",
        repo_commit_sha: "a1b2c3d\u001b[31m",
        grounding: "grounded",
        answer:
          "A".repeat(6000) +
          "\n<script>alert(1)</script>\n[click](javascript:alert(1))\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789\nsk-test-1234567890abcdefghijkl\n\u001b[31mRed text\u001b[0m",
        citations: hostileCitations,
        remaining: aiSessionQuota,
      };

      if (idempotencyKey) {
        aiSeenIdempotencyKeys.set(idempotencyKey, hostileResponse);
      }
      return HttpResponse.json(hostileResponse, {
        headers: { "X-Correlation-Id": corrId },
      });
    }

    if (aiScenarioState === "no_evidence") {
      const defaultResp = {
        answer_id: `ans_def_${Date.now()}`,
        generated_at: new Date().toISOString(),
        repo_commit_sha: "a1b2c3d",
        grounding: "no_evidence",
        answer:
          "I couldn't find code in this repository that answers that. Try naming a file or a function.",
        citations: [],
        remaining: aiSessionQuota,
      };
      if (idempotencyKey) {
        aiSeenIdempotencyKeys.set(idempotencyKey, defaultResp);
      }
      return HttpResponse.json(defaultResp, {
        headers: { "X-Correlation-Id": corrId },
      });
    }

    const answer = answerQuestion(
      params.taskId as string,
      question,
      aiSessionQuota
    );

    if (idempotencyKey) {
      aiSeenIdempotencyKeys.set(idempotencyKey, answer);
    }

    return HttpResponse.json(answer, {
      headers: { "X-Correlation-Id": corrId },
    });
  }),

  // POST /ai/tasks/:taskId/explain-failure
  http.post("*/api/v1/ai/tasks/:taskId/explain-failure", async ({ params, request }) => {
    if (aiScenarioState === "slow") {
      await delay(25000);
    } else {
      await delay(Math.floor(Math.random() * 400) + 300);
    }
    const corrId = generateUuid();

    if (serviceDownState.ai || aiScenarioState === "fail") {
      return HttpResponse.json(
        {
          code: "AI_UNAVAILABLE",
          detail: "The AI assistant is unavailable right now. Your tests and submission are not affected.",
          correlationId: corrId,
        },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "not_configured") {
      return HttpResponse.json(
        {
          code: "AI_NOT_CONFIGURED",
          detail: "The AI assistant isn't enabled on this server.",
          correlationId: corrId,
        },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "rate_limited") {
      return HttpResponse.json(
        {
          code: "RATE_LIMITED",
          detail: "Rate limit exceeded. Please wait 20s.",
          correlationId: corrId,
        },
        { status: 429, headers: { "X-Correlation-Id": corrId, "Retry-After": "20" } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (authCheck.user?.role !== "freelancer") {
      return HttpResponse.json(
        { code: "FORBIDDEN", detail: "Access denied: role freelancer required", correlationId: corrId },
        { status: 403, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    if (idempotencyKey && aiSeenIdempotencyKeys.has(idempotencyKey)) {
      return HttpResponse.json(aiSeenIdempotencyKeys.get(idempotencyKey), {
        headers: { "X-Correlation-Id": corrId },
      });
    }

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json(
        { code: "VALIDATION_FAILED", detail: "Invalid JSON body", correlationId: corrId },
        { status: 422, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const { testId } = body || {};
    if (!testId || typeof testId !== "string") {
      return HttpResponse.json(
        { code: "VALIDATION_FAILED", detail: "testId is required", correlationId: corrId },
        { status: 422, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const rule = TEST_RULES.find((r) => r.testId === testId);
    if (!rule) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: `Test ${testId} not found`, correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (aiScenarioState === "hostile") {
      const hostileResp = {
        explanation_id: `exp_hostile_${Date.now()}`,
        generated_at: "2026-11-22T10:00:00Z",
        explanation:
          "<script>alert(1)</script> Hostile explanation [click](javascript:alert(1)) with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789",
        likely_cause: "Hostile likely cause with sk-test-1234567890abcdefghijkl",
        suspected_locations: [
          { path: "../../etc/passwd", start_line: 1, end_line: 5, reason: "Hostile traversal" },
          { path: "app/unknown_never_exists.py", start_line: 1, end_line: 2, reason: "Missing file" },
          { path: "app/webhooks.py", start_line: 74, end_line: 74, reason: "Real file with <script>" },
        ],
        next_steps: [
          "Step 1 with <script>alert(1)</script>",
          "Step 2: fix the issue",
        ],
      };
      if (idempotencyKey) aiSeenIdempotencyKeys.set(idempotencyKey, hostileResp);
      return HttpResponse.json(hostileResp, { headers: { "X-Correlation-Id": corrId } });
    }

    const taskId = (params.taskId as string) || "t1";
    const fileMap = getMockFileMap(taskId);
    const snapshot = fileMap[rule.file];
    const content = snapshot?.content || "";

    let startLine: number | null = null;
    if (content) {
      const lines = content.split("\n");
      if (testId === "test_webhook_idempotent_duplicate_event") {
        const idx = lines.findIndex((l) => l.includes("handle_webhook") || l.includes("processed_event_ids"));
        startLine = idx !== -1 ? idx + 1 : 74;
      } else if (testId === "test_invalid_signature_not_retried") {
        const idx = lines.findIndex((l) => l.includes("raise HTTPException") || l.includes("status_code="));
        startLine = idx !== -1 ? idx + 1 : 77;
      } else if (testId === "test_retry_backoff_schedule") {
        const idx = lines.findIndex((l) => l.includes("calculate_retry_delay"));
        startLine = idx !== -1 ? idx + 1 : 99;
      } else if (testId === "test_retry_stops_after_max_attempts") {
        const idx = lines.findIndex((l) => l.includes("should_retry") || l.includes("MAX_ATTEMPTS"));
        startLine = idx !== -1 ? idx + 1 : 103;
      } else {
        const idx = lines.findIndex((l) => l.includes(rule.needle));
        startLine = idx !== -1 ? idx + 1 : 1;
      }
    }

    let likelyCause = "The assertion failed because the implementation does not satisfy the required behavior.";
    let nextSteps: string[] = ["Review the failing assertion and line number.", "Implement the missing logic."];

    if (testId === "test_webhook_idempotent_duplicate_event") {
      likelyCause =
        "The incoming webhook handler processes duplicate event IDs without an idempotency check, creating duplicate transactions.";
      nextSteps = [
        "Add an in-memory set or store to record processed event IDs.",
        "Check if event_id is already in processed_event_ids before charging.",
        "Return an already_processed status when a duplicate event arrives.",
      ];
    } else if (testId === "test_invalid_signature_not_retried") {
      likelyCause =
        "An invalid HMAC signature raises HTTP 500 instead of HTTP 400, causing upstream payment gateways to retry indefinitely.";
      nextSteps = [
        "Update HTTPException status_code from 500 to 400 Bad Request.",
        "Include a clear detail message such as 'Invalid HMAC signature'.",
        "Run the test suite to verify the status code assertion.",
      ];
    } else if (testId === "test_retry_backoff_schedule") {
      likelyCause =
        "calculate_retry_delay returns a constant 1-second delay instead of the expected exponential schedule 2 ** attempt.";
      nextSteps = [
        "Change delay calculation in app/retry.py to return 2 ** attempt.",
        "Verify the backoff series yields [1, 2, 4, 8, 16] for attempts 0..4.",
      ];
    } else if (testId === "test_retry_stops_after_max_attempts") {
      likelyCause =
        "should_retry always returns True, causing retries to loop infinitely past the limit of 5 attempts.";
      nextSteps = [
        "Define MAX_ATTEMPTS = 5 at the top of app/retry.py.",
        "Update should_retry to check attempt < MAX_ATTEMPTS.",
        "Run tests/test_retry.py to verify termination.",
      ];
    }

    const response = {
      explanation_id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      generated_at: new Date().toISOString(),
      explanation: `Test ${testId} failed: ${rule.failMessage}`,
      likely_cause: likelyCause,
      suspected_locations: [
        {
          path: rule.file,
          start_line: startLine,
          end_line: startLine,
          reason: `Root cause suspected in ${rule.file}.`,
        },
      ],
      next_steps: nextSteps,
    };

    if (idempotencyKey) {
      aiSeenIdempotencyKeys.set(idempotencyKey, response);
    }

    return HttpResponse.json(response, { headers: { "X-Correlation-Id": corrId } });
  }),

  // POST /ai/tasks/:taskId/self-check
  http.post("*/api/v1/ai/tasks/:taskId/self-check", async ({ params, request }) => {
    const corrId = generateUuid();
    if (serviceDownState.ai || aiScenarioState === "fail") {
      return HttpResponse.json(
        { code: "AI_UNAVAILABLE", detail: "AI self-check service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }
    if (aiScenarioState === "not_configured") {
      return HttpResponse.json(
        { code: "AI_NOT_CONFIGURED", detail: "The AI assistant isn't enabled on this server.", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }
    if (aiScenarioState === "rate_limited") {
      return HttpResponse.json(
        { code: "RATE_LIMITED", detail: "Rate limit exceeded. Try again in 20s.", correlationId: corrId },
        { status: 429, headers: { "X-Correlation-Id": corrId, "Retry-After": "20" } }
      );
    }
    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    if (idempotencyKey && aiSeenIdempotencyKeys.has(idempotencyKey)) {
      return HttpResponse.json(aiSeenIdempotencyKeys.get(idempotencyKey), {
        status: 202,
        headers: { "X-Correlation-Id": corrId },
      });
    }

    const taskId = (params.taskId as string) || "t1";
    const jobId = `job_sc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    mockAiJobs.set(jobId, {
      jobId,
      taskId,
      kind: "self_check",
      status: "queued",
      createdAt: Date.now(),
      error: null,
      result: null,
    });

    const resp = { jobId };
    if (idempotencyKey) {
      aiSeenIdempotencyKeys.set(idempotencyKey, resp);
    }
    return HttpResponse.json(resp, { status: 202, headers: { "X-Correlation-Id": corrId } });
  }),

  // POST /ai/tasks/:taskId/draft-summary
  http.post("*/api/v1/ai/tasks/:taskId/draft-summary", async ({ params, request }) => {
    const corrId = generateUuid();
    if (serviceDownState.ai || aiScenarioState === "fail") {
      return HttpResponse.json(
        { code: "AI_UNAVAILABLE", detail: "AI draft service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }
    if (aiScenarioState === "not_configured") {
      return HttpResponse.json(
        { code: "AI_NOT_CONFIGURED", detail: "The AI assistant isn't enabled on this server.", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }
    if (aiScenarioState === "rate_limited") {
      return HttpResponse.json(
        { code: "RATE_LIMITED", detail: "Rate limit exceeded. Try again in 20s.", correlationId: corrId },
        { status: 429, headers: { "X-Correlation-Id": corrId, "Retry-After": "20" } }
      );
    }
    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    if (idempotencyKey && aiSeenIdempotencyKeys.has(idempotencyKey)) {
      return HttpResponse.json(aiSeenIdempotencyKeys.get(idempotencyKey), {
        status: 202,
        headers: { "X-Correlation-Id": corrId },
      });
    }

    const taskId = (params.taskId as string) || "t1";
    const jobId = `job_ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    mockAiJobs.set(jobId, {
      jobId,
      taskId,
      kind: "draft_summary",
      status: "queued",
      createdAt: Date.now(),
      error: null,
      result: null,
    });

    const resp = { jobId };
    if (idempotencyKey) {
      aiSeenIdempotencyKeys.set(idempotencyKey, resp);
    }
    return HttpResponse.json(resp, { status: 202, headers: { "X-Correlation-Id": corrId } });
  }),

  // GET /ai/jobs/:jobId
  http.get("*/api/v1/ai/jobs/:jobId", async ({ params }) => {
    const corrId = generateUuid();
    const jobId = params.jobId as string;
    const job = mockAiJobs.get(jobId);

    if (!job) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: `Job ${jobId} not found`, correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    if (serviceDownState.ai) {
      return HttpResponse.json(
        { code: "AI_UNAVAILABLE", detail: "AI service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const elapsed = Date.now() - job.createdAt;
    if (job.status !== "cancelled" && job.status !== "failed" && job.status !== "completed") {
      if (elapsed < 500) {
        job.status = "queued";
      } else if (elapsed < 2000) {
        job.status = "running";
      } else {
        if (failNextAiJobFlag) {
          job.status = "failed";
          job.error = {
            code: "AI_UNAVAILABLE",
            message: "The AI assistant is unavailable right now. Your tests and submission are not affected.",
          };
          failNextAiJobFlag = false;
        } else {
          job.status = "completed";
          const fileMap = getMockFileMap(job.taskId);
          if (job.kind === "self_check") {
            const taskObj = MOCK_TASKS[job.taskId] || MOCK_TASKS.t1;
            job.result = buildSelfCheck(fileMap, taskObj.criteria, TEST_RULES);
          } else {
            // draft_summary
            const changedFiles = Object.keys(fileMap).filter(
              (k) => !T1_INITIAL_REPO[k] || T1_INITIAL_REPO[k].content !== fileMap[k].content
            );
            const report = buildSelfCheck(fileMap, MOCK_TASKS.t1.criteria, TEST_RULES);
            const criteriaStatuses: Record<string, string> = {};
            report.criteria.forEach((c) => {
              criteriaStatuses[c.criterionId] = c.status;
            });
            job.result = buildDraft(changedFiles, criteriaStatuses, fileMap);
          }
        }
      }
    }

    return HttpResponse.json(
      {
        job_id: job.jobId,
        kind: job.kind,
        status: job.status,
        error: job.error,
        result: job.result,
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),

  // POST /ai/jobs/:jobId/cancel
  http.post("*/api/v1/ai/jobs/:jobId/cancel", async ({ params }) => {
    const corrId = generateUuid();
    const jobId = params.jobId as string;
    const job = mockAiJobs.get(jobId);

    if (job && job.status !== "completed" && job.status !== "failed") {
      job.status = "cancelled";
    }

    return HttpResponse.json(
      { jobId, status: "cancelled" },
      { status: 202, headers: { "X-Correlation-Id": corrId } }
    );
  }),
];

// ==================== PAYMENT HANDLERS ====================
export const paymentHandlers: HttpHandler[] = [
  http.get("*/api/v1/payments/escrow/:taskId", async ({ params, request }) => {
    await delay(Math.floor(Math.random() * 400) + 300);
    const corrId = generateUuid();

    if (serviceDownState.payment) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Payment service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const escrow = MOCK_ESCROWS[params.taskId as string];
    if (!escrow) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: "Escrow record not found", correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(escrow, { headers: { "X-Correlation-Id": corrId } });
  }),
  http.get("*/api/v1/payment/escrow/:taskId", async ({ params, request }) => {
    await delay(Math.floor(Math.random() * 400) + 300);
    const corrId = generateUuid();

    if (serviceDownState.payment) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Payment service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const escrow = MOCK_ESCROWS[params.taskId as string];
    if (!escrow) {
      return HttpResponse.json(
        { code: "NOT_FOUND", detail: "Escrow record not found", correlationId: corrId },
        { status: 404, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json(escrow, { headers: { "X-Correlation-Id": corrId } });
  }),
];

// ==================== NOTIFICATION HANDLERS ====================
export const notificationHandlers: HttpHandler[] = [
  http.get("*/api/v1/notifications", async ({ request }) => {
    await delay(300);
    const corrId = generateUuid();

    if (serviceDownState.notification) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Notification service unavailable", correlationId: corrId },
        { status: 503, headers: { "X-Correlation-Id": corrId } }
      );
    }

    const authCheck = verifyAuth(request);
    if (!authCheck.valid) {
      return HttpResponse.json(
        { code: authCheck.code, detail: authCheck.detail, correlationId: corrId },
        { status: authCheck.status, headers: { "X-Correlation-Id": corrId } }
      );
    }

    return HttpResponse.json({ items: [] }, { headers: { "X-Correlation-Id": corrId } });
  }),
];

// ==================== PROJECT HANDLERS ====================
export const projectHandlers: HttpHandler[] = [
  http.get("*/api/v1/projects", async () => {
    await delay(300);
    const corrId = generateUuid();
    return HttpResponse.json(
      {
        items: [
          {
            id: "proj_1024",
            title: "Fix payment callback webhook race condition & idempotency",
            description: "Investigate and fix payment webhook race condition...",
            budget: 5000,
            currency: "INR",
            deadline: "2026-09-10",
            required_skills: ["Python", "FastAPI", "PostgreSQL", "Redis", "Pytest"],
            status: "IN_PROGRESS",
            owner_id: "usr_owner_1",
          },
        ],
        total: 1,
        page: 1,
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),
  http.get("*/api/v1/projects/:id", async ({ params }) => {
    await delay(300);
    const corrId = generateUuid();
    return HttpResponse.json(
      {
        id: params.id,
        title: "Fix payment callback webhook race condition & idempotency",
        description: "Multiple gateway callbacks arriving within 50ms cause concurrent transactions...",
        expected_result: "All incoming callback events must be idempotent.",
        budget: 5000,
        currency: "INR",
        deadline: "2026-09-10",
        required_skills: ["Python", "FastAPI", "PostgreSQL", "Redis", "Pytest"],
        status: "IN_PROGRESS",
        owner_name: "CodeBridge FinTech Team",
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),
];

// ==================== PROFILE HANDLERS ====================
export const profileHandlers: HttpHandler[] = [
  http.get("*/api/v1/profile/verified-work", async () => {
    await delay(300);
    const corrId = generateUuid();
    return HttpResponse.json(
      {
        records: [
          {
            id: "CB-VER-891",
            project_id: "proj_1024",
            project_title: "Fix payment callback idempotency & signature verification",
            completed_at: "2026-09-08T18:30:00.000Z",
            payout_amount: 5000,
            currency: "INR",
            payout_status: "RELEASED",
            skills_proven: ["Python", "FastAPI", "PostgreSQL", "Pytest", "Idempotency"],
            verification_badge: "VERIFIED_TEST_PASS_100",
            repo_ref: "git.codebridge.dev/repos/proj_1024@c4b2a8f",
            reviewer: "Verified by CodeBridge Automated Escrow Test-Gate",
            recruiter_proof_url: "https://verify.codebridge.dev/c/CB-VER-891-92A8",
          },
        ],
      },
      { headers: { "X-Correlation-Id": corrId } }
    );
  }),
];

export const serviceHandlers: Record<string, HttpHandler[]> = {
  identity: identityHandlers,
  workspace: workspaceHandlers,
  submission: submissionHandlers,
  ai: aiHandlers,
  payment: paymentHandlers,
  notification: notificationHandlers,
  project: projectHandlers,
  profile: profileHandlers,
};

export const handlers: HttpHandler[] = [
  ...identityHandlers,
  ...workspaceHandlers,
  ...submissionHandlers,
  ...aiHandlers,
  ...paymentHandlers,
  ...notificationHandlers,
  ...projectHandlers,
  ...profileHandlers,
];

export function getHandlersForServices(serviceNames: string[]): HttpHandler[] {
  const result: HttpHandler[] = [];
  for (const name of serviceNames) {
    const key = name.toLowerCase().trim();
    if (serviceHandlers[key]) {
      result.push(...serviceHandlers[key]);
    }
  }
  return result;
}
