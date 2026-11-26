export type DependencyKind = "runtime" | "dev" | "service" | "other";

export interface RelevantFile {
  path: string;
  startLine: number | null;
  endLine: number | null;
  score: number;
  reason: string;
}

export interface Dependency {
  name: string;
  kind: DependencyKind;
  note: string;
}

export interface AffectedArea {
  name: string;
  note: string;
}

export interface SetupHint {
  command: string;
  note: string;
}

export interface AiContext {
  generatedAt?: string;
  repoCommitSha?: string;
  summary: string;
  findings: string[];
  relevantFiles: RelevantFile[];
  dependencies: Dependency[];
  affectedAreas: AffectedArea[];
  setupHints: SetupHint[];
  approach: string[];
}

export interface Citation {
  path: string;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
}

export interface AskAnswer {
  answerId: string;
  generatedAt: string;
  repoCommitSha: string;
  grounding: "grounded" | "no_evidence";
  answer: string;
  citations: Citation[];
  remaining: number | null;
}

export interface AiCapabilities {
  provider: "none" | "mock" | "llm";
  features: {
    context: boolean;
    ask: boolean;
    explain: boolean;
    selfCheck: boolean;
    draft: boolean;
  };
  limits: {
    askPerHour: number | null;
  };
}

export interface AskRequest {
  question: string;
  focusPath?: string;
}

// ==================== PART B TYPES ====================

export interface SuspectedLocation {
  path: string;
  startLine: number | null;
  endLine: number | null;
  reason: string;
}

export interface FailureExplanation {
  explanationId: string;
  generatedAt: string;
  explanation: string;
  likelyCause: string;
  suspectedLocations: SuspectedLocation[];
  nextSteps: string[];
}

export type CriterionStatus = "met" | "partial" | "not_met" | "unknown";

export interface CriterionCheck {
  criterionId: string;
  text: string;
  required: boolean;
  status: CriterionStatus;
  reasoning: string;
  evidence: Citation[];
}

export type RiskSeverity = "high" | "medium" | "low";
export type RiskCategory =
  | "error_handling"
  | "secrets"
  | "unaddressed_requirement"
  | "security"
  | "other";

export interface RiskEvidence {
  path: string;
  startLine: number | null;
  endLine: number | null;
}

export interface IdentifiedRisk {
  id: string;
  severity: RiskSeverity;
  category: RiskCategory;
  text: string;
  evidence: RiskEvidence[];
}

export interface SelfCheckReport {
  reportId: string;
  generatedAt: string;
  repoCommitSha: string;
  criteria: CriterionCheck[];
  risks: IdentifiedRisk[];
}

export interface DraftSummary {
  draftId: string;
  generatedAt: string;
  summary: string;
  filesModified: string[];
  notes: string;
}

export type JobKind = "self_check" | "draft_summary";
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobError {
  code: string;
  message: string;
}

export interface AiJob<T = unknown> {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  error: JobError | null;
  result: T | null;
}
