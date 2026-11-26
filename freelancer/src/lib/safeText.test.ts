import { describe, it, expect } from "vitest";
import { redactSecrets, safeLine, clampText, isSafePath } from "./safeText";

describe("safeText / safeLine", () => {
  it("leaves a normal log line unchanged", () => {
    const line = "2026-11-22 10:15:30 [INFO] app.main: Server started on port 8000";
    expect(safeLine(line)).toBe(line);
  });

  it("strips ANSI terminal color escapes", () => {
    const ansi = "\u001b[32mPASS\u001b[0m tests/test_webhooks.py";
    expect(safeLine(ansi)).toBe("PASS tests/test_webhooks.py");
  });

  it("strips control characters while preserving newlines and tabs", () => {
    const raw = "Line 1\x00\x07\n\tLine 2\x1B\x03";
    expect(safeLine(raw)).toBe("Line 1\n\tLine 2");
  });
});

describe("safeText / clampText", () => {
  it("preserves text within limit", () => {
    expect(clampText("hello", 10)).toBe("hello");
  });

  it("clamps text exceeding limit", () => {
    expect(clampText("hello world", 5)).toBe("hello");
  });
});

describe("safeText / isSafePath", () => {
  it("accepts valid relative workspace paths", () => {
    expect(isSafePath("app/webhooks.py")).toBe(true);
    expect(isSafePath("tests/unit/test_retry.py")).toBe(true);
    expect(isSafePath("README.md")).toBe(true);
  });

  it("rejects leading slashes (absolute paths)", () => {
    expect(isSafePath("/etc/passwd")).toBe(false);
  });

  it("rejects path traversal segments", () => {
    expect(isSafePath("../secret.txt")).toBe(false);
    expect(isSafePath("app/../../etc/shadow")).toBe(false);
  });

  it("rejects backslashes", () => {
    expect(isSafePath("app\\webhooks.py")).toBe(false);
  });

  it("rejects non-printable characters or excessive length", () => {
    expect(isSafePath("app/web\nhooks.py")).toBe(false);
    expect(isSafePath("a".repeat(301))).toBe(false);
  });
});

describe("safeText / redactSecrets", () => {
  it("redacts GitHub personal access tokens", () => {
    const ghp = "Token: ghp_123456789012345678901234567890123456";
    expect(redactSecrets(ghp)).toBe("Token: [redacted]");

    const pat = "Fine-grained: github_pat_11AABBCCDDEEFFGGHHIIJJ_1234567890abcdef";
    expect(redactSecrets(pat)).toBe("Fine-grained: [redacted]");
  });

  it("redacts AWS access key IDs", () => {
    const aws = "Credentials AWS AKIAIOSFODNN7EXAMPLE used";
    expect(redactSecrets(aws)).toBe("Credentials AWS [redacted] used");
  });

  it("redacts sk- API keys", () => {
    const key = "sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz";
    expect(redactSecrets(`Key is ${key}`)).toBe("Key is [redacted]");
  });

  it("redacts JWT tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactSecrets(`JWT: ${jwt}`)).toBe("JWT: [redacted]");
  });

  it("redacts Bearer authorization headers", () => {
    const bearer = "Authorization: Bearer 1234567890abcdef1234567890";
    expect(redactSecrets(bearer)).toBe("Authorization: [redacted]");
  });

  it("redacts RSA private key blocks", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----";
    expect(redactSecrets(`Here is the key: ${key}`)).toBe("Here is the key: [redacted]");
  });

  it("redacts credentials inside URLs", () => {
    const url = "Connecting to https://admin:superSecret123@db.example.com/data";
    expect(redactSecrets(url)).toBe("Connecting to https://[redacted]@db.example.com/data");
  });

  it("redacts key=value and JSON pairs for password, secret, token, api_key", () => {
    expect(redactSecrets('password="mySecretPassword123"')).toBe('password="[redacted]"');
    expect(redactSecrets('api_key: superSecretApiKeyVal')).toBe('api_key: [redacted]');
    expect(redactSecrets('auth_token=longsecretstringhere')).toBe('auth_token=[redacted]');
  });
});
