import { describe, it, expect } from "vitest";
import { buildSelfCheck, scanRisks } from "./selfCheck";
import { T1_INITIAL_REPO, REFERENCE_FIX } from "./repo";
import { TEST_RULES } from "./rules";
import { MOCK_TASKS } from "./tasks";

describe("buildSelfCheck and scanRisks", () => {
  const criteria = MOCK_TASKS.t1.criteria;

  it("1. untouched snapshot gives not_met for required webhook criteria C1 and C3", () => {
    const report = buildSelfCheck(T1_INITIAL_REPO, criteria, TEST_RULES);
    const c1 = report.criteria.find((c) => c.criterionId === "C1");
    const c3 = report.criteria.find((c) => c.criterionId === "C3");
    expect(c1?.status).toBe("not_met");
    expect(c3?.status).toBe("not_met");
  });

  it("2. untouched snapshot gives not_met for retry criterion C2", () => {
    const report = buildSelfCheck(T1_INITIAL_REPO, criteria, TEST_RULES);
    const c2 = report.criteria.find((c) => c.criterionId === "C2");
    expect(c2?.status).toBe("not_met");
  });

  it("3. untouched snapshot gives met for C4 (state machine already working)", () => {
    const report = buildSelfCheck(T1_INITIAL_REPO, criteria, TEST_RULES);
    const c4 = report.criteria.find((c) => c.criterionId === "C4");
    expect(c4?.status).toBe("met");
  });

  it("4. untouched snapshot gives not_met for optional C5 README criterion", () => {
    const report = buildSelfCheck(T1_INITIAL_REPO, criteria, TEST_RULES);
    const c5 = report.criteria.find((c) => c.criterionId === "C5");
    expect(c5?.status).toBe("not_met");
  });

  it("5. REFERENCE_FIX gives met for all criteria", () => {
    const fixedRepo = { ...T1_INITIAL_REPO };
    for (const [path, content] of Object.entries(REFERENCE_FIX)) {
      fixedRepo[path] = {
        path,
        language: path.endsWith(".py") ? "python" : "markdown",
        content,
      };
    }
    const report = buildSelfCheck(fixedRepo, criteria, TEST_RULES);
    for (const c of report.criteria) {
      expect(c.status).toBe("met");
    }
  });

  it("6. partial fix gives partial status for criterion with multiple test rules", () => {
    const partialRepo = { ...T1_INITIAL_REPO };
    // Fix only backoff calculation in retry.py, but not MAX_ATTEMPTS
    partialRepo["app/retry.py"] = {
      path: "app/retry.py",
      language: "python",
      content: `def calculate_retry_delay(attempt: int) -> int:\n    return 2 ** attempt\n`,
    };
    const report = buildSelfCheck(partialRepo, criteria, TEST_RULES);
    const c2 = report.criteria.find((c) => c.criterionId === "C2");
    expect(c2?.status).toBe("partial");
  });

  it("7. pasted fake key gives secrets risk without exposing value in text or evidence", () => {
    const repoWithSecret = { ...T1_INITIAL_REPO };
    const fakeKey = "sk-test-1234567890abcdefghijklmnop";
    repoWithSecret["app/webhooks.py"] = {
      path: "app/webhooks.py",
      language: "python",
      content: `API_KEY = "${fakeKey}"\n` + T1_INITIAL_REPO["app/webhooks.py"].content,
    };
    const risks = scanRisks(repoWithSecret);
    const secRisk = risks.find((r) => r.category === "secrets");
    expect(secRisk).toBeDefined();
    expect(secRisk?.severity).toBe("high");
    expect(secRisk?.text).not.toContain(fakeKey);
    expect(secRisk?.text).toBe("Potential hardcoded credential or secret detected.");
    expect(secRisk?.evidence[0].path).toBe("app/webhooks.py");
    expect(secRisk?.evidence[0].startLine).toBe(1);
  });

  it("8. bare except gives error_handling risk with accurate line number", () => {
    const repoWithExcept = { ...T1_INITIAL_REPO };
    repoWithExcept["app/webhooks.py"] = {
      path: "app/webhooks.py",
      language: "python",
      content: `try:\n    pass\nexcept:\n    pass\n`,
    };
    const risks = scanRisks(repoWithExcept);
    const errRisk = risks.find((r) => r.category === "error_handling");
    expect(errRisk).toBeDefined();
    expect(errRisk?.severity).toBe("medium");
    expect(errRisk?.evidence[0].startLine).toBe(3);
  });

  it("9. TODO or FIXME gives low other risk", () => {
    const repoWithTodo = { ...T1_INITIAL_REPO };
    repoWithTodo["app/webhooks.py"] = {
      path: "app/webhooks.py",
      language: "python",
      content: `# TODO: add telemetry\n` + T1_INITIAL_REPO["app/webhooks.py"].content,
    };
    const risks = scanRisks(repoWithTodo);
    const todoRisk = risks.find((r) => r.category === "other" && r.text.includes("TODO"));
    expect(todoRisk).toBeDefined();
    expect(todoRisk?.severity).toBe("low");
    expect(todoRisk?.evidence[0].startLine).toBe(1);
  });

  it("10. print statement in app/ file gives low other risk", () => {
    const risks = scanRisks(T1_INITIAL_REPO);
    const printRisk = risks.find((r) => r.category === "other" && r.text.includes("print()"));
    expect(printRisk).toBeDefined();
    expect(printRisk?.severity).toBe("low");
    expect(printRisk?.evidence[0].path).toBe("app/webhooks.py");
    expect(printRisk?.evidence[0].startLine).toBe(27);
  });

  it("11. evidence line numbers match actual lines in saved files", () => {
    const fixedRepo = { ...T1_INITIAL_REPO };
    for (const [path, content] of Object.entries(REFERENCE_FIX)) {
      fixedRepo[path] = {
        path,
        language: path.endsWith(".py") ? "python" : "markdown",
        content,
      };
    }
    const report = buildSelfCheck(fixedRepo, criteria, TEST_RULES);
    const c1 = report.criteria.find((c) => c.criterionId === "C1");
    expect(c1?.evidence[0].startLine).toBe(9);
    expect(c1?.evidence[0].snippet).toContain("processed_event_ids");
  });
});
