export function isOn(raw?: string | boolean, mocksOn?: boolean): boolean {
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  return Boolean(mocksOn);
}

export const FEATURES = {
  get AI_BRIEF(): boolean {
    const raw = import.meta.env.VITE_FEATURE_AI_BRIEF;
    const mocks = import.meta.env.VITE_USE_MOCKS === 'true';
    return isOn(raw, mocks);
  },
  get DRAFT_PUBLISH(): boolean {
    const raw = import.meta.env.VITE_DRAFT_PUBLISH;
    const mocks = import.meta.env.VITE_USE_MOCKS === 'true';
    return isOn(raw, mocks);
  },
  get AI_VERIFICATION(): boolean {
    const raw = import.meta.env.VITE_FEATURE_AI_VERIFICATION;
    const mocks = import.meta.env.VITE_USE_MOCKS === 'true';
    return isOn(raw, mocks);
  },
};
