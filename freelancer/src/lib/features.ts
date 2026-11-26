export function isOn(raw: string | undefined, mocksOn: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return mocksOn;
}

export type AiFeatureName = "context" | "ask" | "explain" | "selfcheck" | "draft";

export function aiFeature(name: AiFeatureName): boolean {
  const env = import.meta.env;
  const rawAi = env.VITE_FEATURE_AI as string | undefined;
  const useMocks = env.VITE_USE_MOCKS === "true";

  if (!isOn(rawAi, useMocks)) {
    return false;
  }

  const rawFeatures = (env.VITE_AI_FEATURES as string | undefined) || "";
  const trimmed = rawFeatures.trim();
  if (!trimmed) {
    // Unset or empty means all features enabled
    return true;
  }

  const enabledList = trimmed
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);

  return enabledList.includes(name.toLowerCase());
}
