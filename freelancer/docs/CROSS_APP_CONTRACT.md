# CodeBridge Cross-App Contract

## 1. Links and Inter-App Navigation
- CodeBridge is partitioned into independently built and deployed apps:
  - Auth: sign in, sign up, onboarding (`VITE_SIGNIN_URL`, default `http://localhost:5173/login`; `VITE_REGISTER_URL`, default `http://localhost:5173/register`)
  - Dashboard: `/owner`, `/freelancer`, `/admin` (`VITE_DASHBOARD_URL`, default `http://localhost:5175`)
  - Account: profile and settings (`VITE_ACCOUNT_URL`, default `http://localhost:5176/`)
  - Developer Workspace: this app (`http://localhost:5177`, accepts `?task=<taskId>` query param)
- Links between apps **must** use plain `<a href="...">` or `window.location.assign(...)` referencing environment variables.
- Never use client-side router links across apps, and never use `<iframe>` embedding across apps.
- Dev Ports:
  - Auth: 5173
  - Dashboard: 5175
  - Account: 5176
  - Freelancer (this app): 5177

## 2. Session and Authentication
- The session refresh token is an `httpOnly` cookie set by the Identity service and shared across all apps under a common origin behind the gateway.
- The Developer Workspace app stores the short-lived access token **in memory only**.
- On startup and after page refresh, the session is restored via `POST /api/v1/auth/refresh`.
- Access tokens, refresh tokens, and credentials must **never** be placed in URLs, `localStorage`, or `sessionStorage`.

## 3. Mock Cookie Contract
- In mock mode (`VITE_USE_MOCKS=true`), a simulated refresh cookie `mock_rt` is used.
- Value: Base64-encoded JSON representation of:
  ```json
  {
    "id": "usr_dev_123",
    "email": "ravi@example.com",
    "displayName": "Ravi Freelancer",
    "role": "freelancer",
    "status": "active",
    "createdAt": "2026-01-15T10:00:00Z",
    "onboardingCompleted": true
  }
  ```
- Cookie attributes: `path=/; max-age=604800; SameSite=Lax`.
- Written and read strictly inside `mocks/`. Missing `onboardingCompleted` defaults to `true`.
- Mock file editing persistence uses `sessionStorage` with key `mock.workspace.files.v1` inside `mocks/simulator.ts` only.

## 4. Route and Access Guards
Guards execute after `restoreSession()` completes:
1. **No Session (401 / unauthenticated)**:
   Redirect to `VITE_SIGNIN_URL` via `window.location.assign(VITE_SIGNIN_URL)`.
2. **Incomplete Onboarding (`onboardingCompleted === false`)**:
   Redirect to `${VITE_REGISTER_URL}?resume=1`.
3. **Role Mismatch (`role !== "freelancer"`)**:
   Redirect to `${VITE_DASHBOARD_URL}/${role}`. Role is for navigational routing only, not authorization.

## 5. Logout Synchronization
- Sign-out issues `POST /api/v1/auth/logout` (failures ignored), clears local in-memory session, posts `{ type: "logout" }` on the `BroadcastChannel("cb-auth")`, and redirects to `VITE_SIGNIN_URL`.
- Any tab receiving the `logout` broadcast event immediately clears its local in-memory session and redirects to `VITE_SIGNIN_URL`.

## 6. Service Endpoints (Under `/api/v1`, Bearer Auth, camelCase JSON, INR Currency)
- **Identity Service**:
  - `POST /auth/refresh` -> `{ accessToken: string, expiresIn: number }`
  - `POST /auth/logout` -> `204 No Content`
  - `GET /users/me` -> `User { id, email, displayName, role, status, createdAt, onboardingCompleted }`
- **Workspace Service**:
  - `GET /tasks/mine` -> `{ items: TaskSummary[] }`
  - `GET /tasks/{id}` -> `Task`
  - `GET /workspaces/{taskId}` -> `Workspace`
  - `POST /workspaces/{taskId}/start` -> `202 Accepted`
  - `POST /workspaces/{taskId}/stop` -> `202 Accepted`
  - `POST /workspaces/{taskId}/reset` -> `202 Accepted`
  - `GET /workspaces/{taskId}/files` -> `{ commit: string, items: FileItem[] }`
  - `GET /workspaces/{taskId}/files/content?path=` -> `{ path, language, content }`
  - `PUT /workspaces/{taskId}/files/content` -> `{ savedAt: string }`
- **Submission Service**:
  - `POST /submissions/runs` `{ taskId }` -> `202 Accepted { runId: string }`
  - `GET /submissions/runs/{runId}` -> `Run`
  - `POST /submissions` `{ taskId, notes }` -> `201 Created { submissionId: string, status: "in_review" }` (409 if gate not satisfied)
  - `GET /submissions/current?taskId=` -> `{ status, note?, lastRun? }`
- **AI Context Service**:
  - `GET /ai/context/{taskId}` -> `{ summary, findings, relevantFiles, approach }` (404 when absent)
- **Payment Service**:
  - `GET /payments/escrow/{taskId}` -> `{ state: "authorized"|"held"|"tested"|"approved"|"released", amount, currency: "INR" }`
- **Notification Service**:
  - `GET /notifications` -> `{ items: CbEvent[] }`

## 7. Event Envelope and Subscriptions
Envelope schema:
```typescript
interface CbEnvelope<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  source: string;
  correlationId: string;
  data: T;
}
```
Event types consumed by the Freelancer app:
- `workspace.status_changed`: `{ taskId: string, status: "stopped" | "provisioning" | "starting" | "running" | "idle" | "error" }`
- `test.run.progress`: `{ taskId: string, runId: string, testId: string, status: "running" | "passed" | "failed" }`
- `test.run.completed`: `{ taskId: string, runId: string, passed: number, failed: number, requiredPassed: boolean }`
- `submission.status_changed`: `{ taskId: string, status: "in_review" | "approved" | "changes_requested", note?: string }`
- `payment.state_changed`: `{ taskId: string, state: "authorized" | "held" | "tested" | "approved" | "released" }`
- `task.assigned`: `{ taskId: string, title: string, projectTitle: string }`

## 8. Realtime Connection
- WebSocket URL configured via `VITE_WS_URL` (default: `/ws/events`, converted to `ws://` / `wss://` based on window origin).
- Handshake protocol:
  1. Client opens connection.
  2. Client sends: `{"type": "auth", "token": "<access_token>"}`.
  3. Server acknowledges: `{"type": "auth.ok"}`.
  4. Server streams event envelopes.
  5. Client re-sends auth message after each token refresh.
- Reconnection uses exponential backoff: `min(30000, 1000 * 2^attempt) ± 20% jitter`.
- Mock mode: Handled via `BroadcastChannel("cb-events")` plus local event simulators.

## 9. AI Assistant (Part A)
- **Scope & Role**: Advisory code intelligence assisting freelancers in understanding task context, architecture, dependencies, and codebases before and during editing.
- **Principles & Security**:
  - AI is strictly advisory: it never executes shell commands, writes to workspace files, triggers submissions, or modifies deterministic container test gates.
  - The client transmits references only (`taskId`, user question string 3-500 chars, optional `focusPath`). Raw file contents, diffs, terminal outputs, and logs are NEVER sent by the browser.
  - All AI responses are considered untrusted text: sanitized, bounded in size, control codes stripped, secrets masked, and rendered strictly as PLAIN TEXT (no HTML, script tags, auto-links, or markdown renderer execution).
- **Service Endpoints** (under `/api/v1`, Bearer auth, camelCase JSON, role `freelancer` assigned to the task only, otherwise `403 FORBIDDEN`):
  - `GET /ai/capabilities` -> `{ provider: "none" | "mock" | "llm", features: { context, ask, explain, selfCheck, draft: boolean }, limits: { askPerHour: number | null } }`. A 404 response means unknown (falls back to client feature flags).
  - `GET /ai/context/{taskId}` -> `AiContext` (or 404 NOT_FOUND when absent).
  - `POST /ai/tasks/{taskId}/ask` (Header `Idempotency-Key`) `{ question: string, focusPath?: string }` -> `200 AskAnswer`.
- **Types**:
  - `AiContext`: `{ generatedAt?: string, repoCommitSha?: string, summary: string, findings: string[], relevantFiles: { path: string, startLine: number | null, endLine: number | null, score: number, reason: string }[], dependencies: { name: string, kind: "runtime" | "dev" | "service" | "other", note: string }[], affectedAreas: { name: string, note: string }[], setupHints: { command: string, note: string }[], approach: string[] }`
  - `AskAnswer`: `{ answerId: string, generatedAt: string, repoCommitSha: string, grounding: "grounded" | "no_evidence", answer: string, citations: { path: string, startLine: number | null, endLine: number | null, snippet: string | null }[], remaining: number | null }`
- **Error Codes**:
  - `AI_NOT_CONFIGURED` (501 or 503)
  - `AI_UNAVAILABLE` (503)
  - `AI_TIMEOUT` (504)
  - `RATE_LIMITED` (429 with `Retry-After` header)
  - `NOT_FOUND` (404)
  - `FORBIDDEN` (403)
  - `CONFLICT` (409)
  - `VALIDATION_FAILED` (422)



## AI Assistant Contract Specification (Part B)

All endpoints reside under `/api/v1`, accept Bearer token authentication, communicate via camelCase JSON, and authorize the assigned freelancer for the specified task only.

### 1. Failure Explanation
- `POST /ai/tasks/{taskId}/explain-failure`
  - Headers: `Idempotency-Key: <uuid>`
  - Request: `{ runId: string, testId: string }`
  - Response (200):
    ```json
    {
      "explanationId": "string",
      "generatedAt": "ISO string",
      "explanation": "string (clamped 1200)",
      "likelyCause": "string (clamped 400)",
      "suspectedLocations": [
        {
          "path": "string",
          "startLine": 1,
          "endLine": 1,
          "reason": "string"
        }
      ],
      "nextSteps": ["string (max 6 items, clamped 240)"]
    }
    ```

### 2. Async Jobs (Self-Check and Draft Summary)
- `POST /ai/tasks/{taskId}/self-check` -> `202 { "jobId": "string" }`
- `POST /ai/tasks/{taskId}/draft-summary` -> `202 { "jobId": "string" }`
- `GET /ai/jobs/{jobId}` ->
  ```json
  {
    "jobId": "string",
    "kind": "self_check | draft_summary",
    "status": "queued | running | completed | failed | cancelled",
    "error": { "code": "string", "message": "string" } | null,
    "result": SelfCheckReport | DraftSummary | null
  }
  ```
- `POST /ai/jobs/{jobId}/cancel` -> `202 { "jobId": "string", "status": "cancelled" }`

### 3. Schemas
- `SelfCheckReport`: `{ reportId, generatedAt, repoCommitSha, criteria: [...], risks: [...] }`
- `DraftSummary`: `{ draftId, generatedAt, summary, filesModified: [...], notes }`
