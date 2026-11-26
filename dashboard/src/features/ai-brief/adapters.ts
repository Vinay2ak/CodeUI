import { aiBriefSchema, confirmedBriefSchema } from './schemas';
import type { AiDeveloperBrief, ConfirmedBrief } from './types';

function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/gi, ($1) =>
    $1.toUpperCase().replace('-', '').replace('_', '')
  );
}

export function keysToCamel<T = unknown>(obj: unknown): T {
  if (obj === null || typeof obj !== 'object') {
    return obj as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => keysToCamel(v)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = keysToCamel(value);
  }
  return result as T;
}

export function adaptAiBrief(raw: unknown): AiDeveloperBrief {
  const camelObj = keysToCamel(raw);
  return aiBriefSchema.parse(camelObj);
}

export function adaptConfirmedBrief(raw: unknown): ConfirmedBrief {
  const camelObj = keysToCamel(raw);
  return confirmedBriefSchema.parse(camelObj);
}
