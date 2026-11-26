import { describe, it, expect } from "vitest";
import { summarizeReport, flagEvidence, isReportStale } from "./selfCheck";
import type { SelfCheckReport } from "./types";

describe("selfCheck / summarizeReport", () => {
  it("counts criteria statuses accurately", () => {
    const report: SelfCheckReport = {
      reportId: "rep_1",
      generatedAt: "2026-11-22T10:00:00Z",
      repoCommitSha: "abc",
      criteria: [
        {
          criterionId: "C1",
          text: "Text 1",
          required: true,
          status: "met",
          reasoning: "Good",
          evidence: [],
        },
        {
          criterionId: "C2",
          text: "Text 2",
          required: true,
          status: "partial",
          reasoning: "Half done",
          evidence: [],
        },
        {
          criterionId: "C3",
          text: "Text 3",
          required: false,
          status: "not_met",
          reasoning: "Not done",
          evidence: [],
        },
        {
          criterionId: "C4",
          text: "Text 4",
          required: false,
          status: "unknown",
          reasoning: "Unknown",
          evidence: [],
        },
      ],
      risks: [],
    };

    const summary = summarizeReport(report);
    expect(summary).toEqual({
      met: 1,
      partial: 1,
      notMet: 1,
      unknown: 1,
    });
  });

  it("handles empty criteria list", () => {
    const report: SelfCheckReport = {
      reportId: "rep_2",
      generatedAt: "2026-11-22T10:00:00Z",
      repoCommitSha: "abc",
      criteria: [],
      risks: [],
    };
    expect(summarizeReport(report)).toEqual({
      met: 0,
      partial: 0,
      notMet: 0,
      unknown: 0,
    });
  });
});

describe("selfCheck / flagEvidence", () => {
  it("marks evidence as inChangedFiles when path is in changed set", () => {
    const report: SelfCheckReport = {
      reportId: "rep_3",
      generatedAt: "2026-11-22T10:00:00Z",
      repoCommitSha: "abc",
      criteria: [
        {
          criterionId: "C1",
          text: "Webhooks",
          required: true,
          status: "met",
          reasoning: "Ok",
          evidence: [
            { path: "app/webhooks.py", startLine: 1, endLine: 5, snippet: null },
            { path: "tests/test_webhooks.py", startLine: 1, endLine: 2, snippet: null },
          ],
        },
      ],
      risks: [],
    };

    const changed = new Set(["app/webhooks.py"]);
    const flagged = flagEvidence(report, changed);

    expect(flagged.criteria[0].evidence[0].inChangedFiles).toBe(true);
    expect(flagged.criteria[0].evidence[1].inChangedFiles).toBe(false);
  });

  it("normalizes path before checking against changed set", () => {
    const report: SelfCheckReport = {
      reportId: "rep_4",
      generatedAt: "2026-11-22T10:00:00Z",
      repoCommitSha: "abc",
      criteria: [
        {
          criterionId: "C1",
          text: "Webhooks",
          required: true,
          status: "met",
          reasoning: "Ok",
          evidence: [
            { path: "./app\\webhooks.py", startLine: 1, endLine: 5, snippet: null },
          ],
        },
      ],
      risks: [],
    };

    const changed = new Set(["app/webhooks.py"]);
    const flagged = flagEvidence(report, changed);
    expect(flagged.criteria[0].evidence[0].inChangedFiles).toBe(true);
  });
});

describe("selfCheck / isReportStale", () => {
  it("returns true when workspace files were saved after report generation", () => {
    const generated = "2026-11-22T10:00:00Z";
    const savedAfter = new Date("2026-11-22T10:05:00Z").getTime();
    expect(isReportStale(generated, savedAfter)).toBe(true);
  });

  it("returns false when files were saved before generation", () => {
    const generated = "2026-11-22T10:00:00Z";
    const savedBefore = new Date("2026-11-22T09:55:00Z").getTime();
    expect(isReportStale(generated, savedBefore)).toBe(false);
  });

  it("returns false when lastSavedAt is null", () => {
    expect(isReportStale("2026-11-22T10:00:00Z", null)).toBe(false);
  });
});
