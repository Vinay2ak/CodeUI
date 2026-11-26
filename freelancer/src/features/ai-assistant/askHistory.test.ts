import { describe, it, expect, beforeEach } from "vitest";
import {
  askHistoryReducer,
  loadAskHistory,
  saveAskHistory,
  clearAskHistory,
  clearAllAskHistory,
  Turn,
} from "./askHistory";

describe("askHistory reducer & persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("adds a pending question to empty history", () => {
    const state = askHistoryReducer([], {
      type: "ADD_QUESTION",
      id: "q1",
      question: "Where is the webhook handled?",
    });
    expect(state).toHaveLength(1);
    expect(state[0].status).toBe("pending");
    expect(state[0].question).toBe("Where is the webhook handled?");
  });

  it("prevents adding a new question when one is already pending", () => {
    const initial: Turn[] = [
      { id: "q1", question: "First?", status: "pending", askedAt: "2026-01-01" },
    ];
    const state = askHistoryReducer(initial, {
      type: "ADD_QUESTION",
      id: "q2",
      question: "Second?",
    });
    expect(state).toHaveLength(1);
    expect(state[0].id).toBe("q1");
  });

  it("updates pending question with answer on SET_ANSWER", () => {
    const initial: Turn[] = [
      { id: "q1", question: "First?", status: "pending", askedAt: "2026-01-01" },
    ];
    const answer = {
      answerId: "a1",
      generatedAt: "2026-01-01",
      repoCommitSha: "abc",
      grounding: "grounded" as const,
      answer: "In webhooks.py",
      citations: [],
      remaining: 10,
    };
    const state = askHistoryReducer(initial, {
      type: "SET_ANSWER",
      id: "q1",
      answer,
    });
    expect(state[0].status).toBe("done");
    expect(state[0].answer?.answer).toBe("In webhooks.py");
  });

  it("updates pending question with error on SET_ERROR", () => {
    const initial: Turn[] = [
      { id: "q1", question: "First?", status: "pending", askedAt: "2026-01-01" },
    ];
    const state = askHistoryReducer(initial, {
      type: "SET_ERROR",
      id: "q1",
      error: "Service unavailable",
    });
    expect(state[0].status).toBe("error");
    expect(state[0].error).toBe("Service unavailable");
  });

  it("enforces cap of 20 turns", () => {
    let state: Turn[] = [];
    for (let i = 0; i < 25; i++) {
      state = askHistoryReducer(state, {
        type: "ADD_QUESTION",
        id: `q${i}`,
        question: `Question ${i}`,
      });
      state = askHistoryReducer(state, {
        type: "SET_ANSWER",
        id: `q${i}`,
        answer: {
          answerId: `a${i}`,
          generatedAt: "2026-01-01",
          repoCommitSha: "abc",
          grounding: "grounded",
          answer: `Ans ${i}`,
          citations: [],
          remaining: 10,
        },
      });
    }
    expect(state.length).toBe(20);
    expect(state[0].id).toBe("q5");
  });

  it("persists only finished turns into sessionStorage and restores them", () => {
    const turns: Turn[] = [
      { id: "q1", question: "Done turn", status: "done", askedAt: "2026-01-01" },
      { id: "q2", question: "Pending turn", status: "pending", askedAt: "2026-01-01" },
    ];
    saveAskHistory("task-123", turns);

    const loaded = loadAskHistory("task-123");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("q1");
    expect(loaded[0].question).toBe("Done turn");
  });

  it("clears task history and handles clearAllAskHistory on logout", () => {
    saveAskHistory("t1", [{ id: "q1", question: "Q1", status: "done", askedAt: "now" }]);
    saveAskHistory("t2", [{ id: "q2", question: "Q2", status: "done", askedAt: "now" }]);

    clearAskHistory("t1");
    expect(loadAskHistory("t1")).toHaveLength(0);
    expect(loadAskHistory("t2")).toHaveLength(1);

    clearAllAskHistory();
    expect(loadAskHistory("t2")).toHaveLength(0);
  });
});
