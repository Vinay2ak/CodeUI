import type { Citation } from "./types";

export function normalizePath(path: string): string {
  if (!path) return "";
  let p = path.replace(/\\/g, "/");
  if (p.startsWith("./")) {
    p = p.slice(2);
  }
  return p;
}

export interface ValidatedCitation extends Citation {
  inWorkspace: boolean;
}

export function validateCitations(
  treePaths: Set<string>,
  citations: Citation[]
): ValidatedCitation[] {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => {
    const normalized = normalizePath(citation.path);
    const inWorkspace = treePaths.has(normalized);
    return {
      ...citation,
      path: normalized,
      inWorkspace,
    };
  });
}

export function formatRange(start: number | null, end: number | null): string {
  if (start !== null && end !== null) {
    if (start === end) return `${start}`;
    return `${start}-${end}`;
  }
  if (start !== null) return `${start}`;
  if (end !== null) return `${end}`;
  return "";
}
