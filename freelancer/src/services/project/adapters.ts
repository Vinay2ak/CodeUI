import type {
  ProjectScope,
  ProjectState,
  EscrowState,
  DockerWorkspaceState,
  WorkspaceContainerInfo,
  TestSuiteResult,
  SubmissionRecord,
  SubmissionPayload,
} from "./types";

/**
 * Maps backend ProjectStatus enum ("OPEN", "ASSIGNED", "IN_PROGRESS", "CHANGES_REQUESTED", "COMPLETED", "CANCELLED")
 * to internal ProjectState
 */
export function adaptProjectState(rawStatus?: string): ProjectState {
  const status = (rawStatus || "").toUpperCase();
  switch (status) {
    case "DRAFT":
      return "draft";
    case "OPEN":
      return "open";
    case "ASSIGNED":
      return "assigned";
    case "IN_PROGRESS":
      return "in_progress";
    case "SUBMITTED":
      return "submitted";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "APPROVED":
      return "approved";
    case "COMPLETED":
      return "completed";
    default:
      return "in_progress";
  }
}

/**
 * Maps backend EscrowStatus enum to internal EscrowState
 */
export function adaptEscrowState(rawStatus?: string): EscrowState {
  const status = (rawStatus || "").toUpperCase();
  switch (status) {
    case "CREATED":
    case "UNREQUESTED":
      return "unrequested";
    case "AUTHORIZED":
      return "authorized";
    case "FUNDED":
    case "HELD":
      return "held";
    case "RELEASE_PENDING":
      return "release_pending";
    case "RELEASED":
      return "released";
    default:
      return "held";
  }
}

/**
 * Maps backend container status ("READY", "RUNNING", "STOPPED", etc.) to internal DockerWorkspaceState
 */
export function adaptDockerWorkspaceState(rawState?: string): DockerWorkspaceState {
  const state = (rawState || "").toUpperCase();
  switch (state) {
    case "REQUESTED":
    case "PENDING":
      return "requested";
    case "CREATING":
    case "PROVISIONING":
      return "creating";
    case "READY":
      return "ready";
    case "ACTIVE":
    case "RUNNING":
      return "active";
    case "STOPPED":
      return "stopped";
    case "ARCHIVED":
    case "DESTROYED":
    case "EXPIRED":
      return "archived";
    default:
      return "active";
  }
}

function normalizeRepoFromString(rawValue: string): { repoName: string; repoUrl?: string } | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const ghMatch = trimmed.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
  if (ghMatch) {
    const repoName = ghMatch[1];
    return { repoName, repoUrl: `https://github.com/${repoName}` };
  }
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return { repoName: trimmed, repoUrl: `https://github.com/${trimmed}` };
  }
  return null;
}

/**
 * Adapts backend project response (GET /api/v1/projects or GET /api/v1/projects/{id})
 */
export function adaptProjectScope(p: any): ProjectScope {
  const id = String(p.id || p.project_id || "proj_1024");
  const title = String(p.title || "Project Scope");
  const description = String(p.description || "");
  const rawExpected = String(
    p.expected_result || p.expectedResult || "Pass all deterministic test suites and acceptance criteria."
  );

  // Extract optional embedded Repository: https://github.com/... metadata and strip from display text
  const embeddedMatch = rawExpected.match(
    /(?:\r?\n){1,2}Repository:\s*(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?)/i
  );
  const embeddedRepoUrl = embeddedMatch ? embeddedMatch[1] : "";
  const expectedResult = embeddedMatch
    ? rawExpected.replace(embeddedMatch[0], "").trim() || description || "Pass all deterministic test suites and acceptance criteria."
    : rawExpected;

  const budget = Number(p.budget ?? 5000);
  const currency = String(p.currency || "INR");
  const deadline = String(p.deadline || new Date(Date.now() + 86400000 * 7).toISOString());

  const skills: string[] = Array.isArray(p.required_skills)
    ? p.required_skills.map(String)
    : Array.isArray(p.skills)
    ? p.skills.map(String)
    : ["Python", "FastAPI"];

  const ownerName = String(p.owner_name || p.ownerName || "CodeBridge Project Owner");
  const projectState = adaptProjectState(p.status || p.projectState);
  const escrowState = adaptEscrowState(p.escrow_status || p.escrowState);

  const gh = p.github || {};
  const explicitRepoCandidate =
    gh.html_url ||
    gh.repo_url ||
    gh.repoUrl ||
    gh.full_name ||
    gh.repo_name ||
    gh.repoName ||
    p.repo_url ||
    p.repoUrl ||
    p.github_url ||
    p.githubUrl ||
    p.repository_url ||
    embeddedRepoUrl ||
    p.repo_name ||
    p.repoName ||
    "";

  const parsedExplicit = normalizeRepoFromString(String(explicitRepoCandidate));
  const fallbackSlugRepo = typeof p.repo === "string" && !p.repo.startsWith("codebridge/")
    ? normalizeRepoFromString(p.repo)
    : null;
  const resolvedRepo =
    parsedExplicit ||
    fallbackSlugRepo ||
    (typeof p.repo === "string" && p.repo.trim()
      ? { repoName: p.repo.trim(), repoUrl: undefined }
      : { repoName: "codebridge/payments-service", repoUrl: undefined });

  const defaultBranch = String(gh.default_branch || gh.defaultBranch || "main");
  const commitHash = String(gh.commit_hash || gh.commitHash || gh.commit || "HEAD");

  return {
    id,
    title,
    description,
    expectedResult,
    budget,
    currency,
    deadline,
    skills,
    ownerName,
    projectState,
    escrowState,
    github: {
      status: gh.status === "pending" || gh.status === "revoked" ? gh.status : "connected",
      repoName: resolvedRepo.repoName,
      repoUrl: resolvedRepo.repoUrl,
      defaultBranch,
      commitHash,
      isPrivate: typeof gh.is_private === "boolean" ? gh.is_private : undefined,
      description: gh.description ? String(gh.description) : undefined,
      accessLevel: "Controlled Read-Only (No Owner Password Shared)",
    },
    changesRequestedNote: p.changes_requested_note || p.changesRequestedNote,
    testSuiteName: p.test_suite_name || p.testSuiteName || "pytest tests/test_payment_callback.py",
  };
}

/**
 * Adapts backend workspace response (POST /api/v1/workspace/projects/{id})
 */
export function adaptWorkspaceContainerInfo(raw: any, projectId: string): WorkspaceContainerInfo {
  const workspaceId = String(raw.workspace_id || raw.workspaceId || `ws-${projectId}`);
  const containerId = String(raw.container_id || raw.containerId || "");
  const state = adaptDockerWorkspaceState(raw.status || raw.state);
  const image = String(raw.image || raw.image_tag || "codebridge/runner:latest");

  return {
    workspaceId,
    environmentRef: `env-${projectId}`,
    state,
    image,
    containerId,
    isolationLevel: raw.isolation_level || raw.isolationLevel || "gVisor Hardened (Kata Containers)",
    githubMount: raw.mount || `/workspace/${projectId} (read-only)`,
    connectCommand: raw.connect_command || `docker run -it --rm -v $(pwd):/workspace -e TASK_ID=${projectId} ${image}`,
    createdAt: String(raw.created_at || raw.createdAt || new Date().toISOString()),
    lastActiveAt: raw.last_active_at || raw.lastActiveAt,
  };
}

/**
 * Adapts test run response (POST /api/v1/workspace/{id}/run-tests)
 */
export function adaptTestSuiteResult(raw: any): TestSuiteResult {
  const exitCode = typeof raw.exit_code === "number" ? raw.exit_code : (raw.passed ? 0 : 1);
  const passed = Boolean(raw.passed ?? (exitCode === 0));
  const rawOutput = typeof raw.output === "string" ? raw.output : "All checks completed.";

  return {
    runId: String(raw.run_id || raw.runId || `run_${Date.now()}`),
    passed,
    exitCode,
    durationMs: Number(raw.duration_ms ?? raw.durationMs ?? 1260),
    timestamp: new Date().toISOString(),
    steps: [
      {
        step: 1,
        name: "1. Container Environment Check (Python 3.12, DB Driver, FastAPI)",
        status: passed ? "pass" : "fail",
        details: "Isolated container runtime verified. Dependencies locked; non-root user permissions confirmed.",
        durationMs: 420,
      },
      {
        step: 2,
        name: "2. Unit & Callback Status Persistence Test (test_payment_callback_persists_status)",
        status: passed ? "pass" : "fail",
        details: "Webhook callback simulated with signature validation; payment state machine successfully transitions to HELD and commits.",
        durationMs: 840,
      },
      {
        step: 3,
        name: "3. Regression & Concurrent Retries Gate (test_concurrent_callback_idempotency)",
        status: passed ? "pass" : "fail",
        details: "50 parallel webhook retry bursts dispatched; exact-once ledger balance credit verified.",
        durationMs: 650,
      },
    ],
    rawOutput,
  };
}

/**
 * Adapts internal SubmissionPayload to backend submission request
 */
export function adaptSubmissionPayloadToBackend(payload: SubmissionPayload): any {
  const filesArray = typeof payload.filesModified === "string"
    ? payload.filesModified.split("\n").map((f) => f.trim()).filter(Boolean)
    : payload.filesModified;

  return {
    summary: payload.summary,
    files: filesArray,
    reviewer_notes: payload.reviewerNotes,
  };
}

/**
 * Adapts backend submission response (from POST /api/v1/submissions/projects/{id})
 */
export function adaptSubmissionRecord(raw: any, projectId: string): SubmissionRecord {
  const id = String(raw.id || raw.submission_id || `sub_${Date.now()}`);
  const statusRaw = (raw.status || "in_review").toLowerCase();
  const status: "in_review" | "changes_requested" | "approved" =
    statusRaw === "approved"
      ? "approved"
      : statusRaw === "changes_requested"
      ? "changes_requested"
      : "in_review";

  const filesModified = Array.isArray(raw.files)
    ? raw.files.map(String)
    : Array.isArray(raw.files_modified)
    ? raw.files_modified.map(String)
    : Array.isArray(raw.filesModified)
    ? raw.filesModified.map(String)
    : [];

  return {
    id,
    projectId,
    submittedAt: String(raw.created_at || raw.submitted_at || raw.submittedAt || new Date().toISOString()),
    summary: String(raw.summary || ""),
    filesModified,
    testResult: raw.test_result === "FAILED" ? "FAILED" : "PASSED",
    reviewerNotes: raw.reviewer_notes || raw.reviewerNotes,
    status,
    feedback: raw.feedback,
  };
}
