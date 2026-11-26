export function parseRetryAfter(
  headerValue: string | null | undefined
): number {
  if (!headerValue || typeof headerValue !== "string") {
    return 0;
  }
  const trimmed = headerValue.trim();
  if (!trimmed) return 0;

  // Try parsing as integer seconds
  const numeric = parseInt(trimmed, 10);
  if (!isNaN(numeric) && /^\d+$/.test(trimmed)) {
    return Math.min(3600, Math.max(0, numeric));
  }

  // Try parsing as HTTP date
  const dateMs = Date.parse(trimmed);
  if (!isNaN(dateMs)) {
    const diffSec = Math.ceil((dateMs - Date.now()) / 1000);
    return Math.min(3600, Math.max(0, diffSec));
  }

  return 0;
}
