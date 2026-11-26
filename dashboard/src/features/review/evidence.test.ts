import { describe, it, expect } from 'vitest';
import { validateEvidence, countUnverifiedEvidence } from './evidence';
import { AiVerificationReport } from './types';

describe('validateEvidence', () => {
  const baseReport: AiVerificationReport = {
    reportId: 'rep_1',
    generatedAt: '2026-11-20T10:00:00Z',
    criteria: [
      {
        criterionId: 'crit_1',
        text: 'Criterion 1',
        required: true,
        status: 'met',
        reasoning: 'Verified code',
        evidence: [
          { path: 'src/app/main.ts', startLine: 10, endLine: 20, snippet: 'code' },
          { path: 'src\\lib\\utils.ts', startLine: 5, endLine: 12, snippet: 'util' },
          { path: 'docs/readme.md', startLine: 1, endLine: 5, snippet: 'docs' },
        ],
      },
    ],
    risks: [],
  };

  it('1. correctly flags evidence present in diff with slash normalization', () => {
    const diffFiles = [
      { path: 'src/app/main.ts', status: 'modified' as const, additions: 5, deletions: 1 },
      { path: 'src/lib/utils.ts', status: 'modified' as const, additions: 2, deletions: 0 },
    ];

    const result = validateEvidence(baseReport, diffFiles);
    expect(result.criteria[0].evidence[0].inDiff).toBe(true);
    expect(result.criteria[0].evidence[1].inDiff).toBe(true); // src\lib\utils.ts normalized
    expect(result.criteria[0].evidence[2].inDiff).toBe(false);
  });

  it('2. performs case-sensitive comparison of paths', () => {
    const diffFiles = [{ path: 'SRC/APP/MAIN.TS' }];
    const result = validateEvidence(baseReport, diffFiles);
    expect(result.criteria[0].evidence[0].inDiff).toBe(false);
  });

  it('3. handles empty diffFiles properly', () => {
    const result = validateEvidence(baseReport, []);
    expect(result.criteria[0].evidence[0].inDiff).toBe(false);
    expect(result.criteria[0].evidence[1].inDiff).toBe(false);
    expect(result.criteria[0].evidence[2].inDiff).toBe(false);
  });

  it('4. countUnverifiedEvidence counts items flagged with inDiff === false', () => {
    const diffFiles = [{ path: 'src/app/main.ts' }];
    const validated = validateEvidence(baseReport, diffFiles);
    const unverifiedCount = countUnverifiedEvidence(validated);
    expect(unverifiedCount).toBe(2);
  });

  it('5. returns 0 unverified when all evidence paths are in diff', () => {
    const diffFiles = [
      { path: 'src/app/main.ts' },
      { path: 'src/lib/utils.ts' },
      { path: 'docs/readme.md' },
    ];
    const validated = validateEvidence(baseReport, diffFiles);
    expect(countUnverifiedEvidence(validated)).toBe(0);
  });
});
