import { normalizePath } from "./citations";
import { isSafePath } from "../../lib/safeText";

export interface AskRequestInput {
  question: string;
  focusPath?: string;
  [key: string]: unknown;
}

export function buildAskRequest(input: AskRequestInput): {
  question: string;
  focusPath?: string;
} {
  if (!input || typeof input.question !== "string") {
    throw new Error("Question must be a string");
  }

  const trimmed = input.question.trim();
  if (trimmed.length < 3) {
    throw new Error("Question must be at least 3 characters");
  }
  if (trimmed.length > 500) {
    throw new Error("Question must not exceed 500 characters");
  }

  const result: { question: string; focusPath?: string } = {
    question: trimmed,
  };

  if (input.focusPath && typeof input.focusPath === "string") {
    const normalized = normalizePath(input.focusPath.trim());
    if (normalized && isSafePath(normalized)) {
      result.focusPath = normalized;
    }
  }

  return Object.freeze({
    question: result.question,
    ...(result.focusPath ? { focusPath: result.focusPath } : {}),
  });
}

export interface ExplainRequestInput {
  runId: string;
  testId: string;
  [key: string]: unknown;
}

export function buildExplainRequest(input: ExplainRequestInput): {
  runId: string;
  testId: string;
} {
  if (!input || typeof input.runId !== "string" || !input.runId.trim()) {
    throw new Error("runId is required");
  }
  if (typeof input.testId !== "string" || !input.testId.trim()) {
    throw new Error("testId is required");
  }

  // Strictly return only runId and testId - no logs, code, or diffs
  return Object.freeze({
    runId: input.runId.trim(),
    testId: input.testId.trim(),
  });
}

export function buildSelfCheckRequest(): Record<string, never> {
  return Object.freeze({});
}

export function buildDraftSummaryRequest(): Record<string, never> {
  return Object.freeze({});
}
