import { describe, it, expect } from "vitest";
import { normalizePath, validateCitations, formatRange } from "./citations";

describe("citations / normalizePath", () => {
  it("strips leading ./ from path", () => {
    expect(normalizePath("./app/webhooks.py")).toBe("app/webhooks.py");
  });

  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("app\\services\\retry.py")).toBe("app/services/retry.py");
  });

  it("handles empty or clean paths", () => {
    expect(normalizePath("")).toBe("");
    expect(normalizePath("README.md")).toBe("README.md");
  });
});

describe("citations / formatRange", () => {
  it("formats range with distinct start and end", () => {
    expect(formatRange(34, 71)).toBe("34-71");
  });

  it("formats single line range when start equals end", () => {
    expect(formatRange(42, 42)).toBe("42");
  });

  it("formats single boundary when only start or end is provided", () => {
    expect(formatRange(10, null)).toBe("10");
    expect(formatRange(null, 25)).toBe("25");
  });

  it("returns empty string when both are null", () => {
    expect(formatRange(null, null)).toBe("");
  });
});

describe("citations / validateCitations", () => {
  const tree = new Set(["app/webhooks.py", "app/retry.py", "README.md"]);

  it("marks citations in workspace as true", () => {
    const citations = [
      { path: "./app/webhooks.py", startLine: 1, endLine: 10, snippet: null },
    ];
    const validated = validateCitations(tree, citations);
    expect(validated[0].inWorkspace).toBe(true);
    expect(validated[0].path).toBe("app/webhooks.py");
  });

  it("marks citations not in workspace as false", () => {
    const citations = [
      { path: "app/unknown.py", startLine: 1, endLine: 10, snippet: null },
      { path: "etc/passwd", startLine: null, endLine: null, snippet: null },
    ];
    const validated = validateCitations(tree, citations);
    expect(validated[0].inWorkspace).toBe(false);
    expect(validated[1].inWorkspace).toBe(false);
  });
});
