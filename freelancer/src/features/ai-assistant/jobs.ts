export const MAX_JOB_POLLS = 60;

export function nextJobDelay(attempt: number): number {
  if (attempt <= 0) return 800;
  if (attempt === 1) return 1000;
  if (attempt === 2) return 1500;
  return 2000;
}
