import { describe, it, expect } from 'vitest';
import { formatExit, formatDuration, shortSha, formatInr } from './format';

describe('format utilities', () => {
  it('1. formats exit for passed check', () => {
    expect(formatExit({ status: 'passed', exitCode: 0 })).toBe('PASS · exit 0');
  });

  it('2. formats exit for failed check', () => {
    expect(formatExit({ status: 'failed', exitCode: 1 })).toBe('FAIL · exit 1');
    expect(formatExit({ status: 'failed', exitCode: 137 })).toBe('FAIL · exit 137');
  });

  it('3. formats timed out, skipped, and error check states', () => {
    expect(formatExit({ status: 'timed_out', exitCode: null })).toBe('Timed out');
    expect(formatExit({ status: 'skipped', exitCode: null })).toBe('Skipped');
    expect(formatExit({ status: 'error', exitCode: null })).toBe('Error');
  });

  it('4. formats duration in ms, seconds and minutes', () => {
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(1200)).toBe('1.2s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('5. shortens commit SHA to 7 characters', () => {
    expect(shortSha('e316aae746098bc129038234')).toBe('e316aae');
    expect(shortSha('')).toBe('');
    expect(shortSha('abc')).toBe('abc');
  });

  it('6. formats INR currency using tabular currency symbol', () => {
    expect(formatInr(4500)).toContain('4,500');
    expect(formatInr(100000)).toContain('1,00,000');
  });
});
