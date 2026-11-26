export type ProjectState =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "approved"
  | "completed";

export type EscrowState =
  | "unrequested"
  | "authorized"
  | "held"
  | "release_pending"
  | "released";

export type DockerWorkspaceState =
  | "requested"
  | "creating"
  | "ready"
  | "active"
  | "stopped"
  | "archived";

export interface GitHubHandoffStatus {
  status: "connected" | "pending" | "disconnected";
  repoName: string;
  repoUrl?: string;
  defaultBranch: string;
  commitHash: string;
  isPrivate?: boolean;
  description?: string;
  accessLevel: "Controlled Read-Only (No Owner Password Shared)";
}

export interface ProjectScope {
  id: string;
  title: string;
  description: string;
  expectedResult: string;
  budget: number;
  currency: string;
  deadline: string;
  skills: string[];
  ownerName: string;
  projectState: ProjectState;
  escrowState: EscrowState;
  github: GitHubHandoffStatus;
  changesRequestedNote?: string;
  testSuiteName?: string;
}

export interface WorkspaceContainerInfo {
  workspaceId: string;
  environmentRef: string;
  state: DockerWorkspaceState;
  image: string;
  containerId: string;
  isolationLevel: string;
  githubMount: string;
  connectCommand: string;
  createdAt: string;
  lastActiveAt?: string;
}

export interface TestCheckStep {
  step: number;
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  details?: string;
  durationMs?: number;
}

export interface TestSuiteResult {
  runId: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  timestamp: string;
  steps: TestCheckStep[];
  rawOutput?: string;
}

export interface SubmissionPayload {
  summary: string;
  filesModified: string;
  testResultStatus: "PASSED";
  reviewerNotes: string;
}

export interface SubmissionRecord {
  id: string;
  projectId: string;
  submittedAt: string;
  summary: string;
  filesModified: string[];
  testResult: "PASSED" | "FAILED";
  reviewerNotes?: string;
  status: "in_review" | "changes_requested" | "approved";
  feedback?: string;
}
