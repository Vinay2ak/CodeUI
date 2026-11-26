import type {
  AiContext,
  AskAnswer,
  FailureExplanation,
  SelfCheckReport,
  DraftSummary,
  AiJob,
} from "./types";
import {
  aiContextSchema,
  askAnswerSchema,
  failureExplanationSchema,
  selfCheckReportSchema,
  draftSummarySchema,
  aiJobSchema,
} from "./schemas";

function snakeToCamel(str: string): string {
  return str.replace(/([-_][a-z0-9])/gi, (group) =>
    group.toUpperCase().replace("-", "").replace("_", "")
  );
}

export function keysToCamel<T = unknown>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((v) => keysToCamel(v)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date) && !(obj instanceof RegExp)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = keysToCamel(value);
    }
    return result as T;
  }
  return obj as T;
}

export function adaptAiContext(raw: unknown): AiContext {
  const camelCased = keysToCamel(raw);
  return aiContextSchema.parse(camelCased);
}

export function adaptAskAnswer(raw: unknown): AskAnswer {
  const camelCased = keysToCamel(raw);
  return askAnswerSchema.parse(camelCased);
}

export function adaptFailureExplanation(raw: unknown): FailureExplanation {
  const camelCased = keysToCamel(raw);
  return failureExplanationSchema.parse(camelCased);
}

export function adaptSelfCheckReport(raw: unknown): SelfCheckReport {
  const camelCased = keysToCamel(raw);
  return selfCheckReportSchema.parse(camelCased);
}

export function adaptDraftSummary(raw: unknown): DraftSummary {
  const camelCased = keysToCamel(raw);
  return draftSummarySchema.parse(camelCased);
}

export function adaptAiJob<T = unknown>(raw: unknown): AiJob<T> {
  const camelCased = keysToCamel(raw);
  const parsed = aiJobSchema.parse(camelCased);

  let result: T | null = null;
  if (parsed.result) {
    if (parsed.kind === "self_check") {
      result = adaptSelfCheckReport(parsed.result) as unknown as T;
    } else if (parsed.kind === "draft_summary") {
      result = adaptDraftSummary(parsed.result) as unknown as T;
    } else {
      result = parsed.result as T;
    }
  }

  return {
    ...parsed,
    result,
  };
}
