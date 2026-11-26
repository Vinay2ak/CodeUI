import { describe, it, expect } from 'vitest';
import { deriveSignals } from './signals';
import { AutomatedRun, AiVerificationReport, DockerTestResult } from './types';

describe('deriveSignals', () => {
  const makeCheck = (
    id: string,
    required: boolean,
    status: DockerTestResult['status']
  ): DockerTestResult => ({
    id,
    kind: 'test',
    command: 'pytest',
    exitCode: status === 'passed' ? 0 : 1,
    status,
    durationMs: 100,
    required,
    logTail: '',
    logTruncated: false,
  });

  const baseRun: AutomatedRun = {
    runId: 'r1',
    submissionId: 's1',
    commitSha: 'abcdef1',
    status: 'completed',
    startedAt: '2026',
    finishedAt: '2026',
    message: null,
    checks: [
      makeCheck('1', true, 'passed'),
      makeCheck('2', true, 'passed'),
      makeCheck('3', false, 'failed'), // optional check
    ],
    diff: { files: [], totalAdditions: 0, totalDeletions: 0 },
  };

  it('1. returns criteria counts correctly', () => {
    const report: AiVerificationReport = {
      reportId: 'rep1',
      generatedAt: '2026',
      criteria: [
        { criterionId: '1', text: 'c1', required: true, status: 'met', reasoning: '', evidence: [] },
        { criterionId: '2', text: 'c2', required: true, status: 'partial', reasoning: '', evidence: [] },
        { criterionId: '3', text: 'c3', required: false, status: 'not_met', reasoning: '', evidence: [] },
        { criterionId: '4', text: 'c4', required: false, status: 'unknown', reasoning: '', evidence: [] },
      ],
      risks: [],
    };

    const res = deriveSignals(baseRun, report);
    expect(res.criteriaCounts).toEqual({
      met: 1,
      partial: 1,
      not_met: 1,
      unknown: 1,
    });
  });

  it('2. detects checks_pass_ai_flags when required checks pass but required criterion is partial or not_met', () => {
    const report: AiVerificationReport = {
      reportId: 'rep1',
      generatedAt: '2026',
      criteria: [
        { criterionId: '1', text: 'c1', required: true, status: 'met', reasoning: '', evidence: [] },
        { criterionId: '2', text: 'c2', required: true, status: 'partial', reasoning: '', evidence: [] },
      ],
      risks: [],
    };

    const res = deriveSignals(baseRun, report);
    expect(res.disagreement).toBe('checks_pass_ai_flags');
    expect(res.disagreeingCriteria).toBe(1);
  });

  it('3. detects checks_fail_ai_clean when required check fails and all AI criteria are met', () => {
    const failingRun: AutomatedRun = {
      ...baseRun,
      checks: [
        makeCheck('1', true, 'passed'),
        makeCheck('2', true, 'failed'), // required check failed
      ],
    };

    const cleanReport: AiVerificationReport = {
      reportId: 'rep1',
      generatedAt: '2026',
      criteria: [
        { criterionId: '1', text: 'c1', required: true, status: 'met', reasoning: '', evidence: [] },
        { criterionId: '2', text: 'c2', required: false, status: 'met', reasoning: '', evidence: [] },
      ],
      risks: [],
    };

    const res = deriveSignals(failingRun, cleanReport);
    expect(res.disagreement).toBe('checks_fail_ai_clean');
    expect(res.disagreeingCriteria).toBe(0);
  });

  it('4. returns none when both systems are aligned (all pass and all met)', () => {
    const cleanReport: AiVerificationReport = {
      reportId: 'rep1',
      generatedAt: '2026',
      criteria: [
        { criterionId: '1', text: 'c1', required: true, status: 'met', reasoning: '', evidence: [] },
      ],
      risks: [],
    };

    const res = deriveSignals(baseRun, cleanReport);
    expect(res.disagreement).toBe('none');
    expect(res.disagreeingCriteria).toBe(0);
  });

  it('5. returns none when run is null', () => {
    const report: AiVerificationReport = {
      reportId: 'rep1',
      generatedAt: '2026',
      criteria: [
        { criterionId: '1', text: 'c1', required: true, status: 'not_met', reasoning: '', evidence: [] },
      ],
      risks: [],
    };

    const res = deriveSignals(null, report);
    expect(res.disagreement).toBe('none');
    expect(res.criteriaCounts.not_met).toBe(1);
  });

  it('6. returns none when report is null', () => {
    const res = deriveSignals(baseRun, null);
    expect(res.disagreement).toBe('none');
    expect(res.criteriaCounts).toEqual({ met: 0, partial: 0, not_met: 0, unknown: 0 });
  });
});
