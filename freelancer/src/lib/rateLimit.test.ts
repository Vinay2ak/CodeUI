import { describe, it, expect } from "vitest";
import { parseRetryAfter } from "./rateLimit";

describe("rateLimit / parseRetryAfter", () => {
  it("parses numeric seconds string", () => {
    expect(parseRetryAfter("20")).toBe(20);
    expect(parseRetryAfter("120")).toBe(120);
  });

  it("caps large values at 3600 seconds", () => {
    expect(parseRetryAfter("999999")).toBe(3600);
  });

  it("parses future HTTP date strings", () => {
    const futureDate = new Date(Date.now() + 45 * 1000).toUTCString();
    const parsed = parseRetryAfter(futureDate);
    expect(parsed).toBeGreaterThanOrEqual(40);
    expect(parsed).toBeLessThanOrEqual(50);
  });

  it("handles null, undefined, invalid and past dates gracefully", () => {
    expect(parseRetryAfter(null)).toBe(0);
    expect(parseRetryAfter(undefined)).toBe(0);
    expect(parseRetryAfter("invalid-header")).toBe(0);
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(0);
  });
});
