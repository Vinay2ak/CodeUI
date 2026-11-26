import { PostProjectFormData } from './schema';
import type { AiDeveloperBrief, RepoInfo, ProjectSnapshot } from '../ai-brief/types';

const DRAFT_KEY = 'cb-post-project-draft-v1';

export interface PostProjectDraftData extends Partial<PostProjectFormData> {
  aiBrief?: AiDeveloperBrief | null;
  analyzedHash?: string | null;
  projectId?: string | null;
  repo?: RepoInfo | null;
  snapshot?: ProjectSnapshot | null;
}

export function saveDraft(values: PostProjectDraftData): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {
    // ignore sessionStorage errors
  }
}

export function loadDraft(): PostProjectDraftData | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
