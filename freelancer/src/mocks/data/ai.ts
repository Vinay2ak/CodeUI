import type { AiContext } from "../../services/ai/types";

export const MOCK_AI_CONTEXTS: Record<string, AiContext> = {
  t1: {
    generatedAt: "2026-11-18T10:00:00.000Z",
    repoCommitSha: "a1b2c3d",
    summary:
      "The webhook ingestion service fails to de-duplicate incoming requests, leading to multiple ledger debits during partner network retries (simulated). Furthermore, signature verification errors trigger HTTP 500 internal server responses rather than HTTP 400 client rejections, perpetuating upstream retry storms (simulated). The backoff calculation in app/retry.py is also hardcoded to a static 1-second delay without an iteration bound (simulated).",
    findings: [
      "Missing idempotent event cache: app/webhooks.py executes record_payment_charge without verifying prior event IDs (simulated).",
      "Unhandled exception on invalid HMAC signature raises an HTTP 500 instead of HTTP 400 Bad Request, violating the partner webhook contract (simulated).",
      "Retry scheduler lacks exponential backoff and does not terminate after the mandated 5 attempts (simulated).",
    ],
    relevantFiles: [
      {
        path: "app/webhooks.py",
        startLine: 1,
        endLine: 28,
        score: 0.94,
        reason: "Handler has no de-duplication and answers a bad signature with 500",
      },
      {
        path: "app/retry.py",
        startLine: 1,
        endLine: 18,
        score: 0.88,
        reason: "Constant delay and no attempt limit",
      },
      {
        path: "app/state_machine.py",
        startLine: 1,
        endLine: 25,
        score: 0.52,
        reason: "Transitions must stay intact",
      },
      {
        path: "tests/test_webhooks.py",
        startLine: 1,
        endLine: 7,
        score: 0.47,
        reason: "Integration test coverage for duplicate webhook deliveries",
      },
      {
        path: "tests/test_retry.py",
        startLine: 1,
        endLine: 5,
        score: 0.41,
        reason: "Unit tests verifying exponential backoff sequence",
      },
    ],
    dependencies: [
      {
        name: "fastapi",
        kind: "runtime",
        note: "FastAPI core web framework and async request routing",
      },
      {
        name: "uvicorn",
        kind: "runtime",
        note: "ASGI production server implementation",
      },
      {
        name: "sqlalchemy",
        kind: "runtime",
        note: "ORM and relational database query construction",
      },
      {
        name: "pytest",
        kind: "dev",
        note: "Automated container test runner and assertion framework",
      },
      {
        name: "payments-gateway",
        kind: "service",
        note: "Upstream partner webhook source emitting authorization events",
      },
    ],
    affectedAreas: [
      {
        name: "Webhook handling",
        note: "Inbound HMAC signature validation and event idempotency deduplication",
      },
      {
        name: "Retry scheduling",
        note: "Exponential backoff calculation and bounded retry attempt gating",
      },
      {
        name: "Payment state machine",
        note: "State transition integrity for authorized, held, and released funds",
      },
    ],
    setupHints: [
      {
        command: "pip install -r requirements.txt",
        note: "Install pinned Python dependencies",
      },
      {
        command: "pytest -q",
        note: "Execute headless automated test gate",
      },
      {
        command: "uvicorn app.main:app --reload",
        note: "Start local development server with hot reloading",
      },
    ],
    approach: [
      "1. Add an in-memory set or Redis-compatible store `processed_event_ids` in `app/webhooks.py` to discard already processed event IDs with a 200/already_processed status (simulated).",
      "2. Change the HTTPException in `app/webhooks.py` for signature mismatch from 500 to 400 (simulated).",
      "3. In `app/retry.py`, implement exponential delay `2 ** attempt` and enforce `MAX_ATTEMPTS = 5` in `should_retry` (simulated).",
      "4. Verify `app/state_machine.py` retains `def hold` and `def release` with approval checks intact (simulated).",
      "5. Update `README.md` to document the idempotency guarantees and verify with the test suite (simulated).",
    ],
  },
};
