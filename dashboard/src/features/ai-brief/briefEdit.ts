import type { AiDeveloperBrief, AcceptanceCriterion } from './types';
import { safeLine, redactSecrets, clampText } from '../../lib/safeText';

export function updateCriterion(
  brief: AiDeveloperBrief,
  id: string,
  text: string
): AiDeveloperBrief {
  const sanitized = clampText(redactSecrets(safeLine(text.trim())), 200);
  return {
    ...brief,
    acceptanceCriteria: brief.acceptanceCriteria.map((c) =>
      c.id === id ? { ...c, text: sanitized } : c
    ),
  };
}

export function removeCriterion(
  brief: AiDeveloperBrief,
  id: string
): AiDeveloperBrief {
  return {
    ...brief,
    acceptanceCriteria: brief.acceptanceCriteria.filter((c) => c.id !== id),
  };
}

export function addCriterion(
  brief: AiDeveloperBrief,
  text: string
): AiDeveloperBrief {
  if (brief.acceptanceCriteria.length >= 12) {
    return brief;
  }
  const sanitized = clampText(redactSecrets(safeLine(text.trim())), 200);
  const newCrit: AcceptanceCriterion = {
    id: `crit-owner-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    text: sanitized,
    required: true,
    source: 'owner',
  };
  return {
    ...brief,
    acceptanceCriteria: [...brief.acceptanceCriteria, newCrit],
  };
}

export function setRequired(
  brief: AiDeveloperBrief,
  id: string,
  required: boolean
): AiDeveloperBrief {
  return {
    ...brief,
    acceptanceCriteria: brief.acceptanceCriteria.map((c) =>
      c.id === id ? { ...c, required } : c
    ),
  };
}

export function removeStep(
  brief: AiDeveloperBrief,
  id: string
): AiDeveloperBrief {
  return {
    ...brief,
    stepByStepPlan: brief.stepByStepPlan.filter((s) => s.id !== id),
  };
}

export function removeFile(
  brief: AiDeveloperBrief,
  path: string
): AiDeveloperBrief {
  return {
    ...brief,
    suspectedFiles: brief.suspectedFiles.filter((f) => f.path !== path),
  };
}

export interface BriefValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBrief(
  brief: AiDeveloperBrief | null | undefined
): BriefValidationResult {
  const errors: string[] = [];

  if (!brief) {
    return { valid: false, errors: ['Brief is missing'] };
  }

  const criteria = brief.acceptanceCriteria || [];

  if (criteria.length === 0) {
    errors.push('At least one acceptance criterion is required.');
  }

  if (criteria.length > 12) {
    errors.push('Cannot have more than 12 acceptance criteria.');
  }

  const seen = new Set<string>();
  for (const c of criteria) {
    const trimmed = (c.text || '').trim();
    if (trimmed.length < 5) {
      errors.push(`Criterion "${trimmed}" must be at least 5 characters.`);
    } else if (trimmed.length > 200) {
      errors.push('Criterion exceeds maximum length of 200 characters.');
    }

    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) {
      errors.push(`Duplicate criterion found: "${trimmed}".`);
    } else {
      seen.add(lower);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
