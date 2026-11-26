import type { AskAnswer } from "./types";

export interface Turn {
  id: string;
  question: string;
  status: "pending" | "done" | "error";
  answer?: AskAnswer;
  error?: string;
  askedAt: string;
}

export type AskHistoryAction =
  | { type: "ADD_QUESTION"; id: string; question: string }
  | { type: "SET_ANSWER"; id: string; answer: AskAnswer }
  | { type: "SET_ERROR"; id: string; error: string }
  | { type: "SET_HISTORY"; history: Turn[] }
  | { type: "CLEAR" };

export const MAX_HISTORY_TURNS = 20;

export function getSessionStorageKey(taskId: string): string {
  return `cb-ai-ask-v1:${taskId}`;
}

export function loadAskHistory(taskId: string): Turn[] {
  if (typeof window === "undefined" || !window.sessionStorage || !taskId) {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(getSessionStorageKey(taskId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Turn =>
        item &&
        typeof item.id === "string" &&
        typeof item.question === "string" &&
        (item.status === "done" || item.status === "error")
    );
  } catch {
    return [];
  }
}

export function saveAskHistory(taskId: string, turns: Turn[]): void {
  if (typeof window === "undefined" || !window.sessionStorage || !taskId) {
    return;
  }
  try {
    // Only persist finished turns (done or error), never pending
    const finished = turns.filter(
      (t) => t.status === "done" || t.status === "error"
    );
    window.sessionStorage.setItem(
      getSessionStorageKey(taskId),
      JSON.stringify(finished.slice(-MAX_HISTORY_TURNS))
    );
  } catch {
    // ignore sessionStorage errors
  }
}

export function clearAskHistory(taskId: string): void {
  if (typeof window === "undefined" || !window.sessionStorage || !taskId) {
    return;
  }
  try {
    window.sessionStorage.removeItem(getSessionStorageKey(taskId));
  } catch {
    // ignore
  }
}

export function clearAllAskHistory(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith("cb-ai-ask-v1:")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function askHistoryReducer(state: Turn[], action: AskHistoryAction): Turn[] {
  switch (action.type) {
    case "ADD_QUESTION": {
      // Disallow multiple pending questions at once
      if (state.some((t) => t.status === "pending")) {
        return state;
      }
      const newTurn: Turn = {
        id: action.id,
        question: action.question,
        status: "pending",
        askedAt: new Date().toISOString(),
      };
      const updated = [...state, newTurn];
      // Cap at 20 turns by dropping the oldest finished turns
      if (updated.length > MAX_HISTORY_TURNS) {
        return updated.slice(updated.length - MAX_HISTORY_TURNS);
      }
      return updated;
    }

    case "SET_ANSWER": {
      return state.map((t) =>
        t.id === action.id
          ? {
              ...t,
              status: "done",
              answer: action.answer,
              error: undefined,
            }
          : t
      );
    }

    case "SET_ERROR": {
      return state.map((t) =>
        t.id === action.id
          ? {
              ...t,
              status: "error",
              error: action.error,
              answer: undefined,
            }
          : t
      );
    }

    case "SET_HISTORY": {
      return action.history.slice(-MAX_HISTORY_TURNS);
    }

    case "CLEAR": {
      return [];
    }

    default:
      return state;
  }
}
