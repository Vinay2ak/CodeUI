import { z } from 'zod';
import { safeLine, redactSecrets, clampText, isSafePath } from '../../lib/safeText';

function sanitizeAndClamp(val: string, max: number): string {
  if (typeof val !== 'string') return '';
  return clampText(redactSecrets(safeLine(val)), max);
}

export const suspectedFileSchema = z
  .object({
    path: z.string(),
    startLine: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
    endLine: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
    reason: z
      .string()
      .default('')
      .transform((val) => sanitizeAndClamp(val, 240)),
    verified: z.boolean().nullable().optional().transform((v) => v ?? null),
  })
  .refine((file) => isSafePath(file.path), {
    message: 'Invalid or unsafe file path',
  });

export const briefStepSchema = z.object({
  id: z.string().default(() => `step-${Math.random().toString(36).substring(2, 9)}`),
  text: z.string().transform((val) => sanitizeAndClamp(val, 300)),
});

export const acceptanceCriterionSchema = z.object({
  id: z.string().default(() => `crit-${Math.random().toString(36).substring(2, 9)}`),
  text: z.string().transform((val) => sanitizeAndClamp(val, 200)),
  required: z.boolean().default(true),
  source: z.enum(['ai', 'owner']).default('ai'),
});

export const aiBriefSchema = z
  .object({
    briefId: z.string().default(() => `brief-${Date.now()}`),
    generatedAt: z.string().default(() => new Date().toISOString()),
    repoCommitSha: z.string().default(''),
    problemSummary: z
      .string()
      .min(1, 'Problem summary is required')
      .transform((val) => sanitizeAndClamp(val, 1200))
      .refine((val) => val.trim().length > 0, {
        message: 'Problem summary cannot be empty',
      }),
    suspectedFiles: z
      .array(z.any())
      .default([])
      .transform((files) => {
        const valid: z.infer<typeof suspectedFileSchema>[] = [];
        for (const file of files) {
          const res = suspectedFileSchema.safeParse(file);
          if (res.success) {
            valid.push(res.data);
          }
        }
        // Truncate to at most 10
        return valid.slice(0, 10);
      }),
    rootCauseHypothesis: z
      .string()
      .default('')
      .transform((val) => sanitizeAndClamp(val, 1500)),
    stepByStepPlan: z
      .array(briefStepSchema)
      .default([])
      .transform((steps) => steps.slice(0, 12)),
    acceptanceCriteria: z
      .array(acceptanceCriterionSchema)
      .default([])
      .transform((crit) => crit.slice(0, 12))
      .refine((crit) => crit.length > 0, {
        message: 'At least one acceptance criterion is required',
      }),
  });

export const confirmedBriefSchema = aiBriefSchema.extend({
  inputsHash: z.string().min(1, 'inputsHash is required'),
  confirmedAt: z.string().default(() => new Date().toISOString()),
});
