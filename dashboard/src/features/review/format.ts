import { DockerTestResult } from './types';

/**
 * Formats exit code & status of a test check.
 * e.g., "PASS · exit 0", "FAIL · exit 1", "Timed out", "Skipped", "Error"
 */
export function formatExit(check: {
  status: DockerTestResult['status'];
  exitCode: number | null;
}): string {
  switch (check.status) {
    case 'passed':
      return `PASS · exit ${check.exitCode ?? 0}`;
    case 'failed':
      return `FAIL · exit ${check.exitCode ?? 1}`;
    case 'timed_out':
      return 'Timed out';
    case 'skipped':
      return 'Skipped';
    case 'error':
      return 'Error';
    default:
      return String(check.status);
  }
}

/**
 * Formats milliseconds into human-readable duration string.
 * e.g. 450 -> "450ms", 1250 -> "1.3s", 65000 -> "1m 5s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Shortens a commit SHA to 7 characters.
 */
export function shortSha(sha: string): string {
  if (!sha) return '';
  return sha.slice(0, 7);
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Formats currency amount in Indian Rupee (INR).
 */
export function formatInr(amount: number): string {
  return inrFormatter.format(amount);
}
