# AI Integration Notes & Real-Backend Mapping

This document maps the Freelancer AI Assistant capabilities to the real backend (`code-context-service:8004` / API Gateway).

Backend LLM provider: unknown
If the backend runs with no LLM provider, every AI call answers AI_NOT_CONFIGURED and the UI shows the not-enabled states; ask the backend owner to configure the provider before a demo.

## Capability Mapping Table

| AI Capability | Internal Endpoint | Real Backend Endpoint | Conformance Status | Required Env Configuration |
| :--- | :--- | :--- | :--- | :--- |
| **Capabilities** | `GET /api/v1/ai/capabilities` | `NOT FOUND` | missing in backend (use the mock or turn the flag off) | `VITE_MOCK_SERVICES=ai` or default fallback to provider none |
| **Context** | `GET /api/v1/ai/context/{taskId}` | `GET /api/v1/ai/context/{task_id}` | works as-is | `VITE_FEATURE_AI=true`, `VITE_AI_FEATURES=context` |
| **Ask AI** | `POST /api/v1/ai/tasks/{taskId}/ask` | `POST /api/v1/code-context/projects/{id}/query` | adapted (what changed: mapped query/top_k payload to question/focusPath and adapted citation file_path/snippet/score) | `VITE_FEATURE_AI=true`, `VITE_AI_FEATURES=ask` |
| **Explain Failure** | `POST /api/v1/ai/tasks/{taskId}/explain-failure` | `NOT FOUND` | missing in backend (use the mock or turn the flag off) | `VITE_MOCK_SERVICES=ai`, `VITE_FEATURE_AI=true`, `VITE_AI_FEATURES=explain` |
| **Self-Check** | `POST /api/v1/ai/tasks/{taskId}/self-check` | `NOT FOUND` | missing in backend (use the mock or turn the flag off) | `VITE_MOCK_SERVICES=ai`, `VITE_FEATURE_AI=true`, `VITE_AI_FEATURES=selfcheck` |
| **Draft Summary** | `POST /api/v1/ai/tasks/{taskId}/draft-summary` | `NOT FOUND` | missing in backend (use the mock or turn the flag off) | `VITE_MOCK_SERVICES=ai`, `VITE_FEATURE_AI=true`, `VITE_AI_FEATURES=draft` |
| **Job Polling** | `GET /api/v1/ai/jobs/{jobId}` | `NOT FOUND` | missing in backend (use the mock or turn the flag off) | `VITE_MOCK_SERVICES=ai` |
| **Cancel Job** | `POST /api/v1/ai/jobs/{jobId}/cancel` | `NOT FOUND` | missing in backend (use the mock or turn the flag off) | `VITE_MOCK_SERVICES=ai` |

## Environment Configuration
- Full mock mode: `VITE_USE_MOCKS=true`
- Live backend with AI mocked: `VITE_MOCK_SERVICES=ai`
- Feature toggling: `VITE_FEATURE_AI=true`, `VITE_AI_FEATURES=context,ask,explain,selfcheck,draft`
