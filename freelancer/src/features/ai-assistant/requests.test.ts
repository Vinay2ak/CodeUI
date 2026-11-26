import { describe, it, expect } from "vitest";
import {
  buildAskRequest,
  buildExplainRequest,
  buildSelfCheckRequest,
  buildDraftSummaryRequest,
} from "./requests";

describe("requests / buildAskRequest", () => {
  it("builds valid ask request with trimmed question", () => {
    const req = buildAskRequest({ question: "  Where is the webhook handled?   " });
    expect(req).toEqual({ question: "Where is the webhook handled?" });
    expect(Object.keys(req)).toEqual(["question"]);
  });

  it("normalizes and attaches safe focusPath", () => {
    const req = buildAskRequest({
      question: "What does this file do?",
      focusPath: "./app\\webhooks.py",
    });
    expect(req).toEqual({
      question: "What does this file do?",
      focusPath: "app/webhooks.py",
    });
    expect(Object.keys(req)).toEqual(["question", "focusPath"]);
  });

  it("omits unsafe or invalid focusPath", () => {
    const req = buildAskRequest({
      question: "What about passwd?",
      focusPath: "../../etc/passwd",
    });
    expect(req).toEqual({ question: "What about passwd?" });
    expect(Object.keys(req)).toEqual(["question"]);
  });

  it("disallows extra fields like file content, diffs or logs from leaking", () => {
    const req = buildAskRequest({
      question: "Can you fix this?",
      fileContent: "SECRET_CODE_HERE",
      logs: "Error on line 5",
      diff: "+ added line",
    });
    expect(Object.keys(req)).toEqual(["question"]);
    expect((req as any).fileContent).toBeUndefined();
    expect((req as any).logs).toBeUndefined();
    expect((req as any).diff).toBeUndefined();
  });

  it("throws on question shorter than 3 or longer than 500 chars", () => {
    expect(() => buildAskRequest({ question: "hi" })).toThrow();
    expect(() => buildAskRequest({ question: "a".repeat(501) })).toThrow();
  });
});

describe("requests / buildExplainRequest", () => {
  it("builds explain request containing only runId and testId", () => {
    const req = buildExplainRequest({
      runId: "run_123",
      testId: "test_webhook_idempotent",
      code: "def foo(): pass",
      logs: "Stacktrace on line 10",
      diff: "diff --git a/app.py",
    });

    expect(req).toEqual({
      runId: "run_123",
      testId: "test_webhook_idempotent",
    });
    expect(Object.keys(req)).toEqual(["runId", "testId"]);
    expect((req as any).code).toBeUndefined();
    expect((req as any).logs).toBeUndefined();
  });

  it("throws when runId or testId are missing or blank", () => {
    expect(() => buildExplainRequest({ runId: "", testId: "test_1" })).toThrow();
    expect(() => buildExplainRequest({ runId: "run_1", testId: "   " })).toThrow();
  });
});

describe("requests / selfCheck and draftSummary empty bodies", () => {
  it("buildSelfCheckRequest produces empty frozen object", () => {
    const req = buildSelfCheckRequest();
    expect(req).toEqual({});
    expect(Object.keys(req)).toHaveLength(0);
  });

  it("buildDraftSummaryRequest produces empty frozen object", () => {
    const req = buildDraftSummaryRequest();
    expect(req).toEqual({});
    expect(Object.keys(req)).toHaveLength(0);
  });
});
