import { describe, it, expect } from 'vitest';
import { redactSecrets, safeLine, clampText, isSafePath } from './safeText';

describe('safeText: redactSecrets', () => {
  it('leaves a normal log line unchanged', () => {
    const normal = 'Payment webhook received for order 12345 at 2026-03-12T10:00:00Z';
    expect(redactSecrets(normal)).toBe(normal);
  });

  it('redacts GitHub personal access tokens (ghp_)', () => {
    const raw = 'Found token ghp_12345678901234567890123456789012 in repo config';
    expect(redactSecrets(raw)).toBe('Found token [redacted] in repo config');
  });

  it('redacts fine-grained GitHub PATs (github_pat_)', () => {
    const raw = 'Auth github_pat_11ABCD_123456789012345678901234567890';
    expect(redactSecrets(raw)).toBe('Auth [redacted]');
  });

  it('redacts AWS Access Key IDs (AKIA)', () => {
    const raw = 'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    expect(redactSecrets(raw)).toContain('[redacted]');
  });

  it('redacts sk- style API keys', () => {
    const raw = 'sk-proj12345678901234567890abcdef is active';
    expect(redactSecrets(raw)).toBe('[redacted] is active');
  });

  it('redacts JWT tokens with three base64 parts', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(redactSecrets(`Token: ${jwt}`)).toBe('Token: [redacted]');
  });

  it('redacts Bearer tokens with 20+ chars', () => {
    const raw = 'Authorization: Bearer mySecretTokenLongerThanTwentyChars1234';
    expect(redactSecrets(raw)).toBe('Authorization: [redacted]');
  });

  it('redacts private key blocks', () => {
    const raw = `Key data:
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y...
-----END RSA PRIVATE KEY-----
done.`;
    expect(redactSecrets(raw)).toBe(`Key data:
[redacted]
done.`);
  });

  it('redacts credentials inside URLs', () => {
    const raw = 'git clone https://john:supersecretpass123@github.com/org/repo.git';
    expect(redactSecrets(raw)).toBe('git clone https://[redacted]@github.com/org/repo.git');
  });

  it('redacts values in key=value pairs matching password or api_key (>=8 chars)', () => {
    const raw1 = 'db_password=mySuperSecret99;';
    expect(redactSecrets(raw1)).toBe('db_password=[redacted];');

    const raw2 = '{"api_key": "mySecretKey1234"}';
    expect(redactSecrets(raw2)).toBe('{"api_key": "[redacted]"}');

    // short value (< 8 chars) is kept
    const shortVal = 'password=short';
    expect(redactSecrets(shortVal)).toBe('password=short');
  });
});

describe('safeText: safeLine', () => {
  it('strips null bytes, bell, escape characters but keeps \\n and \\t', () => {
    const input = 'Line 1\x00\x07\x1b[31m\nLine 2\tTabbed\x1F';
    const output = safeLine(input);
    expect(output).toBe('Line 1[31m\nLine 2\tTabbed');
  });
});

describe('safeText: clampText', () => {
  it('does not truncate text within max limit', () => {
    expect(clampText('hello world', 20)).toBe('hello world');
  });

  it('truncates text exceeding max limit and appends …', () => {
    expect(clampText('hello world', 5)).toBe('hello…');
  });
});

describe('safeText: isSafePath', () => {
  it('accepts valid relative paths', () => {
    expect(isSafePath('src/features/auth.ts')).toBe(true);
    expect(isSafePath('app/webhooks.py')).toBe(true);
    expect(isSafePath('.github/workflows/ci.yml')).toBe(true);
  });

  it('rejects paths with backslashes', () => {
    expect(isSafePath('src\\features\\auth.ts')).toBe(false);
  });

  it('rejects paths with leading slash', () => {
    expect(isSafePath('/etc/passwd')).toBe(false);
  });

  it('rejects paths with .. traversal', () => {
    expect(isSafePath('../secret.ts')).toBe(false);
    expect(isSafePath('src/../secret.ts')).toBe(false);
  });

  it('rejects paths longer than 300 chars or containing control chars', () => {
    expect(isSafePath('a'.repeat(301))).toBe(false);
    expect(isSafePath('path/with\x00null')).toBe(false);
    expect(isSafePath('')).toBe(false);
  });
});
