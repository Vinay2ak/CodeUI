import { describe, it, expect } from 'vitest';
import {
  aiFlowReducer,
  initialAiFlowState,
  canRescan,
  computeInputsHash,
  type AiFlowState,
} from './aiFlow';
import type { AiDeveloperBrief, ProjectSnapshot, RepoInfo } from '../ai-brief/types';

const mockBrief: AiDeveloperBrief = {
  briefId: 'b-1',
  generatedAt: '2026-03-12T00:00:00Z',
  repoCommitSha: 'sha123',
  problemSummary: 'Summary',
  suspectedFiles: [],
  rootCauseHypothesis: 'Hypothesis',
  stepByStepPlan: [],
  acceptanceCriteria: [{ id: 'c-1', text: 'Crit 1', required: true, source: 'ai' }],
};

const mockSnapshot: ProjectSnapshot = {
  title: 'Project Title',
  description: 'Desc',
  stacks: ['PYTHON_FASTAPI'],
  specialties: ['BACKEND'],
  budget: 5000,
  repoFullName: 'org/repo',
  headCommitSha: 'sha123',
  verificationMode: 'AUTO',
};

describe('aiFlowReducer state machine', () => {
  it('starts in idle phase', () => {
    expect(initialAiFlowState.phase).toBe('idle');
  });

  it('transitions through draft saving to idle with projectId', () => {
    let state = aiFlowReducer(initialAiFlowState, { type: 'DRAFT_SAVING' });
    expect(state.phase).toBe('saving_draft');

    state = aiFlowReducer(state, { type: 'DRAFT_SAVED', payload: { projectId: 'p-100' } });
    expect(state.phase).toBe('idle');
    expect(state.projectId).toBe('p-100');
  });

  it('handles repo connecting and connected', () => {
    let state = aiFlowReducer(initialAiFlowState, { type: 'REPO_CONNECT_REQUESTED' });
    expect(state.phase).toBe('connecting_repo');

    const repo: RepoInfo = {
      fullName: 'org/repo',
      defaultBranch: 'main',
      headCommitSha: 'sha123',
      private: false,
      access: 'read-only',
    };
    state = aiFlowReducer(state, { type: 'REPO_STATUS_RECEIVED', payload: { repo } });
    expect(state.phase).toBe('idle');
    expect(state.repo?.fullName).toBe('org/repo');
  });

  it('handles repo error', () => {
    let state = aiFlowReducer(initialAiFlowState, { type: 'REPO_CONNECT_REQUESTED' });
    state = aiFlowReducer(state, {
      type: 'REPO_STATUS_RECEIVED',
      payload: { repo: null, error: { code: 'REPO_NOT_FOUND', message: 'Not found' } },
    });
    expect(state.phase).toBe('error');
    expect(state.error?.where).toBe('github');
  });

  it('transitions to analyzing upon ANALYZE_REQUESTED', () => {
    const state = aiFlowReducer(initialAiFlowState, {
      type: 'ANALYZE_REQUESTED',
      payload: { snapshot: mockSnapshot, hash: 'hash1' },
    });
    expect(state.phase).toBe('analyzing');
    expect(state.analyzedHash).toBe('hash1');
  });

  it('sets brief_ready when BRIEF_READY arrives with matching hash', () => {
    const analyzingState: AiFlowState = {
      ...initialAiFlowState,
      phase: 'analyzing',
      analyzedHash: 'hash1',
      currentHash: 'hash1',
    };
    const state = aiFlowReducer(analyzingState, {
      type: 'BRIEF_READY',
      payload: { brief: mockBrief, hash: 'hash1', snapshot: mockSnapshot },
    });
    expect(state.phase).toBe('brief_ready');
    expect(state.brief).toEqual(mockBrief);
  });

  it('becomes stale if inputs changed during analysis', () => {
    const analyzingState: AiFlowState = {
      ...initialAiFlowState,
      phase: 'analyzing',
      analyzedHash: 'hash1',
      currentHash: 'hash2-changed',
    };
    const state = aiFlowReducer(analyzingState, {
      type: 'BRIEF_READY',
      payload: { brief: mockBrief, hash: 'hash1', snapshot: mockSnapshot },
    });
    expect(state.phase).toBe('stale');
  });

  it('switches between brief_ready and stale on INPUTS_CHANGED', () => {
    let state: AiFlowState = {
      ...initialAiFlowState,
      phase: 'brief_ready',
      analyzedHash: 'hash1',
      currentHash: 'hash1',
    };

    // Form inputs changed -> stale
    state = aiFlowReducer(state, { type: 'INPUTS_CHANGED', payload: { hash: 'hash2' } });
    expect(state.phase).toBe('stale');

    // Form inputs reverted -> brief_ready
    state = aiFlowReducer(state, { type: 'INPUTS_CHANGED', payload: { hash: 'hash1' } });
    expect(state.phase).toBe('brief_ready');
  });

  it('computes canRescan accurately (only when stale or analysis error)', () => {
    const readyState: AiFlowState = { ...initialAiFlowState, phase: 'brief_ready', analyzedHash: 'h1' };
    expect(canRescan(readyState, 'h1')).toBe(false);
    expect(canRescan(readyState, 'h2')).toBe(true);

    const staleState: AiFlowState = { ...initialAiFlowState, phase: 'stale', analyzedHash: 'h1' };
    expect(canRescan(staleState, 'h2')).toBe(true);

    const errState: AiFlowState = {
      ...initialAiFlowState,
      phase: 'error',
      error: { where: 'analysis', code: 'AI_TIMEOUT', message: 'Timed out' },
    };
    expect(canRescan(errState)).toBe(true);

    const ghErrState: AiFlowState = {
      ...initialAiFlowState,
      phase: 'error',
      error: { where: 'github', code: 'REPO_NOT_FOUND', message: 'Not found' },
    };
    expect(canRescan(ghErrState)).toBe(false);
  });

  it('handles two-step publish flow (brief then publish)', () => {
    let state: AiFlowState = { ...initialAiFlowState, phase: 'brief_ready' };
    state = aiFlowReducer(state, { type: 'PUBLISH_REQUESTED' });
    expect(state.phase).toBe('publishing');
    expect(state.publishStep).toBe('brief');

    state = aiFlowReducer(state, { type: 'BRIEF_SAVED' });
    expect(state.publishStep).toBe('publish');

    state = aiFlowReducer(state, { type: 'PUBLISHED' });
    expect(state.phase).toBe('published');
    expect(state.publishStep).toBe(null);
  });

  it('preserves publishStep "publish" when step 2 fails', () => {
    let state: AiFlowState = {
      ...initialAiFlowState,
      phase: 'publishing',
      publishStep: 'publish',
    };
    state = aiFlowReducer(state, {
      type: 'FAILED',
      payload: { error: { where: 'publish', code: 'GATEWAY_ERROR', message: 'Publish failed' } },
    });
    expect(state.phase).toBe('error');
    expect(state.publishStep).toBe('publish');
  });

  it('clears state on BRIEF_DISMISSED', () => {
    const readyState: AiFlowState = {
      ...initialAiFlowState,
      phase: 'brief_ready',
      brief: mockBrief,
      snapshot: mockSnapshot,
      analyzedHash: 'hash1',
    };
    const state = aiFlowReducer(readyState, { type: 'BRIEF_DISMISSED' });
    expect(state.phase).toBe('idle');
    expect(state.brief).toBe(null);
  });

  it('computeInputsHash ignores budget changes', () => {
    const input1 = {
      title: 'Fix issue',
      description: 'Critical bug',
      stacks: ['REACT'],
      specialties: ['FRONTEND'],
      repoFullName: 'org/repo',
      headCommitSha: 'sha1',
    };
    const hash1 = computeInputsHash(input1);
    const hash2 = computeInputsHash({ ...input1 });
    expect(hash1).toBe(hash2);
  });
});
