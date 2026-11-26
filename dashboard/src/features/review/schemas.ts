import { z } from 'zod';
import { safeLine, redactSecrets } from '../../lib/safeText';
import {
  AiVerificationReport,
  DockerTestResult,
  AutomatedRun,
} from './types';

// Clamp and redact string helper
function clampedRedacted(maxLen: number) {
  return z
    .string()
    .transform((val) => {
      const clean = safeLine(val);
      const redacted = redactSecrets(clean);
      return redacted.length > maxLen ? redacted.slice(0, maxLen) : redacted;
    });
}

export const evidenceItemSchema = z.object({
  path: z.string().transform((v) => safeLine(v)),
  startLine: z.number().nullable().optional().default(null),
  endLine: z.number().nullable().optional().default(null),
  snippet: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? clampedRedacted(400).parse(v) : null)),
  inDiff: z.boolean().optional(),
});

export const criterionSchema = z.object({
  criterionId: z.string().optional().default(() => Math.random().toString(36).substring(2, 9)),
  id: z.string().optional(),
  text: clampedRedacted(300),
  required: z.boolean().optional().default(true),
  status: z
    .enum(['met', 'partial', 'not_met', 'unknown'])
    .or(
      z.string().transform((v) => {
        const lower = v.toLowerCase();
        if (lower === 'met') return 'met' as const;
        if (lower === 'partial' || lower === 'partially_met') return 'partial' as const;
        if (lower === 'not_met') return 'not_met' as const;
        return 'unknown' as const;
      })
    ),
  reasoning: clampedRedacted(400),
  evidence: z
    .array(evidenceItemSchema)
    .max(3)
    .optional()
    .default([]),
}).transform((data) => ({
  criterionId: data.criterionId || data.id || Math.random().toString(36).substring(2, 9),
  text: data.text,
  required: data.required,
  status: data.status,
  reasoning: data.reasoning,
  evidence: data.evidence,
}));

export const riskSchema = z.object({
  id: z.string().optional().default(() => Math.random().toString(36).substring(2, 9)),
  severity: z
    .enum(['high', 'medium', 'low'])
    .or(
      z.string().transform((v) => {
        const lower = v.toLowerCase();
        if (lower === 'high') return 'high' as const;
        if (lower === 'medium') return 'medium' as const;
        return 'low' as const;
      })
    ),
  category: z
    .enum(['error_handling', 'secrets', 'unaddressed_requirement', 'security', 'other'])
    .or(
      z.string().transform((v) => {
        const lower = v.toLowerCase();
        if (
          lower === 'error_handling' ||
          lower === 'secrets' ||
          lower === 'unaddressed_requirement' ||
          lower === 'security'
        ) {
          return lower as 'error_handling' | 'secrets' | 'unaddressed_requirement' | 'security';
        }
        return 'other' as const;
      })
    ),
  text: clampedRedacted(300),
  evidence: z
    .array(
      z.object({
        path: z.string().transform((v) => safeLine(v)),
        startLine: z.number().nullable().optional().default(null),
        endLine: z.number().nullable().optional().default(null),
      })
    )
    .max(3)
    .optional()
    .default([]),
});

export const aiVerificationReportSchema = z.object({
  reportId: z.string().optional(),
  report_id: z.string().optional(),
  generatedAt: z.string().optional(),
  generated_at: z.string().optional(),
  criteria: z.array(criterionSchema).max(12),
  risks: z.array(riskSchema).max(12).optional().default([]),
}).transform((data): AiVerificationReport => ({
  reportId: data.reportId || data.report_id || Math.random().toString(36).substring(2, 9),
  generatedAt: data.generatedAt || data.generated_at || new Date().toISOString(),
  criteria: data.criteria,
  risks: data.risks,
}));

export const dockerTestResultSchema = z.object({
  id: z.string(),
  kind: z.enum(['install', 'build', 'lint', 'test', 'other']),
  command: clampedRedacted(300),
  exitCode: z.number().nullable().optional().default(null),
  exit_code: z.number().nullable().optional(),
  status: z.enum(['passed', 'failed', 'timed_out', 'skipped', 'error']),
  durationMs: z.number().optional().default(0),
  duration_ms: z.number().optional(),
  required: z.boolean().optional().default(true),
  logTail: z.string().optional().default(''),
  log_tail: z.string().optional(),
  logTruncated: z.boolean().optional().default(false),
  log_truncated: z.boolean().optional(),
}).transform((data): DockerTestResult => {
  const rawTail = data.logTail || data.log_tail || '';
  const lines = rawTail.split('\n');
  const clampedLines = lines
    .slice(-200) // keep last 200 lines
    .map((line) => {
      const clean = safeLine(line);
      const redacted = redactSecrets(clean);
      return redacted.length > 400 ? redacted.slice(0, 400) : redacted;
    });

  return {
    id: data.id,
    kind: data.kind,
    command: data.command,
    exitCode: data.exitCode !== undefined && data.exitCode !== null ? data.exitCode : (data.exit_code ?? null),
    status: data.status,
    durationMs: data.durationMs || data.duration_ms || 0,
    required: data.required,
    logTail: clampedLines.join('\n'),
    logTruncated: data.logTruncated || data.log_truncated || lines.length > 200,
  };
});

export const diffFileSchema = z.object({
  path: z.string().transform((v) => safeLine(v)),
  status: z.enum(['added', 'modified', 'deleted', 'renamed']),
  additions: z.number().default(0),
  deletions: z.number().default(0),
});

export const automatedRunSchema = z.object({
  runId: z.string().optional(),
  run_id: z.string().optional(),
  submissionId: z.string().optional(),
  submission_id: z.string().optional(),
  commitSha: z.string().optional(),
  commit_sha: z.string().optional(),
  status: z.enum(['running', 'completed', 'failed_to_run']),
  startedAt: z.string().optional(),
  started_at: z.string().optional(),
  finishedAt: z.string().nullable().optional().default(null),
  finished_at: z.string().nullable().optional(),
  message: z.string().nullable().optional().default(null),
  checks: z.array(dockerTestResultSchema).default([]),
  diff: z.object({
    files: z.array(diffFileSchema).default([]),
    totalAdditions: z.number().optional().default(0),
    total_additions: z.number().optional(),
    totalDeletions: z.number().optional().default(0),
    total_deletions: z.number().optional(),
  }).transform((d) => ({
    files: d.files,
    totalAdditions: d.totalAdditions || d.total_additions || 0,
    totalDeletions: d.totalDeletions || d.total_deletions || 0,
  })).default({ files: [], totalAdditions: 0, totalDeletions: 0 }),
}).transform((data): AutomatedRun => ({
  runId: data.runId || data.run_id || 'run_unknown',
  submissionId: data.submissionId || data.submission_id || 'sub_unknown',
  commitSha: data.commitSha || data.commit_sha || '',
  status: data.status,
  startedAt: data.startedAt || data.started_at || new Date().toISOString(),
  finishedAt: data.finishedAt !== undefined ? data.finishedAt : (data.finished_at ?? null),
  message: data.message ? safeLine(data.message) : null,
  checks: data.checks,
  diff: data.diff,
}));
