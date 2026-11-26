export function clearAllAiCaches(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key?.startsWith("cb_ai_selfcheck_") ||
        key?.startsWith("cb_ai_draft_") ||
        key?.startsWith("cb_ai_explain_")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignored
  }
}
