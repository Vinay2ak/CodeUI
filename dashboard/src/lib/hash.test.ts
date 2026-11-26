import { describe, it, expect } from 'vitest';
import { fnv1a, hashInputs } from './hash';

describe('hash: fnv1a', () => {
  it('computes consistent 8-character hex hash for strings', () => {
    const hash1 = fnv1a('hello world');
    const hash2 = fnv1a('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces different hashes for different strings', () => {
    expect(fnv1a('string-a')).not.toBe(fnv1a('string-b'));
  });
});

describe('hash: hashInputs', () => {
  it('is key-order independent for objects', () => {
    const objA = { title: 'Fix bug', description: 'Urgent issue', stacks: ['python'] };
    const objB = { stacks: ['python'], description: 'Urgent issue', title: 'Fix bug' };
    expect(hashInputs(objA)).toBe(hashInputs(objB));
  });

  it('detects property changes in nested objects and arrays', () => {
    const orig = { title: 'Fix bug', stacks: ['python'] };
    const changed = { title: 'Fix bug (updated)', stacks: ['python'] };
    expect(hashInputs(orig)).not.toBe(hashInputs(changed));
  });
});
