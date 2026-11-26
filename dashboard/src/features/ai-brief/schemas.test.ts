import { describe, it, expect } from 'vitest';
import { aiBriefSchema } from './schemas';
import { adaptAiBrief } from './adapters';

describe('aiBriefSchema & adapters', () => {
  it('parses valid camelCase fixture', () => {
    const valid = {
      briefId: 'brief-123',
      generatedAt: '2026-03-12T10:00:00Z',
      repoCommitSha: 'a1b2c3d4e5f6',
      problemSummary: 'Payment webhook drops events under load',
      suspectedFiles: [
        {
          path: 'app/webhooks.py',
          startLine: 34,
          endLine: 71,
          reason: 'Missing idempotency check',
          verified: true,
        },
      ],
      rootCauseHypothesis: 'Database lock timeout causes 500 error',
      stepByStepPlan: [{ id: 'step-1', text: 'Add idempotency table check' }],
      acceptanceCriteria: [
        { id: 'crit-1', text: 'Duplicate webhook returns 200', required: true, source: 'ai' },
      ],
    };

    const parsed = aiBriefSchema.parse(valid);
    expect(parsed.briefId).toBe('brief-123');
    expect(parsed.suspectedFiles).toHaveLength(1);
    expect(parsed.acceptanceCriteria).toHaveLength(1);
  });

  it('normalizes deep snake_case payloads to camelCase via adaptAiBrief', () => {
    const snakeFixture = {
      brief_id: 'brief-snake-1',
      generated_at: '2026-03-12T10:00:00Z',
      repo_commit_sha: '1234567890abcdef',
      problem_summary: 'Webhook error',
      suspected_files: [
        {
          path: 'src/handler.py',
          start_line: 10,
          end_line: 20,
          reason: 'unhandled exception',
          verified: false,
        },
      ],
      root_cause_hypothesis: 'Null pointer on payload',
      step_by_step_plan: [{ id: 's-1', text: 'Check null' }],
      acceptance_criteria: [
        { id: 'c-1', text: 'Returns 400 on null payload', required: true, source: 'ai' },
      ],
    };

    const brief = adaptAiBrief(snakeFixture);
    expect(brief.briefId).toBe('brief-snake-1');
    expect(brief.repoCommitSha).toBe('1234567890abcdef');
    expect(brief.suspectedFiles[0].path).toBe('src/handler.py');
    expect(brief.suspectedFiles[0].verified).toBe(false);
  });

  it('truncates arrays exceeding maximum limits (files: 10, plan: 12, criteria: 12)', () => {
    const largeFiles = Array.from({ length: 15 }, (_, i) => ({
      path: `src/file_${i}.ts`,
      reason: `Reason ${i}`,
    }));
    const largePlan = Array.from({ length: 16 }, (_, i) => ({
      id: `p-${i}`,
      text: `Step ${i}`,
    }));
    const largeCrit = Array.from({ length: 20 }, (_, i) => ({
      id: `c-${i}`,
      text: `Criterion ${i}`,
      required: true,
      source: 'ai',
    }));

    const parsed = aiBriefSchema.parse({
      problemSummary: 'Issue',
      suspectedFiles: largeFiles,
      stepByStepPlan: largePlan,
      acceptanceCriteria: largeCrit,
    });

    expect(parsed.suspectedFiles.length).toBe(10);
    expect(parsed.stepByStepPlan.length).toBe(12);
    expect(parsed.acceptanceCriteria.length).toBe(12);
  });

  it('redacts secrets inside reasons and descriptions', () => {
    const input = {
      problemSummary: 'Leaked sk-abcdef1234567890abcdef1234 in log',
      acceptanceCriteria: [
        {
          id: 'c1',
          text: 'Found token ghp_12345678901234567890123456789012 in response',
          required: true,
          source: 'ai',
        },
      ],
    };

    const parsed = aiBriefSchema.parse(input);
    expect(parsed.problemSummary).toBe('Leaked [redacted] in log');
    expect(parsed.acceptanceCriteria[0].text).toBe('Found token [redacted] in response');
  });

  it('keeps HTML strings as plain strings without execution', () => {
    const input = {
      problemSummary: '<script>alert("xss")</script>',
      acceptanceCriteria: [
        { id: 'c1', text: '<img src=x onerror=alert(1)>', required: true, source: 'ai' },
      ],
    };

    const parsed = aiBriefSchema.parse(input);
    expect(parsed.problemSummary).toBe('<script>alert("xss")</script>');
    expect(parsed.acceptanceCriteria[0].text).toBe('<img src=x onerror=alert(1)>');
  });

  it('fails parse if problemSummary is missing or empty', () => {
    expect(() =>
      aiBriefSchema.parse({
        problemSummary: '   ',
        acceptanceCriteria: [{ id: 'c1', text: 'Works', required: true, source: 'ai' }],
      })
    ).toThrow();
  });

  it('fails parse if acceptance criteria list is empty', () => {
    expect(() =>
      aiBriefSchema.parse({
        problemSummary: 'Valid summary',
        acceptanceCriteria: [],
      })
    ).toThrow();
  });

  it('drops invalid or unsafe paths from suspectedFiles', () => {
    const input = {
      problemSummary: 'Valid summary',
      suspectedFiles: [
        { path: 'src/valid.ts', reason: 'valid' },
        { path: '../secret.ts', reason: 'unsafe path traversal' },
        { path: '/etc/shadow', reason: 'leading slash' },
        { path: 'src\\windows\\file.ts', reason: 'backslash' },
      ],
      acceptanceCriteria: [{ id: 'c1', text: 'Works', required: true, source: 'ai' }],
    };

    const parsed = aiBriefSchema.parse(input);
    expect(parsed.suspectedFiles).toHaveLength(1);
    expect(parsed.suspectedFiles[0].path).toBe('src/valid.ts');
  });
});
