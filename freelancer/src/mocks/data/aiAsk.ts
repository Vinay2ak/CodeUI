import type { AskAnswer } from "../../services/ai/types";

export function answerQuestion(
  taskId: string,
  question: string,
  remaining: number | null = 20
): AskAnswer {
  void taskId;
  const q = question.toLowerCase();
  const now = new Date().toISOString();
  const repoCommitSha = "a1b2c3d";

  // Route 1: test, pytest
  if (q.includes("test") || q.includes("pytest")) {
    return {
      answerId: `ans_test_${Date.now()}`,
      generatedAt: now,
      repoCommitSha,
      grounding: "grounded",
      answer:
        "The repository includes automated test suites in the `tests/` directory. `tests/test_webhooks.py` tests duplicate webhook handling and idempotency, while `tests/test_retry.py` validates that backoff schedules adhere to the exponential requirements.",
      citations: [
        {
          path: "tests/test_webhooks.py",
          startLine: 1,
          endLine: 6,
          snippet: "@pytest.mark.asyncio\nasync def test_duplicate_webhook_deduplicated():",
        },
        {
          path: "tests/test_retry.py",
          startLine: 1,
          endLine: 4,
          snippet: "def test_exponential_backoff():\n    pass",
        },
      ],
      remaining,
    };
  }

  // Route 2: webhook, duplicate, idempotent
  if (q.includes("webhook") || q.includes("duplicate") || q.includes("idempotent")) {
    return {
      answerId: `ans_wh_${Date.now()}`,
      generatedAt: now,
      repoCommitSha,
      grounding: "grounded",
      answer:
        "The webhook endpoint is defined in `app/webhooks.py` inside `handle_webhook`. It processes incoming event deliveries but currently lacks a deduplication mechanism to track previously seen event IDs. To resolve duplicate charges, initialize an idempotent store `processed_event_ids` to track processed IDs and return early.\n\n```python\nif event_id in processed_event_ids:\n    return {\"status\": \"already_processed\", \"eventId\": event_id}\n```",
      citations: [
        {
          path: "app/webhooks.py",
          startLine: 12,
          endLine: 26,
          snippet: "async def handle_webhook(payload: bytes, signature: str):",
        },
      ],
      remaining,
    };
  }

  // Route 2: retry, backoff, attempts
  if (q.includes("retry") || q.includes("backoff") || q.includes("attempts")) {
    return {
      answerId: `ans_rt_${Date.now()}`,
      generatedAt: now,
      repoCommitSha,
      grounding: "grounded",
      answer:
        "Retry logic is implemented in `app/retry.py`. Currently, `calculate_retry_delay` returns a constant 1-second delay and `should_retry` lacks a maximum attempt bound. You should enforce exponential backoff `2 ** attempt` and cap execution at 5 attempts.\n\n```python\nMAX_ATTEMPTS = 5\ndef calculate_retry_delay(attempt: int) -> int:\n    return 2 ** attempt\n```",
      citations: [
        {
          path: "app/retry.py",
          startLine: 3,
          endLine: 15,
          snippet: "def calculate_retry_delay(attempt: int) -> int:\n    delay = 1\n    return delay",
        },
      ],
      remaining,
    };
  }

  // Route 3: signature, 400
  if (q.includes("signature") || q.includes("400")) {
    return {
      answerId: `ans_sig_${Date.now()}`,
      generatedAt: now,
      repoCommitSha,
      grounding: "grounded",
      answer:
        "In `app/webhooks.py`, the `verify_signature` function validates HMAC signatures against the shared secret. If verification fails, the handler currently raises HTTP 500, which causes partner services to retry continuously. Updating this status code to 400 Bad Request halts unnecessary retries on malformed or forged payloads.",
      citations: [
        {
          path: "app/webhooks.py",
          startLine: 8,
          endLine: 15,
          snippet: "def verify_signature(payload: bytes, signature: str) -> bool:",
        },
      ],
      remaining,
    };
  }

  // Route 4: state machine, hold, release
  if (q.includes("state machine") || q.includes("hold") || q.includes("release")) {
    return {
      answerId: `ans_sm_${Date.now()}`,
      generatedAt: now,
      repoCommitSha,
      grounding: "grounded",
      answer:
        "Payment lifecycle transitions are managed by `PaymentStateMachine` in `app/state_machine.py`. The state moves from `authorized` to `held` via `hold()`, and requires verified approval before advancing to `released` via `release()`. These guard assertions ensure money cannot be moved without validation.",
      citations: [
        {
          path: "app/state_machine.py",
          startLine: 9,
          endLine: 24,
          snippet: "class PaymentStateMachine:\n    def __init__(self, initial_state=PaymentState.AUTHORIZED):",
        },
      ],
      remaining,
    };
  }

  // Route 5: setup, run, install
  if (q.includes("setup") || q.includes("run") || q.includes("install")) {
    return {
      answerId: `ans_setup_${Date.now()}`,
      generatedAt: now,
      repoCommitSha,
      grounding: "grounded",
      answer:
        "To set up the service, install dependencies listed in `requirements.txt` using `pip install -r requirements.txt`. You can then launch the FastAPI service locally using Uvicorn as documented in `README.md`.",
      citations: [
        {
          path: "requirements.txt",
          startLine: 1,
          endLine: 6,
          snippet: "fastapi==0.111.0\nuvicorn==0.30.1",
        },
        {
          path: "README.md",
          startLine: 5,
          endLine: 10,
          snippet: "pip install -r requirements.txt\nuvicorn app.main:app --port 8000",
        },
      ],
      remaining,
    };
  }

  // Default: ungrounded fallback
  return {
    answerId: `ans_def_${Date.now()}`,
    generatedAt: now,
    repoCommitSha,
    grounding: "no_evidence",
    answer:
      "I couldn't find code in this repository that answers that. Try naming a file or a function.",
    citations: [],
    remaining,
  };
}
