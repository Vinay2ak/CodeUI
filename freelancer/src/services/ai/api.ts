import { request } from "../../lib/http";
import type {
  AiCapabilities,
  AiContext,
  AskAnswer,
  AskRequest,
  FailureExplanation,
  SelfCheckReport,
  DraftSummary,
  AiJob,
} from "./types";
import {
  adaptAiContext,
  adaptAskAnswer,
  adaptFailureExplanation,
  adaptAiJob,
} from "./adapters";
import { MOCK_AI_CONTEXTS } from "../../mocks/data/ai";
import { answerQuestion } from "../../mocks/data/aiAsk";

export interface RequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export type AskQuestionOptions = RequestOptions;

function generateIdempotencyKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const aiApi = {
  async getCapabilities(): Promise<AiCapabilities> {
    try {
      const raw = await request<AiCapabilities>("/api/v1/ai/capabilities");
      return raw;
    } catch {
      // 404 means unknown/not configured, return fallback
      return {
        provider: "none",
        features: {
          context: false,
          ask: false,
          explain: false,
          selfCheck: false,
          draft: false,
        },
        limits: {
          askPerHour: null,
        },
      };
    }
  },

  async getContext(taskId: string): Promise<AiContext> {
    try {
      const raw = await request<unknown>(`/api/v1/ai/context/${taskId}`);
      return adaptAiContext(raw);
    } catch (err) {
      // If error is 404 or in mock mode fallback
      const key = taskId === "task-1" ? "t1" : taskId;
      const fallback = MOCK_AI_CONTEXTS[key] || MOCK_AI_CONTEXTS.t1;
      if (fallback) {
        return adaptAiContext(fallback);
      }
      throw err;
    }
  },

  async askQuestion(
    taskId: string,
    req: AskRequest,
    options?: AskQuestionOptions
  ): Promise<AskAnswer> {
    const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey();

    try {
      const raw = await request<unknown>(`/api/v1/ai/tasks/${taskId}/ask`, {
        method: "POST",
        body: JSON.stringify(req),
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        signal: options?.signal,
      });
      return adaptAskAnswer(raw);
    } catch (err) {
      if (import.meta.env.VITE_USE_MOCKS === "true") {
        const fallback = answerQuestion(taskId, req.question);
        return adaptAskAnswer(fallback);
      }
      throw err;
    }
  },

  async explainFailure(
    taskId: string,
    req: { runId: string; testId: string },
    options?: RequestOptions
  ): Promise<FailureExplanation> {
    const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey();

    const raw = await request<unknown>(`/api/v1/ai/tasks/${taskId}/explain-failure`, {
      method: "POST",
      body: JSON.stringify(req),
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      signal: options?.signal,
    });
    return adaptFailureExplanation(raw);
  },

  async startSelfCheck(
    taskId: string,
    options?: RequestOptions
  ): Promise<{ jobId: string }> {
    const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey();

    const res = await request<{ jobId: string }>(`/api/v1/ai/tasks/${taskId}/self-check`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      signal: options?.signal,
    });
    return res;
  },

  async startDraftSummary(
    taskId: string,
    options?: RequestOptions
  ): Promise<{ jobId: string }> {
    const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey();

    const res = await request<{ jobId: string }>(`/api/v1/ai/tasks/${taskId}/draft-summary`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      signal: options?.signal,
    });
    return res;
  },

  async getJob<T = SelfCheckReport | DraftSummary>(
    jobId: string,
    options?: { signal?: AbortSignal }
  ): Promise<AiJob<T>> {
    const raw = await request<unknown>(`/api/v1/ai/jobs/${jobId}`, {
      method: "GET",
      signal: options?.signal,
    });
    return adaptAiJob<T>(raw);
  },

  async cancelJob(
    jobId: string,
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    await request<unknown>(`/api/v1/ai/jobs/${jobId}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
      signal: options?.signal,
    });
  },
};
