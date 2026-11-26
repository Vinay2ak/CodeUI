export function clampToWord(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;

  // If the character right after max is a space, slice(0, max) ends cleanly on a word boundary
  if (text[max] === " ") {
    return text.slice(0, max).trimEnd();
  }

  // Try to find the last whitespace before or at max to avoid splitting a word
  const sliced = text.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > Math.floor(max * 0.8)) {
    return sliced.slice(0, lastSpace).trimEnd();
  }
  return sliced;
}

export function applyDraft(
  existing: string,
  draft: string,
  mode: "insert" | "replace" | "append",
  max = 500
): string {
  const cleanExisting = existing || "";
  const cleanDraft = draft ? draft.trim() : "";

  if (!cleanDraft) {
    return clampToWord(cleanExisting, max);
  }

  let combined = "";

  if (mode === "insert") {
    // insert only when existing is empty
    if (cleanExisting.trim().length === 0) {
      combined = cleanDraft;
    } else {
      combined = cleanExisting;
    }
  } else if (mode === "replace") {
    combined = cleanDraft;
  } else if (mode === "append") {
    if (cleanExisting.trim().length === 0) {
      combined = cleanDraft;
    } else {
      combined = `${cleanExisting.trim()}\n\n${cleanDraft}`;
    }
  }

  return clampToWord(combined, max);
}

export function fitDraft(
  summary: string,
  notes: string,
  max: number
): { summary: string; notes: string } {
  return {
    summary: clampToWord(summary || "", max),
    notes: clampToWord(notes || "", max),
  };
}
