import { describe, it, expect } from "vitest";
import { buildDraft } from "./draft";
import { T1_INITIAL_REPO, REFERENCE_FIX } from "./repo";

describe("buildDraft", () => {
  it("1. no changed files returns initial message", () => {
    const draft = buildDraft([]);
    expect(draft.summary).toBe("No workspace file modifications detected.");
    expect(draft.filesModified).toEqual([]);
  });

  it("2. changes in app/webhooks.py detected and reflected in summary", () => {
    const files = {
      "app/webhooks.py": {
        path: "app/webhooks.py",
        language: "python",
        content: REFERENCE_FIX["app/webhooks.py"],
      },
    };
    const draft = buildDraft(["app/webhooks.py"], {}, files);
    expect(draft.summary).toContain("app/webhooks.py: added event de-duplication and returns 400 for an invalid signature.");
    expect(draft.filesModified).toEqual(["app/webhooks.py"]);
  });

  it("3. changes in app/retry.py detected and reflected in summary", () => {
    const files = {
      "app/retry.py": {
        path: "app/retry.py",
        language: "python",
        content: REFERENCE_FIX["app/retry.py"],
      },
    };
    const draft = buildDraft(["app/retry.py"], {}, files);
    expect(draft.summary).toContain("app/retry.py: implemented exponential backoff schedule with maximum retry limit.");
    expect(draft.filesModified).toEqual(["app/retry.py"]);
  });

  it("4. all files modified list matches input changedFiles up to limit", () => {
    const changed = ["app/webhooks.py", "app/retry.py", "README.md"];
    const draft = buildDraft(changed, {}, T1_INITIAL_REPO);
    expect(draft.filesModified).toEqual(changed);
  });

  it("5. passing required criteria reflected in notes count", () => {
    const criteriaStatuses = {
      C1: "met",
      C2: "met",
      C3: "met",
      C4: "met",
    };
    const draft = buildDraft(["app/webhooks.py"], criteriaStatuses);
    expect(draft.notes).toContain("All 4 required tests are passing");

    const partialStatuses = {
      C1: "met",
      C2: "not_met",
    };
    const partialDraft = buildDraft(["app/webhooks.py"], partialStatuses);
    expect(partialDraft.notes).toContain("1/4 required criteria passing");
  });

  it("6. clamping ensures summary and notes do not exceed 480 chars", () => {
    const hugeChanged = Array.from({ length: 30 }, (_, i) => `file_${i}.txt`);
    const draft = buildDraft(hugeChanged);
    expect(draft.summary.length).toBeLessThanOrEqual(480);
    expect(draft.notes.length).toBeLessThanOrEqual(480);
    expect(draft.filesModified.length).toBeLessThanOrEqual(20);
  });
});
