import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isOn, aiFeature } from "./features";

describe("features / isOn", () => {
  it("returns true when raw is 'true' regardless of mocksOn", () => {
    expect(isOn("true", false)).toBe(true);
    expect(isOn("true", true)).toBe(true);
  });

  it("returns false when raw is 'false' regardless of mocksOn", () => {
    expect(isOn("false", false)).toBe(false);
    expect(isOn("false", true)).toBe(false);
  });

  it("falls back to mocksOn when raw is undefined", () => {
    expect(isOn(undefined, false)).toBe(false);
    expect(isOn(undefined, true)).toBe(true);
  });

  it("falls back to mocksOn when raw is empty", () => {
    expect(isOn("", false)).toBe(false);
    expect(isOn("", true)).toBe(true);
  });
});

describe("features / aiFeature", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FEATURE_AI", "");
    vi.stubEnv("VITE_USE_MOCKS", "true");
    vi.stubEnv("VITE_AI_FEATURES", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when VITE_FEATURE_AI is true and VITE_AI_FEATURES is unset", () => {
    vi.stubEnv("VITE_FEATURE_AI", "true");
    expect(aiFeature("context")).toBe(true);
    expect(aiFeature("ask")).toBe(true);
  });

  it("returns false when VITE_FEATURE_AI is false even if VITE_AI_FEATURES lists it", () => {
    vi.stubEnv("VITE_FEATURE_AI", "false");
    vi.stubEnv("VITE_AI_FEATURES", "context,ask");
    expect(aiFeature("context")).toBe(false);
    expect(aiFeature("ask")).toBe(false);
  });

  it("filters specific features case-insensitively when VITE_AI_FEATURES is set", () => {
    vi.stubEnv("VITE_FEATURE_AI", "true");
    vi.stubEnv("VITE_AI_FEATURES", "Context, Ask");
    expect(aiFeature("context")).toBe(true);
    expect(aiFeature("ask")).toBe(true);
    expect(aiFeature("explain")).toBe(false);
  });

  it("defaults to on in mock mode when VITE_FEATURE_AI is unset", () => {
    vi.stubEnv("VITE_FEATURE_AI", "");
    vi.stubEnv("VITE_USE_MOCKS", "true");
    expect(aiFeature("context")).toBe(true);
  });

  it("defaults to off in real backend mode when VITE_FEATURE_AI is unset", () => {
    vi.stubEnv("VITE_FEATURE_AI", "");
    vi.stubEnv("VITE_USE_MOCKS", "false");
    expect(aiFeature("context")).toBe(false);
  });
});
