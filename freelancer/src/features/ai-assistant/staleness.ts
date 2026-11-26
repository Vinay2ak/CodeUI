export function isStale(
  generatedAtIso: string,
  lastSavedAtMs: number | null
): boolean {
  if (lastSavedAtMs === null || lastSavedAtMs === undefined) {
    return false;
  }
  const genTime = new Date(generatedAtIso).getTime();
  if (isNaN(genTime)) {
    return false;
  }
  return lastSavedAtMs > genTime;
}
