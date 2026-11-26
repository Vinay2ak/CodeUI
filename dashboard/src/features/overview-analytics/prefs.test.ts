import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAnalyticsPrefs,
  saveAnalyticsPrefs,
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
} from './prefs';

describe('prefs logic', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('1. returns DEFAULT_PREFS (24h) when sessionStorage is empty', () => {
    expect(loadAnalyticsPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('2. persists and retrieves valid range values (7d, 30d)', () => {
    saveAnalyticsPrefs({ range: '7d' });
    expect(loadAnalyticsPrefs()).toEqual({ range: '7d' });

    saveAnalyticsPrefs({ range: '30d' });
    expect(loadAnalyticsPrefs()).toEqual({ range: '30d' });
  });

  it('3. falls back to default 24h when stored JSON has an invalid range', () => {
    sessionStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ range: 'invalid-range' }));
    expect(loadAnalyticsPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('4. handles malformed JSON without crashing', () => {
    sessionStorage.setItem(PREFS_STORAGE_KEY, '{malformed json');
    expect(loadAnalyticsPrefs()).toEqual(DEFAULT_PREFS);
  });
});
