import { z } from "zod";
import { safeLine, redactSecrets, clampText, isSafePath } from "../../lib/safeText";
import type {
  DependencyKind,
  CriterionStatus,
  RiskSeverity,
  RiskCategory,
  JobKind,
  JobStatus,
} from "./types";

const sanitizeString = (max: number) =>
  z
    .string()
    .transform((val) => clampText(redactSecrets(safeLine(val)), max));

const dependencyKindSchema = z
  .string()
  .transform((val): DependencyKind => {
    const lower = val.toLowerCase();
    if (lower === "runtime" || lower === "dev" || lower === "service") {
      return lower;
    }
    return "other";
  });

export const relevantFileSchema = z
  .object({
    path: z.string().optional(),
    filePath: z.string().optional(),
    startLine: z.number().nullable().optional().transform((v) => v ?? null),
    endLine: z.number().nullable().optional().transform((v) => v ?? null),
    score: z
      .number()
      .or(z.string().transform((s) => parseFloat(s) || 0))
      .transform((val) => Math.min(1, Math.max(0, val))),
    reason: z.string().optional(),
    description: z.string().optional(),
  })
  .transform((item) => {
    const rawPath = item.path || item.filePath || "";
    const cleanPath = safeLine(rawPath).trim();
    const rawReason = item.reason || item.description || "";
    const cleanReason = clampText(redactSecrets(safeLine(rawReason)), 240);
    return {
      path: cleanPath,
      startLine: item.startLine ?? null,
      endLine: item.endLine ?? null,
      score: item.score,
      reason: cleanReason,
    };
  })
  .refine((item) => isSafePath(item.path), {
    message: "Unsafe path dropped",
  });

export const dependencySchema = z.object({
  name: sanitizeString(100),
  kind: dependencyKindSchema,
  note: sanitizeString(200),
});

export const affectedAreaSchema = z.object({
  name: sanitizeString(100),
  note: sanitizeString(200),
});

export const setupHintSchema = z.object({
  command: sanitizeString(200),
  note: sanitizeString(200),
});

export const citationSchema = z
  .object({
    path: z.string().transform((p) => safeLine(p).trim()),
    startLine: z.number().nullable().optional().transform((v) => v ?? null),
    endLine: z.number().nullable().optional().transform((v) => v ?? null),
    snippet: z
      .string()
      .nullable()
      .optional()
      .transform((s) => (s ? clampText(redactSecrets(safeLine(s)), 400) : null)),
  })
  .refine((item) => isSafePath(item.path), {
    message: "Unsafe path dropped",
  });

export const aiContextSchema = z.object({
  generatedAt: z.string().optional(),
  repoCommitSha: z.string().optional(),
  summary: z
    .string()
    .min(1, "Summary is required")
    .transform((val) => clampText(redactSecrets(safeLine(val)), 1200)),
  findings: z
    .array(sanitizeString(240))
    .optional()
    .default([])
    .transform((items) => items.slice(0, 8)),
  relevantFiles: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof relevantFileSchema>[] = [];
      for (const item of items) {
        const parsed = relevantFileSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 10);
    }),
  dependencies: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof dependencySchema>[] = [];
      for (const item of items) {
        const parsed = dependencySchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 10);
    }),
  affectedAreas: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof affectedAreaSchema>[] = [];
      for (const item of items) {
        const parsed = affectedAreaSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 8);
    }),
  setupHints: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof setupHintSchema>[] = [];
      for (const item of items) {
        const parsed = setupHintSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 6);
    }),
  approach: z
    .array(sanitizeString(300))
    .optional()
    .default([])
    .transform((items) => items.slice(0, 8)),
});

export const askAnswerSchema = z.object({
  answerId: z.string().min(1),
  generatedAt: z.string().min(1),
  repoCommitSha: z.string().default("HEAD"),
  grounding: z
    .string()
    .transform((val): "grounded" | "no_evidence" =>
      val === "grounded" ? "grounded" : "no_evidence"
    ),
  answer: z
    .string()
    .min(1, "Answer is required")
    .transform((val) => clampText(redactSecrets(safeLine(val)), 4000)),
  citations: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof citationSchema>[] = [];
      for (const item of items) {
        const parsed = citationSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 8);
    }),
  remaining: z.number().nullable().optional().transform((v) => v ?? null),
});

// ==================== PART B SCHEMAS ====================

export const suspectedLocationSchema = z
  .object({
    path: z.string().transform((p) => safeLine(p).trim()),
    startLine: z.number().nullable().optional().transform((v) => v ?? null),
    endLine: z.number().nullable().optional().transform((v) => v ?? null),
    reason: sanitizeString(240),
  })
  .refine((item) => isSafePath(item.path), {
    message: "Unsafe suspected location dropped",
  });

export const failureExplanationSchema = z.object({
  explanationId: z.string().min(1),
  generatedAt: z.string().min(1),
  explanation: z
    .string()
    .min(1, "Explanation is required")
    .transform((val) => clampText(redactSecrets(safeLine(val)), 1200)),
  likelyCause: z
    .string()
    .min(1, "Likely cause is required")
    .transform((val) => clampText(redactSecrets(safeLine(val)), 400)),
  suspectedLocations: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof suspectedLocationSchema>[] = [];
      for (const item of items) {
        const parsed = suspectedLocationSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 6);
    }),
  nextSteps: z
    .array(sanitizeString(240))
    .optional()
    .default([])
    .transform((items) => items.slice(0, 6)),
});

export const criterionStatusSchema = z.string().transform((val): CriterionStatus => {
  const lower = val.toLowerCase();
  if (lower === "met" || lower === "partial" || lower === "not_met") {
    return lower;
  }
  return "unknown";
});

export const criterionCheckSchema = z.object({
  criterionId: z.string().min(1),
  text: sanitizeString(200),
  required: z.boolean().default(true),
  status: criterionStatusSchema,
  reasoning: sanitizeString(400),
  evidence: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof citationSchema>[] = [];
      for (const item of items) {
        const parsed = citationSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 3);
    }),
});

export const riskSeveritySchema = z.string().transform((val): RiskSeverity => {
  const lower = val.toLowerCase();
  if (lower === "high" || lower === "medium") return lower;
  return "low";
});

export const riskCategorySchema = z.string().transform((val): RiskCategory => {
  const lower = val.toLowerCase();
  if (
    lower === "error_handling" ||
    lower === "secrets" ||
    lower === "unaddressed_requirement" ||
    lower === "security"
  ) {
    return lower;
  }
  return "other";
});

export const riskEvidenceSchema = z
  .object({
    path: z.string().transform((p) => safeLine(p).trim()),
    startLine: z.number().nullable().optional().transform((v) => v ?? null),
    endLine: z.number().nullable().optional().transform((v) => v ?? null),
  })
  .refine((item) => isSafePath(item.path), {
    message: "Unsafe risk evidence dropped",
  });

export const identifiedRiskSchema = z.object({
  id: z.string().min(1),
  severity: riskSeveritySchema,
  category: riskCategorySchema,
  text: sanitizeString(300),
  evidence: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof riskEvidenceSchema>[] = [];
      for (const item of items) {
        const parsed = riskEvidenceSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 3);
    }),
});

export const selfCheckReportSchema = z.object({
  reportId: z.string().min(1),
  generatedAt: z.string().min(1),
  repoCommitSha: z.string().default("HEAD"),
  criteria: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof criterionCheckSchema>[] = [];
      for (const item of items) {
        const parsed = criterionCheckSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 12);
    }),
  risks: z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => {
      const valid: z.infer<typeof identifiedRiskSchema>[] = [];
      for (const item of items) {
        const parsed = identifiedRiskSchema.safeParse(item);
        if (parsed.success) {
          valid.push(parsed.data);
        }
      }
      return valid.slice(0, 12);
    }),
});

export const draftSummarySchema = z.object({
  draftId: z.string().min(1),
  generatedAt: z.string().min(1),
  summary: z
    .string()
    .min(1, "Summary is required")
    .transform((val) => clampText(redactSecrets(safeLine(val)), 480)),
  filesModified: z
    .array(z.string().transform((p) => safeLine(p).trim()))
    .optional()
    .default([])
    .transform((items) => items.filter((p) => isSafePath(p)).slice(0, 20)),
  notes: z
    .string()
    .optional()
    .default("")
    .transform((val) => clampText(redactSecrets(safeLine(val)), 480)),
});

export const aiJobSchema = z.object({
  jobId: z.string().min(1),
  kind: z.string().transform((val): JobKind => (val === "draft_summary" ? "draft_summary" : "self_check")),
  status: z.string().transform((val): JobStatus => {
    const lower = val.toLowerCase();
    if (
      lower === "queued" ||
      lower === "running" ||
      lower === "completed" ||
      lower === "failed" ||
      lower === "cancelled"
    ) {
      return lower;
    }
    return "queued";
  }),
  error: z
    .object({
      code: z.string().default("UNKNOWN"),
      message: z.string().default(""),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  result: z.unknown().nullable().optional().transform((v) => v ?? null),
});
