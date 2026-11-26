const ANSI_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// Strip control characters except newline (\n, 0x0A) and tab (\t, 0x09)
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B-\x1F\x7F-\x9F]/g;

export function safeLine(text: string): string {
  if (!text) return "";
  return text.replace(ANSI_REGEX, "").replace(CONTROL_CHARS_REGEX, "");
}

export function clampText(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function isSafePath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (path.length > 300) return false;
  // Printable ASCII only (0x20 to 0x7E)
  if (!/^[\x20-\x7E]+$/.test(path)) return false;
  // No backslash
  if (path.includes("\\")) return false;
  // No leading slash
  if (path.startsWith("/")) return false;
  // No path traversal segments ".."
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "..") return false;
  }
  return true;
}

export function redactSecrets(text: string): string {
  if (!text) return "";

  let result = text;

  // 1. Private key blocks
  result = result.replace(
    /-----BEGIN [A-Z0-9\s_-]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9\s_-]*PRIVATE KEY-----/g,
    "[redacted]"
  );

  // 2. URLs with embedded credentials (e.g. https://user:pass@example.com)
  result = result.replace(
    /(https?:\/\/)[^\/\s:@]+:[^\/\s:@]+@/gi,
    "$1[redacted]@"
  );

  // 3. GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_ + >=30 chars, and github_pat_...)
  result = result.replace(/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, "[redacted]");
  result = result.replace(/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, "[redacted]");

  // 4. AWS access key ids: AKIA + 16 chars
  result = result.replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]");

  // 5. OpenAI / typical "sk-" keys (sk- + >=20 chars)
  result = result.replace(/\bsk-[a-zA-Z0-9_-]{20,}\b/g, "[redacted]");

  // 6. JWTs: three base64url parts starting with eyJ
  result = result.replace(
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    "[redacted]"
  );

  // 7. "Bearer " + 20 or more characters
  result = result.replace(/\bBearer\s+[a-zA-Z0-9_.\-~+/=]{20,}\b/g, "[redacted]");

  // 8. Key-value pairs where key contains password, secret, token, or api_key (values >= 8 chars)
  // handles: key=val, key: val, "key": "val", 'key': 'val'
  result = result.replace(
    /((?:["']?[\w.-]*(?:password|secret|token|api_key)[\w.-]*["']?\s*[:=]\s*["']?))([^"'\s&,;]{8,})(["']?)/gi,
    "$1[redacted]$3"
  );

  return result;
}
