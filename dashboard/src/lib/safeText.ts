/**
 * Untrusted text sanitization and secret masking utilities.
 * All untrusted input from AI and GitHub is rendered as plain text only.
 */

export function redactSecrets(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. Private key blocks (entire block replaced with [redacted])
  result = result.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted]');

  // 2. GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_ + 30+ chars, github_pat_ + 30+ chars)
  result = result.replace(/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, '[redacted]');
  result = result.replace(/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g, '[redacted]');

  // 3. AWS access key IDs (AKIA + 16 chars)
  result = result.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted]');

  // 4. "sk-" style keys (sk- + 20+ chars)
  result = result.replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[redacted]');

  // 5. JWT tokens (three base64url segments starting with eyJ)
  result = result.replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]');

  // 6. Bearer tokens (Bearer <20+ characters>)
  result = result.replace(/\bBearer\s+[A-Za-z0-9_\-.]{20,}\b/g, '[redacted]');

  // 7. URLs with credentials: user:pass@ -> [redacted]@
  result = result.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:@\s/]+:[^@\s/]+)@/g, '$1[redacted]@');
  result = result.replace(/(^|[\s"'])([^:@\s/]+:[^@\s/]+)@/g, '$1[redacted]@');

  // 8. Key-value pairs matching password, secret, token, api_key (mask values with length >= 8)
  result = result.replace(
    /(["']?(?:[a-zA-Z0-9_-]*(?:password|secret|token|api_key)[a-zA-Z0-9_-]*)["']?\s*[:=]\s*["']?)([^"'\s,;]+)(["']?)/gi,
    (match, prefix, val, suffix) => {
      // If already redacted or val length < 8, keep as is
      if (val === '[redacted]' || val.length < 8) {
        return match;
      }
      return `${prefix}[redacted]${suffix}`;
    }
  );

  return result;
}

/**
 * Strips control characters from text except \n and \t.
 */
export function safeLine(text: string): string {
  if (!text) return text;
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Clamps text to max length and appends ellipsis '…' if truncated.
 */
export function clampText(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

/**
 * Validates whether a file path is safe for plain-text display:
 * - printable characters up to 300 characters
 * - no '..' segments
 * - no leading '/'
 * - no backslashes
 */
export function isSafePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (path.length > 300) return false;
  // Disallow backslashes
  if (path.includes('\\')) return false;
  // Disallow leading slash
  if (path.startsWith('/')) return false;
  // Disallow '..' segments
  if (path.includes('..')) return false;
  // Disallow control characters
  if (/[\x00-\x1F\x7F]/.test(path)) return false;
  return true;
}
