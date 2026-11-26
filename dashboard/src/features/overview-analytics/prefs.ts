import type { TimeRange } from './grafanaUrl';

export interface AnalyticsPrefs {
  range: TimeRange;
}

export const PREFS_STORAGE_KEY = 'cb-analytics-prefs-v1';

export const DEFAULT_PREFS: AnalyticsPrefs = {
  range: '24h',
};

const VALID_RANGES: readonly TimeRange[] = ['24h', '7d', '30d'] as const;

/**
 * Loads analytics user preferences from storage with graceful fallback to defaults.
 */
export function loadAnalyticsPrefs(storage: Storage = sessionStorage): AnalyticsPrefs {
  try {
    const raw = storage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;

    const parsed = JSON.parse(raw);
    const range = VALID_RANGES.includes(parsed?.range) ? parsed.range : DEFAULT_PREFS.range;

    return { range };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Persists analytics user preferences to storage.
 */
export function saveAnalyticsPrefs(
  prefs: AnalyticsPrefs,
  storage: Storage = sessionStorage
): void {
  try {
    const range = VALID_RANGES.includes(prefs?.range) ? prefs.range : DEFAULT_PREFS.range;
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ range }));
  } catch {
    // Storage access may fail in private browsing mode or sandboxed environments
  }
}
