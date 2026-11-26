import type {
  AiFlowPhase,
  AiFlowError,
  AiDeveloperBrief,
  ConfirmedBrief,
  RepoInfo,
  AiBriefJob,
  ProjectSnapshot,
} from '../ai-brief/types';
import { hashInputs } from '../../lib/hash';

export interface AiFlowState {
  phase: AiFlowPhase;
  projectId: string | null;
  repo: RepoInfo | null;
  job: AiBriefJob | null;
  brief: AiDeveloperBrief | ConfirmedBrief | null;
  snapshot: ProjectSnapshot | null;
  analyzedHash: string | null;
  currentHash: string | null;
  error: AiFlowError | null;
  publishStep: 'brief' | 'publish' | null;
}

export const initialAiFlowState: AiFlowState = {
  phase: 'idle',
  projectId: null,
  repo: null,
  job: null,
  brief: null,
  snapshot: null,
  analyzedHash: null,
  currentHash: null,
  error: null,
  publishStep: null,
};

export type AiFlowAction =
  | { type: 'INPUTS_CHANGED'; payload: { hash: string } }
  | { type: 'DRAFT_SAVING' }
  | { type: 'DRAFT_SAVED'; payload: { projectId: string } }
  | { type: 'REPO_CONNECT_REQUESTED' }
  | { type: 'REPO_STATUS_RECEIVED'; payload: { repo: RepoInfo | null; error?: { code: string; message: string } | null } }
  | { type: 'ANALYZE_REQUESTED'; payload: { snapshot: ProjectSnapshot; hash: string } }
  | { type: 'JOB_UPDATE'; payload: AiBriefJob }
  | { type: 'JOB_FAILED'; payload: { error: AiFlowError } }
  | { type: 'BRIEF_READY'; payload: { brief: AiDeveloperBrief; hash: string; snapshot: ProjectSnapshot } }
  | { type: 'BRIEF_EDITED'; payload: AiDeveloperBrief }
  | { type: 'BRIEF_DISMISSED' }
  | { type: 'PUBLISH_REQUESTED' }
  | { type: 'BRIEF_SAVED' }
  | { type: 'PUBLISHED' }
  | { type: 'FAILED'; payload: { error: AiFlowError } }
  | { type: 'RESET' }
  | { type: 'RESTORE'; payload: Partial<AiFlowState> };

export function aiFlowReducer(state: AiFlowState, action: AiFlowAction): AiFlowState {
  switch (action.type) {
    case 'INPUTS_CHANGED': {
      const { hash } = action.payload;
      const next: AiFlowState = { ...state, currentHash: hash };

      if (state.phase === 'brief_ready' && state.analyzedHash && hash !== state.analyzedHash) {
        return { ...next, phase: 'stale' };
      }
      if (state.phase === 'stale' && state.analyzedHash && hash === state.analyzedHash) {
        return { ...next, phase: 'brief_ready' };
      }
      return next;
    }

    case 'DRAFT_SAVING':
      return { ...state, phase: 'saving_draft', error: null };

    case 'DRAFT_SAVED':
      return {
        ...state,
        projectId: action.payload.projectId,
        phase: state.phase === 'saving_draft' ? 'idle' : state.phase,
        error: null,
      };

    case 'REPO_CONNECT_REQUESTED':
      return { ...state, phase: 'connecting_repo', error: null };

    case 'REPO_STATUS_RECEIVED': {
      const { repo, error } = action.payload;
      if (error) {
        return {
          ...state,
          phase: 'error',
          error: { where: 'github', code: error.code, message: error.message },
        };
      }
      return {
        ...state,
        repo: repo ?? null,
        phase: state.phase === 'connecting_repo' ? 'idle' : state.phase,
        error: null,
      };
    }

    case 'ANALYZE_REQUESTED':
      return {
        ...state,
        phase: 'analyzing',
        analyzedHash: action.payload.hash,
        snapshot: action.payload.snapshot,
        error: null,
        job: null,
      };

    case 'JOB_UPDATE': {
      const job = action.payload;
      if (job.status === 'failed') {
        return {
          ...state,
          job,
          phase: 'error',
          error: {
            where: 'analysis',
            code: job.error?.code || 'UNKNOWN',
            message: job.error?.message || 'Analysis failed',
            correlationId: job.error?.correlationId,
          },
        };
      }
      return { ...state, job };
    }

    case 'JOB_FAILED':
      return {
        ...state,
        phase: 'error',
        error: action.payload.error,
      };

    case 'BRIEF_READY': {
      const isStale = state.currentHash ? state.currentHash !== action.payload.hash : false;
      return {
        ...state,
        phase: isStale ? 'stale' : 'brief_ready',
        brief: action.payload.brief,
        analyzedHash: action.payload.hash,
        snapshot: action.payload.snapshot,
        error: null,
      };
    }

    case 'BRIEF_EDITED':
      return {
        ...state,
        brief: action.payload,
      };

    case 'BRIEF_DISMISSED':
      return {
        ...state,
        phase: 'idle',
        brief: null,
        snapshot: null,
        analyzedHash: null,
        error: null,
        job: null,
        publishStep: null,
      };

    case 'PUBLISH_REQUESTED':
      return {
        ...state,
        phase: 'publishing',
        publishStep: state.publishStep || 'brief',
        error: null,
      };

    case 'BRIEF_SAVED':
      return {
        ...state,
        publishStep: 'publish',
      };

    case 'PUBLISHED':
      return {
        ...state,
        phase: 'published',
        publishStep: null,
        error: null,
      };

    case 'FAILED': {
      const { error } = action.payload;
      return {
        ...state,
        phase: 'error',
        error,
      };
    }

    case 'RESET':
      return initialAiFlowState;

    case 'RESTORE':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}

export function canRescan(state: AiFlowState, currentHash?: string | null): boolean {
  if (state.phase === 'stale') return true;
  if (state.phase === 'error' && state.error?.where === 'analysis') return true;
  if (state.phase === 'brief_ready' && currentHash && state.analyzedHash && currentHash !== state.analyzedHash) {
    return true;
  }
  return false;
}

export function computeInputsHash(inputs: {
  title: string;
  description: string;
  stacks: string[];
  specialties: string[];
  repoFullName: string;
  headCommitSha: string;
}): string {
  // Budget is strictly excluded from change tracking
  return hashInputs({
    title: inputs.title,
    description: inputs.description,
    stacks: inputs.stacks,
    specialties: inputs.specialties,
    repoFullName: inputs.repoFullName,
    headCommitSha: inputs.headCommitSha,
  });
}
