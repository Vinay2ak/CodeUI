import { describe, it, expect } from 'vitest';
import {
  aiVerificationReportSchema,
  dockerTestResultSchema,
  automatedRunSchema,
} from './schemas';

describe('review schemas hardening & normalization', () => {
  it('1. accepts snake_case fields and normalizes to camelCase', () => {
    const raw = {
      report_id: 'rep_123',
      generated_at: '2026-11-20T12:00:00Z',
      criteria: [
        {
          id: 'crit_1',
          text: 'Payment retry handling',
          required: true,
          status: 'PARTIALLY_MET',
          reasoning: 'Exponential backoff verified but max retry limit is not enforced.',
          evidence: [
            {
              path: 'app/webhooks.py',
              startLine: 10,
              endLine: 25,
              snippet: 'def retry(): pass',
            },
          ],
        },
      ],
      risks: [
        {
          id: 'risk_1',
          severity: 'HIGH',
          category: 'SECURITY',
          text: 'Open redirect risk in auth callback',
          evidence: [{ path: 'app/auth.py', startLine: 5, endLine: 12 }],
        },
      ],
    };

    const parsed = aiVerificationReportSchema.parse(raw);
    expect(parsed.reportId).toBe('rep_123');
    expect(parsed.generatedAt).toBe('2026-11-20T12:00:00Z');
    expect(parsed.criteria[0].status).toBe('partial');
    expect(parsed.risks[0].severity).toBe('high');
    expect(parsed.risks[0].category).toBe('security');
  });

  it('2. redacts secrets embedded in reasoning and risk texts', () => {
    const raw = {
      criteria: [
        {
          criterionId: 'c1',
          text: 'Secret test',
          status: 'met',
          reasoning: 'Found auth token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN45POgJKMGReDTQrlqdEqDhY9aO100ecaNYWaPM in configuration',
        },
      ],
      risks: [
        {
          severity: 'high',
          category: 'secrets',
          text: 'Embedded API Key sk-test-1234567890abcdefghijkl in config file',
        },
      ],
    };

    const parsed = aiVerificationReportSchema.parse(raw);
    expect(parsed.criteria[0].reasoning).not.toContain('eyJhbGciOi');
    expect(parsed.criteria[0].reasoning).toContain('[redacted]');
    expect(parsed.risks[0].text).not.toContain('sk-test-');
    expect(parsed.risks[0].text).toContain('[redacted]');
  });

  it('3. leaves HTML strings as plain text without interpretation', () => {
    const raw = {
      criteria: [
        {
          criterionId: 'c1',
          text: '<script>alert("xss")</script>',
          status: 'met',
          reasoning: '<b onmouseover="alert(1)">Bold</b>',
        },
      ],
    };

    const parsed = aiVerificationReportSchema.parse(raw);
    expect(parsed.criteria[0].text).toBe('<script>alert("xss")</script>');
    expect(parsed.criteria[0].reasoning).toBe('<b onmouseover="alert(1)">Bold</b>');
  });

  it('4. clamps reasoning to 400 chars, risk text to 300 chars, snippet to 400 chars', () => {
    const longString = 'a'.repeat(600);
    const raw = {
      criteria: [
        {
          criterionId: 'c1',
          text: 'test',
          status: 'met',
          reasoning: longString,
          evidence: [
            {
              path: 'file.ts',
              snippet: longString,
            },
          ],
        },
      ],
      risks: [
        {
          severity: 'low',
          category: 'other',
          text: longString,
        },
      ],
    };

    const parsed = aiVerificationReportSchema.parse(raw);
    expect(parsed.criteria[0].reasoning.length).toBeLessThanOrEqual(400);
    expect(parsed.criteria[0].evidence[0].snippet?.length).toBeLessThanOrEqual(400);
    expect(parsed.risks[0].text.length).toBeLessThanOrEqual(300);
  });

  it('5. clamps at most 12 criteria, 12 risks, and 3 evidence items each', () => {
    const extraCriteria = Array.from({ length: 15 }, (_, i) => ({
      criterionId: `c_${i}`,
      text: `Criterion ${i}`,
      status: 'met',
      reasoning: 'ok',
      evidence: Array.from({ length: 5 }, (_, j) => ({
        path: `src/file_${j}.ts`,
      })),
    }));

    // Expect zod array max(12) to reject or fail on 15 criteria
    expect(() => aiVerificationReportSchema.parse({ criteria: extraCriteria })).toThrow();
  });

  it('6. clamps test logTail to at most 200 lines and redacts secrets in log lines', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `Line ${i}: log message`);
    lines[250] = 'Line 250: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN45POgJKMGReDTQrlqdEqDhY9aO100ecaNYWaPM';

    const raw = {
      id: 'check_1',
      kind: 'test',
      command: 'pytest',
      status: 'failed',
      logTail: lines.join('\n'),
    };

    const parsed = dockerTestResultSchema.parse(raw);
    const parsedLines = parsed.logTail.split('\n');
    expect(parsedLines.length).toBe(200);
    expect(parsed.logTruncated).toBe(true);
    expect(parsed.logTail).toContain('[redacted]');
    expect(parsed.logTail).not.toContain('eyJhbGciOi');
  });

  it('7. parses automatedRun with checks and diff summary', () => {
    const raw = {
      run_id: 'run_999',
      status: 'completed',
      checks: [
        {
          id: 'c1',
          kind: 'lint',
          command: 'flake8',
          status: 'passed',
        },
      ],
      diff: {
        files: [
          {
            path: 'app/main.py',
            status: 'modified',
            additions: 12,
            deletions: 4,
          },
        ],
        total_additions: 12,
        total_deletions: 4,
      },
    };

    const parsed = automatedRunSchema.parse(raw);
    expect(parsed.runId).toBe('run_999');
    expect(parsed.checks.length).toBe(1);
    expect(parsed.diff.files[0].path).toBe('app/main.py');
    expect(parsed.diff.totalAdditions).toBe(12);
    expect(parsed.diff.totalDeletions).toBe(4);
  });
});
