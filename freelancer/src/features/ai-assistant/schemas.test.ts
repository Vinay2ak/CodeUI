import { describe, it, expect } from "vitest";
import {
  adaptAiContext,
  adaptAskAnswer,
  adaptFailureExplanation,
  adaptSelfCheckReport,
  adaptDraftSummary,
  adaptAiJob,
} from "./adapters";

describe("schemas & adapters", () => {
  it("adapts camelCase AiContext fixture cleanly", () => {
    const raw = {
      summary: "This is a clean summary",
      findings: ["Finding 1", "Finding 2"],
      relevantFiles: [
        { path: "app/webhooks.py", score: 0.94, reason: "Main entry point" },
      ],
      dependencies: [
        { name: "fastapi", kind: "runtime", note: "Web framework" },
      ],
      affectedAreas: [
        { name: "Webhooks", note: "Routing layer" },
      ],
      setupHints: [
        { command: "pytest -q", note: "Fast test runner" },
      ],
      approach: ["Step 1", "Step 2"],
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.summary).toBe("This is a clean summary");
    expect(adapted.findings).toHaveLength(2);
    expect(adapted.relevantFiles[0].score).toBe(0.94);
    expect(adapted.dependencies[0].kind).toBe("runtime");
  });

  it("adapts snake_case backend AiContext fixture", () => {
    const raw = {
      summary: "Snake case payload",
      findings: ["F1"],
      relevant_files: [
        { path: "app/retry.py", start_line: 10, end_line: 25, score: 0.8, reason: "Backoff" },
      ],
      setup_hints: [
        { command: "pip install -r requirements.txt", note: "Install deps" },
      ],
      affected_areas: [
        { name: "Retry", note: "Backoff queue" },
      ],
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.relevantFiles).toHaveLength(1);
    expect(adapted.relevantFiles[0].startLine).toBe(10);
    expect(adapted.relevantFiles[0].endLine).toBe(25);
    expect(adapted.setupHints[0].command).toBe("pip install -r requirements.txt");
  });

  it("truncates arrays to mandated caps without rejecting", () => {
    const raw = {
      summary: "Testing truncation limits",
      findings: Array.from({ length: 20 }, (_, i) => `Finding ${i + 1}`),
      relevantFiles: Array.from({ length: 20 }, (_, i) => ({
        path: `src/file${i}.ts`,
        score: 0.5,
        reason: `Reason ${i}`,
      })),
      setupHints: Array.from({ length: 15 }, (_, i) => ({
        command: `echo ${i}`,
        note: `Note ${i}`,
      })),
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.findings).toHaveLength(8);
    expect(adapted.relevantFiles).toHaveLength(10);
    expect(adapted.setupHints).toHaveLength(6);
  });

  it("redacts secrets inside reasons, summaries and notes", () => {
    const raw = {
      summary: "Access token is ghp_123456789012345678901234567890123456 in logs",
      findings: ["Used key sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz"],
      relevantFiles: [
        {
          path: "app/main.py",
          score: 0.5,
          reason: "Found password=supersecretpass123 inside config",
        },
      ],
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.summary).toContain("[redacted]");
    expect(adapted.summary).not.toContain("ghp_");
    expect(adapted.findings[0]).toContain("[redacted]");
    expect(adapted.findings[0]).not.toContain("sk-ant");
    expect(adapted.relevantFiles[0].reason).toContain("[redacted]");
    expect(adapted.relevantFiles[0].reason).not.toContain("supersecretpass123");
  });

  it("keeps HTML tags as plain strings without executing or interpreting them", () => {
    const raw = {
      summary: "<script>alert('pwned')</script><b>Bold summary</b>",
      findings: ["<img src=x onerror=alert(1)>"],
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.summary).toBe("<script>alert('pwned')</script><b>Bold summary</b>");
    expect(adapted.findings[0]).toBe("<img src=x onerror=alert(1)>");
  });

  it("drops relevantFiles with unsafe paths (path traversal or absolute)", () => {
    const raw = {
      summary: "Unsafe path test",
      relevantFiles: [
        { path: "../../etc/passwd", score: 0.9, reason: "Traversal" },
        { path: "/root/.ssh/id_rsa", score: 0.8, reason: "Absolute" },
        { path: "app/valid.py", score: 0.7, reason: "Valid relative" },
      ],
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.relevantFiles).toHaveLength(1);
    expect(adapted.relevantFiles[0].path).toBe("app/valid.py");
  });

  it("clamps score between 0 and 1", () => {
    const raw = {
      summary: "Score clamping",
      relevantFiles: [
        { path: "app/one.py", score: 1.5, reason: "Too high" },
        { path: "app/two.py", score: -0.5, reason: "Too low" },
      ],
    };

    const adapted = adaptAiContext(raw);
    expect(adapted.relevantFiles[0].score).toBe(1);
    expect(adapted.relevantFiles[1].score).toBe(0);
  });

  it("adapts and validates AskAnswer payload", () => {
    const raw = {
      answer_id: "ans_123",
      generated_at: "2026-11-22T10:00:00Z",
      repo_commit_sha: "a1b2c3d",
      grounding: "grounded",
      answer: "The webhook is handled in `app/webhooks.py`.",
      citations: [
        { path: "app/webhooks.py", start_line: 12, end_line: 25, snippet: "def handle_webhook():" },
      ],
      remaining: 18,
    };

    const adapted = adaptAskAnswer(raw);
    expect(adapted.answerId).toBe("ans_123");
    expect(adapted.grounding).toBe("grounded");
    expect(adapted.citations[0].path).toBe("app/webhooks.py");
    expect(adapted.remaining).toBe(18);
  });

  it("fails validation when summary or answer is missing", () => {
    expect(() => adaptAiContext({ summary: "" })).toThrow();
    expect(() => adaptAskAnswer({ answerId: "1", answer: "" })).toThrow();
  });

  // ==================== PART B TESTS ====================

  it("adapts FailureExplanation camelCase fixture", () => {
    const raw = {
      explanationId: "exp_1",
      generatedAt: "2026-11-22T10:00:00Z",
      explanation: "Test failed due to unhandled duplicate delivery",
      likelyCause: "Missing idempotent store check in handler",
      suspectedLocations: [
        { path: "app/webhooks.py", startLine: 12, endLine: 26, reason: "No dedupe set" },
      ],
      nextSteps: ["Add processed_event_ids", "Return already_processed status"],
    };
    const adapted = adaptFailureExplanation(raw);
    expect(adapted.explanationId).toBe("exp_1");
    expect(adapted.likelyCause).toBe("Missing idempotent store check in handler");
    expect(adapted.suspectedLocations).toHaveLength(1);
    expect(adapted.suspectedLocations[0].path).toBe("app/webhooks.py");
    expect(adapted.nextSteps).toHaveLength(2);
  });

  it("adapts FailureExplanation snake_case fixture and redacts secrets", () => {
    const raw = {
      explanation_id: "exp_2",
      generated_at: "2026-11-22T10:00:00Z",
      explanation: "Failed with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789",
      likely_cause: "Found sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz",
      suspected_locations: [
        { path: "../../etc/passwd", start_line: 1, end_line: 5, reason: "Unsafe path" },
        { path: "app/retry.py", start_line: 3, end_line: 10, reason: "Constant delay" },
      ],
      next_steps: ["Step 1", "Step 2"],
    };
    const adapted = adaptFailureExplanation(raw);
    expect(adapted.explanation).toContain("[redacted]");
    expect(adapted.likelyCause).toContain("[redacted]");
    // Unsafe path dropped
    expect(adapted.suspectedLocations).toHaveLength(1);
    expect(adapted.suspectedLocations[0].path).toBe("app/retry.py");
  });

  it("adapts SelfCheckReport camelCase fixture and clamps arrays", () => {
    const raw = {
      reportId: "rep_1",
      generatedAt: "2026-11-22T10:00:00Z",
      repoCommitSha: "a1b2c3d",
      criteria: Array.from({ length: 15 }, (_, i) => ({
        criterionId: `C${i}`,
        text: `Criterion ${i}`,
        required: true,
        status: "met",
        reasoning: `Reasoning ${i}`,
        evidence: [
          { path: "app/webhooks.py", startLine: 1, endLine: 5, snippet: "code" },
        ],
      })),
      risks: Array.from({ length: 15 }, (_, i) => ({
        id: `R${i}`,
        severity: "high",
        category: "error_handling",
        text: `Risk ${i}`,
        evidence: [{ path: "app/retry.py", startLine: 1, endLine: 2 }],
      })),
    };
    const adapted = adaptSelfCheckReport(raw);
    expect(adapted.criteria).toHaveLength(12);
    expect(adapted.risks).toHaveLength(12);
    expect(adapted.criteria[0].status).toBe("met");
  });

  it("adapts SelfCheckReport snake_case fixture and keeps HTML as plain text", () => {
    const raw = {
      report_id: "rep_2",
      generated_at: "2026-11-22T10:00:00Z",
      repo_commit_sha: "a1b2c3d",
      criteria: [
        {
          criterion_id: "C1",
          text: "<script>alert(1)</script> Webhook check",
          required: true,
          status: "partial",
          reasoning: "<b>Bold reasoning</b>",
          evidence: [
            { path: "app/webhooks.py", start_line: 10, end_line: 20, snippet: "test" },
          ],
        },
      ],
      risks: [
        {
          id: "R1",
          severity: "MEDIUM",
          category: "secrets",
          text: "Secret token: ghp_123456789012345678901234567890123456 found",
          evidence: [{ path: "app/main.py", start_line: 5, end_line: 6 }],
        },
      ],
    };
    const adapted = adaptSelfCheckReport(raw);
    expect(adapted.criteria[0].text).toBe("<script>alert(1)</script> Webhook check");
    expect(adapted.criteria[0].status).toBe("partial");
    expect(adapted.risks[0].severity).toBe("medium");
    expect(adapted.risks[0].category).toBe("secrets");
    expect(adapted.risks[0].text).toContain("[redacted]");
  });

  it("adapts DraftSummary camelCase fixture", () => {
    const raw = {
      draftId: "dr_1",
      generatedAt: "2026-11-22T10:00:00Z",
      summary: "Implemented event deduplication and exponential retry schedule",
      filesModified: ["app/webhooks.py", "app/retry.py"],
      notes: "All 5 required tests now pass cleanly.",
    };
    const adapted = adaptDraftSummary(raw);
    expect(adapted.draftId).toBe("dr_1");
    expect(adapted.filesModified).toEqual(["app/webhooks.py", "app/retry.py"]);
    expect(adapted.notes).toBe("All 5 required tests now pass cleanly.");
  });

  it("adapts DraftSummary snake_case fixture, redacts secrets and drops unsafe paths", () => {
    const raw = {
      draft_id: "dr_2",
      generated_at: "2026-11-22T10:00:00Z",
      summary: "Updated password=supersecretpass123 in config",
      files_modified: ["../../etc/passwd", "app/webhooks.py", "/absolute/path"],
      notes: "Used sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz",
    };
    const adapted = adaptDraftSummary(raw);
    expect(adapted.summary).toContain("[redacted]");
    expect(adapted.notes).toContain("[redacted]");
    expect(adapted.filesModified).toEqual(["app/webhooks.py"]);
  });

  it("adapts AiJob for self_check kind and parses nested result", () => {
    const raw = {
      job_id: "job_sc_1",
      kind: "self_check",
      status: "completed",
      error: null,
      result: {
        report_id: "rep_nested",
        generated_at: "2026-11-22T10:00:00Z",
        repo_commit_sha: "HEAD",
        criteria: [],
        risks: [],
      },
    };
    const adapted = adaptAiJob(raw);
    expect(adapted.jobId).toBe("job_sc_1");
    expect(adapted.kind).toBe("self_check");
    expect(adapted.status).toBe("completed");
    expect((adapted.result as any).reportId).toBe("rep_nested");
  });

  it("adapts AiJob with failure status and error details", () => {
    const raw = {
      job_id: "job_sc_failed",
      kind: "self_check",
      status: "FAILED",
      error: { code: "AI_UNAVAILABLE", message: "Service is down" },
      result: null,
    };
    const adapted = adaptAiJob(raw);
    expect(adapted.status).toBe("failed");
    expect(adapted.error?.code).toBe("AI_UNAVAILABLE");
    expect(adapted.result).toBeNull();
  });
});
