import { describe, it, expect } from "vitest";
import { nextJobDelay, MAX_JOB_POLLS } from "./jobs";

describe("jobs / nextJobDelay", () => {
  it("returns 800ms for first poll attempt (attempt 0)", () => {
    expect(nextJobDelay(0)).toBe(800);
  });

  it("returns escalating backoff delays for subsequent attempts", () => {
    expect(nextJobDelay(1)).toBe(1000);
    expect(nextJobDelay(2)).toBe(1500);
  });

  it("caps polling delay at 2000ms for attempt >= 3", () => {
    expect(nextJobDelay(3)).toBe(2000);
    expect(nextJobDelay(10)).toBe(2000);
  });

  it("defines MAX_JOB_POLLS as 60", () => {
    expect(MAX_JOB_POLLS).toBe(60);
  });
});
