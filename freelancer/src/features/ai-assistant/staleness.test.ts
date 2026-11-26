import { describe, it, expect } from "vitest";
import { isStale } from "./staleness";

describe("staleness / isStale", () => {
  it("returns false if workspace was never saved", () => {
    expect(isStale("2026-11-22T10:00:00Z", null)).toBe(false);
  });

  it("returns true if file was saved after generation time", () => {
    const generated = "2026-11-22T10:00:00.000Z";
    const savedAfter = new Date("2026-11-22T10:05:00.000Z").getTime();
    expect(isStale(generated, savedAfter)).toBe(true);
  });

  it("returns false if file was saved before generation time", () => {
    const generated = "2026-11-22T10:00:00.000Z";
    const savedBefore = new Date("2026-11-22T09:55:00.000Z").getTime();
    expect(isStale(generated, savedBefore)).toBe(false);
  });
});
