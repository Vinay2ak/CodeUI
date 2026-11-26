# CodeBridge AI & Review Integration Notes

This document provides a comparative analysis between the frontend contracts (`docs/CROSS_APP_CONTRACT.md`), the integration notes (`INTEGRATION_NOTES.md`), and the real backend specification (`FRONTEND_CONTRACT.md`) for **Part A (AI Developer Brief)** and **Part B (Review & Payment Verification)**.

---

## 1. Executive Summary & Architecture Boundaries

1. **Advisory Role of AI**:
   - Both the AI Developer Brief (Part A) and the AI Verification Scorecard (Part B) are strictly advisory.
   - The backend contract (`FRONTEND_CONTRACT.md`) defines raw endpoints for code indexing (`/api/v1/code-context/...`), review management (`/api/v1/review/...`, `/api/v1/submissions/...`), and escrow settlement (`/api/v1/payment/...`).
   - The decision guard (`computeDecisionGuard`) completely isolates human review and payment release actions from AI results. AI reports never enable or disable financial actions.

2. **Untrusted Data Sanitization**:
   - Both AI responses and container execution logs are untrusted.
   - All text rendered on screen passes through `safeLine` and `redactSecrets`, neutralizing embedded API tokens, secrets, or script payloads.
   - Plain-text React elements are used exclusively (no `dangerouslySetInnerHTML`, no Markdown HTML parsers).

3. **Mocking & Fallback Architecture**:
   - When running in mock mode (`VITE_USE_MOCKS=true`), all services run client-side with full scenario simulation (`pass`, `mixed`, `fail`).
   - When running against the live backend (`VITE_USE_MOCKS=false`), endpoints not yet implemented or requiring adaptation can be selectively intercepted using `VITE_MOCK_SERVICES=talent,identity,review,verification`.

---

## 2. Capability Mapping Table (Part A & Part B)

The table below maps every internal frontend endpoint used by Part A and Part B to its counterpart in the real backend (`FRONTEND_CONTRACT.md`), noting its availability status and required environment variables.

| Capability / Flow | Frontend Internal Endpoint | Real Backend Endpoint | Status | Environment Values / Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **Part A: Create Project** | `POST /api/v1/projects` | `POST /api/v1/projects` | `adapted` | `VITE_API_BASE_URL=/api/v1` |
| **Part A: Draft Project Patch** | `PATCH /api/v1/projects/{id}` | NOT FOUND (Backend uses PUT or single-shot POST) | `mock needed` | Simulated via `VITE_MOCK_SERVICES=project` or internal state |
| **Part A: Publish Draft** | `POST /api/v1/projects/{id}/publish` | NOT FOUND (Backend transitions via task/status) | `mock needed` | Simulated via `VITE_MOCK_SERVICES=project` |
| **Part A: Save Confirmed Brief** | `POST /api/v1/projects/{id}/brief` | NOT FOUND (Stored in project metadata/DB) | `mock needed` | Stored in `project.aiVerification.confirmedBrief` |
| **Part A: Get Confirmed Brief** | `GET /api/v1/projects/{id}/brief` | NOT FOUND | `mock needed` | Fallback to `project.aiVerification.confirmedBrief` |
| **Part A: Connect GitHub Repo** | `POST /api/v1/github/repos/connect` | `POST /api/v1/projects/{id}/github` | `adapted` | Maps repo URL & validates read-only permissions |
| **Part A: GitHub Repo Status** | `GET /api/v1/github/repos/{owner}/{repo}/status` | `GET /api/v1/projects/{id}/github` | `adapted` | Extracts branch, permissions, commit SHA |
| **Part A: Start Brief Job** | `POST /api/v1/code-context/brief-jobs` | NOT FOUND (Backend provides `/code-context/projects/{id}/index` and `/insights/generate`) | `mock needed` | Requires backend adapter or `VITE_USE_MOCKS=true` |
| **Part A: Poll Brief Job** | `GET /api/v1/code-context/brief-jobs/{jobId}` | NOT FOUND (Backend provides `/insights`) | `mock needed` | Requires backend adapter or `VITE_USE_MOCKS=true` |
| **Part A: Cancel Brief Job** | `POST /api/v1/code-context/brief-jobs/{jobId}/cancel` | NOT FOUND | `mock needed` | Handled client-side via abort controller |
| **Part B: Current Submission** | `GET /api/v1/projects/{id}/submissions/current` | `GET /api/v1/submissions/current?taskId={id}` or `GET /api/v1/submissions/projects/{id}` | `adapted` | Normalizes submission status, developer, commit SHA |
| **Part B: Review Decision** | `POST /api/v1/projects/{id}/review` | `POST /api/v1/review/submissions/{id}/decision` | `adapted` | Maps `decision: "approve" \| "changes_requested"` to backend enum |
| **Part B: Automated Run & Checks** | `GET /api/v1/submissions/{id}/automated-run` | `GET /api/v1/submissions/runs/{run_id}` | `adapted` | Unpacks test check results and log tails |
| **Part B: Check Log Stream** | `GET /api/v1/submissions/{id}/automated-run/checks/{checkId}/log` | NOT FOUND (Backend container logs not exposed via public API) | `mock needed` | Intercepted via MSW (`reviewMock.ts`) |
| **Part B: AI Verification Report** | `GET /api/v1/submissions/{id}/ai-verification` | NOT FOUND (Automated AI verification report endpoint not implemented in backend) | `mock needed` | Controlled by `VITE_FEATURE_AI_VERIFICATION` |
| **Part B: Rerun AI Verification** | `POST /api/v1/submissions/{id}/ai-verification` | NOT FOUND | `mock needed` | Controlled by `VITE_FEATURE_AI_VERIFICATION` |
| **Part B: Project Escrow Payment** | `GET /api/v1/projects/{id}/payment` | `GET /api/v1/payment/projects/{id}` or `GET /api/v1/payment/escrows/{id}` | `adapted` | Maps `state: "held" \| "released"` and amount |
| **Part B: Release Escrow Payment** | `POST /api/v1/projects/{id}/payment/release` | `POST /api/v1/payment/escrows/{id}/release` | `adapted` | Idempotent release with `Idempotency-Key` header |
| **Part B: Realtime Event** | `submission.status_changed` | WebSocket event envelope over `/api/v1/notifications/ws` | `adapted` | Received and handled in `src/realtime/` |

---

## 3. Environment Configuration Directives

To run the application with the full AI Developer Brief and Review & Payment flows:

```env
# Full standalone development with mock data & scenarios
VITE_USE_MOCKS=true

# Feature flags:
# Unset defaults to enabled in mock mode, disabled in production
VITE_FEATURE_AI_BRIEF=
VITE_DRAFT_PUBLISH=
VITE_FEATURE_AI_VERIFICATION=

# When connecting to a real backend gateway where specific services are incomplete:
# VITE_USE_MOCKS=false
# VITE_MOCK_SERVICES=talent,identity,review,verification
# VITE_GATEWAY_URL=http://localhost:8000
```
