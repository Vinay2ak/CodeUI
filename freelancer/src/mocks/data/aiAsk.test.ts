import { describe, it, expect } from "vitest";
import { answerQuestion } from "./aiAsk";
import { MOCK_AI_CONTEXTS } from "./ai";
import { T1_INITIAL_REPO } from "./repo";

describe("aiAsk / answerQuestion keyword routing", () => {
  it("routes webhook questions with code block and webhooks.py citation", () => {
    const res = answerQuestion("t1", "Where is the webhook handled?");
    expect(res.grounding).toBe("grounded");
    expect(res.answer).toContain("```python");
    expect(res.citations.some((c) => c.path === "app/webhooks.py")).toBe(true);
  });

  it("routes retry and backoff questions with code block and retry.py citation", () => {
    const res = answerQuestion("t1", "How does exponential backoff work?");
    expect(res.grounding).toBe("grounded");
    expect(res.answer).toContain("calculate_retry_delay");
    expect(res.citations.some((c) => c.path === "app/retry.py")).toBe(true);
  });

  it("routes signature verification questions", () => {
    const res = answerQuestion("t1", "What happens on invalid signature 400?");
    expect(res.grounding).toBe("grounded");
    expect(res.answer).toContain("HMAC");
    expect(res.citations[0].path).toBe("app/webhooks.py");
  });

  it("routes state machine hold and release questions", () => {
    const res = answerQuestion("t1", "Explain the payment state machine hold release");
    expect(res.grounding).toBe("grounded");
    expect(res.answer).toContain("PaymentStateMachine");
    expect(res.citations[0].path).toBe("app/state_machine.py");
  });

  it("routes test and pytest questions", () => {
    const res = answerQuestion("t1", "Which pytest tests cover duplicate webhooks?");
    expect(res.grounding).toBe("grounded");
    expect(res.citations.length).toBeGreaterThanOrEqual(1);
    expect(res.citations[0].path).toContain("tests/");
  });

  it("routes setup and install questions", () => {
    const res = answerQuestion("t1", "How do I run and install the service?");
    expect(res.grounding).toBe("grounded");
    expect(res.citations.some((c) => c.path === "requirements.txt")).toBe(true);
  });

  it("returns no_evidence with the exact fallback text for unrelated questions", () => {
    const res = answerQuestion("t1", "What is the weather in Tokyo?");
    expect(res.grounding).toBe("no_evidence");
    expect(res.answer).toBe(
      "I couldn't find code in this repository that answers that. Try naming a file or a function."
    );
    expect(res.citations).toHaveLength(0);
  });

  it("INTEGRITY: verifies all mock context paths and all citation paths exist in mock repo data with line ranges inside line counts", () => {
    // 1. Verify MOCK_AI_CONTEXTS
    for (const [taskId, ctx] of Object.entries(MOCK_AI_CONTEXTS)) {
      for (const file of ctx.relevantFiles) {
        const repoFile = T1_INITIAL_REPO[file.path];
        expect(repoFile, `Context ${taskId} path ${file.path} not in repo`).toBeDefined();

        const totalLines = repoFile.content.split("\n").length;
        if (file.startLine !== null) {
          expect(file.startLine).toBeGreaterThanOrEqual(1);
          expect(file.startLine).toBeLessThanOrEqual(totalLines);
        }
        if (file.endLine !== null) {
          expect(file.endLine).toBeGreaterThanOrEqual(1);
          expect(file.endLine).toBeLessThanOrEqual(totalLines);
        }
        if (file.startLine !== null && file.endLine !== null) {
          expect(file.startLine).toBeLessThanOrEqual(file.endLine);
        }
      }
    }

    // 2. Verify all questions in answerQuestion
    const sampleQuestions = [
      "Where is the webhook handled?",
      "How does retry backoff work?",
      "What is the signature verification 400 error?",
      "How does the state machine hold funds?",
      "How to run pytest tests?",
      "How to setup and install requirements?",
    ];

    for (const q of sampleQuestions) {
      const res = answerQuestion("t1", q);
      for (const cit of res.citations) {
        const repoFile = T1_INITIAL_REPO[cit.path];
        expect(repoFile, `Citation path ${cit.path} for question "${q}" not found in repo`).toBeDefined();

        const totalLines = repoFile.content.split("\n").length;
        if (cit.startLine !== null) {
          expect(cit.startLine).toBeGreaterThanOrEqual(1);
          expect(cit.startLine).toBeLessThanOrEqual(totalLines);
        }
        if (cit.endLine !== null) {
          expect(cit.endLine).toBeGreaterThanOrEqual(1);
          expect(cit.endLine).toBeLessThanOrEqual(totalLines);
        }
        if (cit.startLine !== null && cit.endLine !== null) {
          expect(cit.startLine).toBeLessThanOrEqual(cit.endLine);
        }
      }
    }
  });
});
