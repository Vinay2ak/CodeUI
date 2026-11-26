import { describe, it, expect } from "vitest";
import { computeGate, ComputeGateParams } from "./gate";
import { Run } from "../../services/submission/types";

describe("submission gate invariance", () => {
  const passingRun: Run = {
    runId: "run_pass",
    taskId: "t1",
    status: "completed",
    results: [
      { testId: "test_1", status: "passed", durationMs: 15 },
      { testId: "test_2", status: "passed", durationMs: 20 },
    ],
  };

  const failingRun: Run = {
    runId: "run_fail",
    taskId: "t1",
    status: "completed",
    results: [
      { testId: "test_1", status: "passed", durationMs: 15 },
      { testId: "test_2", status: "failed", durationMs: 20 },
    ],
  };

  it("computes identical gate results when extra AI parameters are present in input", () => {
    const baseParams: ComputeGateParams = {
      workspaceStatus: "running",
      run: passingRun,
      stale: false,
      requiredTestIds: ["test_1", "test_2"],
      submissionStatus: "none",
    };

    const aiInjectedParams = {
      ...baseParams,
      aiReport: { status: "not_met" },
      selfCheck: { score: 0 },
      draft: "Fake draft",
    } as unknown as ComputeGateParams;

    const baseResult = computeGate(baseParams);
    const injectedResult = computeGate(aiInjectedParams);

    expect(injectedResult).toEqual(baseResult);
    expect(baseResult.canSubmit).toBe(true);
  });

  it("remains blocked on failing tests even if artificial AI parameters claim success", () => {
    const baseParams: ComputeGateParams = {
      workspaceStatus: "running",
      run: failingRun,
      stale: false,
      requiredTestIds: ["test_1", "test_2"],
      submissionStatus: "none",
    };

    const aiClaimingSuccess = {
      ...baseParams,
      aiReport: { status: "met", score: 100 },
      selfCheckReport: { allPassed: true },
    } as unknown as ComputeGateParams;

    const baseResult = computeGate(baseParams);
    const injectedResult = computeGate(aiClaimingSuccess);

    expect(injectedResult).toEqual(baseResult);
    expect(injectedResult.canSubmit).toBe(false);
    expect(injectedResult.reasons).toContain("1 required test failing");
  });

  it("verifies computeGate parameter signature length has not changed", () => {
    expect(computeGate.length).toBe(1);
  });
});
