import { AutomatedRun, CheckLogResponse } from './types';
import { automatedRunSchema } from '../../features/review/schemas';
import { safeLine, redactSecrets } from '../../lib/safeText';

export function adaptAutomatedRun(raw: any): AutomatedRun | null {
  if (!raw) return null;
  try {
    return automatedRunSchema.parse(raw);
  } catch (err) {
    console.warn('[Verification] Failed to parse automated run:', err);
    return null;
  }
}

export function adaptCheckLog(raw: any): CheckLogResponse {
  const rawLines = Array.isArray(raw?.lines) ? raw.lines : [];
  const lines = rawLines.map((line: any) => {
    const clean = safeLine(String(line));
    const redacted = redactSecrets(clean);
    return redacted.length > 400 ? redacted.slice(0, 400) : redacted;
  });

  return {
    lines,
    truncated: Boolean(raw?.truncated),
  };
}
