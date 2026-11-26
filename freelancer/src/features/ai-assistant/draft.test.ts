import { describe, it, expect } from "vitest";
import { applyDraft, clampToWord, fitDraft } from "./draft";

describe("draft / clampToWord", () => {
  it("preserves text within max", () => {
    expect(clampToWord("Hello world", 20)).toBe("Hello world");
  });

  it("avoids cutting a word in half when a space is reasonably close to max", () => {
    const text = "Fixed duplicate webhook retries and implemented exponential backoff algorithm";
    const clamped = clampToWord(text, 35);
    expect(clamped.length).toBeLessThanOrEqual(35);
    expect(clamped.endsWith(" ")).toBe(false);
    expect(clamped).toBe("Fixed duplicate webhook retries and");
  });

  it("clamps at max if no word boundary is found near limit", () => {
    const longWord = "a".repeat(50);
    expect(clampToWord(longWord, 30)).toBe("a".repeat(30));
  });
});

describe("draft / applyDraft", () => {
  it("inserts draft when existing text is empty", () => {
    const result = applyDraft("", "New draft text", "insert");
    expect(result).toBe("New draft text");
  });

  it("refuses to insert when existing text already has content", () => {
    const result = applyDraft("User notes", "New draft text", "insert");
    expect(result).toBe("User notes");
  });

  it("replaces existing text completely in replace mode", () => {
    const result = applyDraft("Old content", "Fresh draft", "replace");
    expect(result).toBe("Fresh draft");
  });

  it("appends with double newline in append mode", () => {
    const result = applyDraft("Original notes", "Appended draft", "append");
    expect(result).toBe("Original notes\n\nAppended draft");
  });

  it("strictly enforces max length limit on combined output", () => {
    const longExisting = "X".repeat(480);
    const result = applyDraft(longExisting, "Extra draft text", "append", 500);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

describe("draft / fitDraft", () => {
  it("clamps both summary and notes to max", () => {
    const fitted = fitDraft("A".repeat(600), "B".repeat(600), 100);
    expect(fitted.summary.length).toBeLessThanOrEqual(100);
    expect(fitted.notes.length).toBeLessThanOrEqual(100);
  });
});
