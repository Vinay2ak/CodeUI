export interface EnvConfig {
  useMocks: boolean;
  mockServices: string[];
  apiBaseUrl: string;
  gatewayUrl: string;
  basePath: string;
  signinUrl: string;
  registerUrl: string;
  dashboardUrl: string;
  accountUrl: string;
  wsUrl: string;
  devTools: boolean;
  mockTokenTtlSeconds: number;
  githubMode: "mock" | "off";
  grafanaUrl: string;
  featureAi: string | undefined;
  aiFeatures: string;
}

function parseEnv(): EnvConfig {
  const env = import.meta.env;

  // VITE_API_URL is ignored with a console warning
  if (env.VITE_API_URL) {
    console.warn(
      "[Env] VITE_API_URL is deprecated and ignored. Use VITE_GATEWAY_URL instead."
    );
  }

  // VITE_GITHUB_MODE accepts only "mock" or "off"
  let githubMode: "mock" | "off" = "off";
  const rawGithub = env.VITE_GITHUB_MODE;
  if (rawGithub === "mock") {
    githubMode = "mock";
  } else if (rawGithub === "off" || !rawGithub) {
    githubMode = "off";
  } else {
    console.warn(
      `[Env] Invalid VITE_GITHUB_MODE "${rawGithub}". Accepted values are "mock" or "off". Defaulting to "off".`
    );
    githubMode = "off";
  }

  const useMocks = env.VITE_USE_MOCKS === "true";

  // VITE_MOCK_SERVICES: comma list of service folder names (e.g. "talent,payment")
  const rawMockServices = (env.VITE_MOCK_SERVICES as string | undefined) || "";
  const mockServices = rawMockServices
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const apiBaseUrl = (env.VITE_API_BASE_URL as string | undefined) || "/api/v1";
  const gatewayUrl = (env.VITE_GATEWAY_URL as string | undefined) || "http://localhost:8000";
  const basePath = (env.VITE_BASE_PATH as string | undefined) || "/";
  const signinUrl = (env.VITE_SIGNIN_URL as string | undefined) || "http://localhost:5173/login";
  const registerUrl = (env.VITE_REGISTER_URL as string | undefined) || "http://localhost:5173/register";
  const dashboardUrl = (env.VITE_DASHBOARD_URL as string | undefined) || "http://localhost:5175";
  const accountUrl = (env.VITE_ACCOUNT_URL as string | undefined) || "http://localhost:5176/";
  const wsUrl = (env.VITE_WS_URL as string | undefined) || "/api/v1/notifications/ws";
  const devTools = env.VITE_DEV_TOOLS === "true" || env.DEV;
  const mockTokenTtl = parseInt((env.VITE_MOCK_TOKEN_TTL_SECONDS as string | undefined) || "900", 10);
  const mockTokenTtlSeconds = isNaN(mockTokenTtl) ? 900 : mockTokenTtl;
  const grafanaUrl = (env.VITE_GRAFANA_URL as string | undefined) || "";
  const featureAi = env.VITE_FEATURE_AI as string | undefined;
  const aiFeatures = (env.VITE_AI_FEATURES as string | undefined) || "";

  return {
    useMocks,
    mockServices,
    apiBaseUrl,
    gatewayUrl,
    basePath,
    signinUrl,
    registerUrl,
    dashboardUrl,
    accountUrl,
    wsUrl,
    devTools,
    mockTokenTtlSeconds,
    githubMode,
    grafanaUrl,
    featureAi,
    aiFeatures,
  };
}

export const env: EnvConfig = parseEnv();
