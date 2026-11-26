import { describe, it, expect } from 'vitest';
import { isOn, FEATURES } from './features';

describe('features: isOn', () => {
  it('returns true when raw is "true" or boolean true', () => {
    expect(isOn('true', false)).toBe(true);
    expect(isOn('true', true)).toBe(true);
    expect(isOn(true, false)).toBe(true);
  });

  it('returns false when raw is "false" or boolean false', () => {
    expect(isOn('false', true)).toBe(false);
    expect(isOn('false', false)).toBe(false);
    expect(isOn(false, true)).toBe(false);
  });

  it('falls back to mocksOn when raw is unset or empty', () => {
    expect(isOn(undefined, true)).toBe(true);
    expect(isOn(undefined, false)).toBe(false);
    expect(isOn('', true)).toBe(true);
    expect(isOn('', false)).toBe(false);
  });

  it('evaluates FEATURES getter dynamically without throwing', () => {
    expect(typeof FEATURES.AI_BRIEF).toBe('boolean');
    expect(typeof FEATURES.DRAFT_PUBLISH).toBe('boolean');
  });

  it('handles irregular truthy/falsy strings as fallback to mocksOn', () => {
    expect(isOn('1', false)).toBe(false);
    expect(isOn('yes', true)).toBe(true);
  });
});
