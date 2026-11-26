import { describe, it, expect } from 'vitest';
import type { AiDeveloperBrief } from './types';
import {
  updateCriterion,
  removeCriterion,
  addCriterion,
  setRequired,
  removeStep,
  removeFile,
  validateBrief,
} from './briefEdit';

const baseBrief: AiDeveloperBrief = {
  briefId: 'b-1',
  generatedAt: '2026-03-12T00:00:00Z',
  repoCommitSha: 'abc1234',
  problemSummary: 'Problem',
  suspectedFiles: [
    { path: 'src/a.ts', startLine: 1, endLine: 10, reason: 'r1', verified: true },
    { path: 'src/b.ts', startLine: null, endLine: null, reason: 'r2', verified: false },
  ],
  rootCauseHypothesis: 'Root cause',
  stepByStepPlan: [
    { id: 's-1', text: 'Step 1' },
    { id: 's-2', text: 'Step 2' },
  ],
  acceptanceCriteria: [
    { id: 'c-1', text: 'Criterion 1 is valid', required: true, source: 'ai' },
    { id: 'c-2', text: 'Criterion 2 is valid', required: true, source: 'ai' },
  ],
};

describe('briefEdit operations', () => {
  it('updateCriterion updates the criterion text and sanitizes', () => {
    const updated = updateCriterion(baseBrief, 'c-1', 'Updated text here');
    expect(updated.acceptanceCriteria.find((c) => c.id === 'c-1')?.text).toBe('Updated text here');
  });

  it('removeCriterion removes the specified criterion', () => {
    const updated = removeCriterion(baseBrief, 'c-1');
    expect(updated.acceptanceCriteria).toHaveLength(1);
    expect(updated.acceptanceCriteria[0].id).toBe('c-2');
  });

  it('addCriterion adds a new owner criterion', () => {
    const updated = addCriterion(baseBrief, 'Brand new criterion 3');
    expect(updated.acceptanceCriteria).toHaveLength(3);
    const added = updated.acceptanceCriteria[2];
    expect(added.text).toBe('Brand new criterion 3');
    expect(added.source).toBe('owner');
    expect(added.required).toBe(true);
  });

  it('setRequired toggles required status', () => {
    const updated = setRequired(baseBrief, 'c-1', false);
    expect(updated.acceptanceCriteria.find((c) => c.id === 'c-1')?.required).toBe(false);
  });

  it('removeStep removes step by id', () => {
    const updated = removeStep(baseBrief, 's-1');
    expect(updated.stepByStepPlan).toHaveLength(1);
    expect(updated.stepByStepPlan[0].id).toBe('s-2');
  });

  it('removeFile removes suspected file by path', () => {
    const updated = removeFile(baseBrief, 'src/a.ts');
    expect(updated.suspectedFiles).toHaveLength(1);
    expect(updated.suspectedFiles[0].path).toBe('src/b.ts');
  });

  it('validateBrief accepts valid criteria', () => {
    const result = validateBrief(baseBrief);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validateBrief rejects 0 criteria or short (<5 chars) criteria', () => {
    const emptyBrief = { ...baseBrief, acceptanceCriteria: [] };
    const resEmpty = validateBrief(emptyBrief);
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.errors[0]).toContain('At least one acceptance criterion is required');

    const shortBrief = {
      ...baseBrief,
      acceptanceCriteria: [{ id: 'c-short', text: 'bad', required: true, source: 'owner' as const }],
    };
    const resShort = validateBrief(shortBrief);
    expect(resShort.valid).toBe(false);
    expect(resShort.errors[0]).toContain('must be at least 5 characters');
  });

  it('validateBrief rejects duplicate criteria ignoring case', () => {
    const dupBrief = {
      ...baseBrief,
      acceptanceCriteria: [
        { id: 'c-1', text: 'Same text criterion', required: true, source: 'ai' as const },
        { id: 'c-2', text: 'same text criterion', required: true, source: 'owner' as const },
      ],
    };
    const result = validateBrief(dupBrief);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Duplicate criterion found');
  });
});
