export interface AppEnv {
  VITE_USE_MOCKS: boolean;
  VITE_MOCK_SERVICES: string[];
  VITE_GITHUB_MODE: 'mock' | 'off';
  VITE_API_BASE_URL: string;
  VITE_GATEWAY_URL: string;
  VITE_API_URL?: string;
  VITE_BASE_PATH: string;
  VITE_SIGNIN_URL: string;
  VITE_ACCOUNT_URL: string;
  VITE_WORKSPACE_URL: string;
  VITE_WS_URL: string;
  VITE_DEV_TOOLS: boolean;
  VITE_GRAFANA_URL: string;
  VITE_FEATURE_AI_BRIEF?: string;
  VITE_DRAFT_PUBLISH?: string;
  VITE_FEATURE_AI_VERIFICATION?: string;
}

function parseEnv(): AppEnv {
  const metaEnv = import.meta.env;

  const VITE_USE_MOCKS = metaEnv.VITE_USE_MOCKS === 'true';

  // Parse VITE_MOCK_SERVICES: comma separated list of service folder names
  const rawMockServices = metaEnv.VITE_MOCK_SERVICES || '';
  const VITE_MOCK_SERVICES = rawMockServices
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  // Validate VITE_GITHUB_MODE: accepts only 'mock' or 'off'
  const rawGithubMode = metaEnv.VITE_GITHUB_MODE;
  let VITE_GITHUB_MODE: 'mock' | 'off' = 'off';
  if (rawGithubMode === 'mock') {
    VITE_GITHUB_MODE = 'mock';
  } else if (rawGithubMode === 'off' || !rawGithubMode) {
    VITE_GITHUB_MODE = 'off';
  } else {
    console.warn(
      `[CodeBridge env] Invalid VITE_GITHUB_MODE="${rawGithubMode}". Supported values are "mock" or "off". Defaulting to "off".`
    );
    VITE_GITHUB_MODE = 'off';
  }

  // Deprecate VITE_API_URL with a warning
  if (metaEnv.VITE_API_URL) {
    console.warn(
      '[CodeBridge env] VITE_API_URL is deprecated and ignored. Please configure VITE_GATEWAY_URL instead.'
    );
  }

  const VITE_API_BASE_URL = metaEnv.VITE_API_BASE_URL || '/api/v1';
  const VITE_GATEWAY_URL =
    metaEnv.VITE_GATEWAY_URL || metaEnv.VITE_API_URL || 'http://localhost:8000';
  const VITE_BASE_PATH = metaEnv.VITE_BASE_PATH || metaEnv.BASE_URL || '/';
  const VITE_SIGNIN_URL = metaEnv.VITE_SIGNIN_URL || 'http://localhost:5173/login';
  const VITE_ACCOUNT_URL = metaEnv.VITE_ACCOUNT_URL || 'http://localhost:5176/';
  const VITE_WORKSPACE_URL = metaEnv.VITE_WORKSPACE_URL || 'http://localhost:5177/';
  const VITE_WS_URL = metaEnv.VITE_WS_URL || '/api/v1/notifications/ws';
  const VITE_DEV_TOOLS = metaEnv.VITE_DEV_TOOLS === 'true';
  const VITE_GRAFANA_URL = metaEnv.VITE_GRAFANA_URL ? String(metaEnv.VITE_GRAFANA_URL).trim() : '';

  return {
    VITE_USE_MOCKS,
    VITE_MOCK_SERVICES,
    VITE_GITHUB_MODE,
    VITE_API_BASE_URL,
    VITE_GATEWAY_URL,
    VITE_BASE_PATH,
    VITE_SIGNIN_URL,
    VITE_ACCOUNT_URL,
    VITE_WORKSPACE_URL,
    VITE_WS_URL,
    VITE_DEV_TOOLS,
    VITE_GRAFANA_URL,
    VITE_FEATURE_AI_BRIEF: metaEnv.VITE_FEATURE_AI_BRIEF !== undefined ? String(metaEnv.VITE_FEATURE_AI_BRIEF) : undefined,
    VITE_DRAFT_PUBLISH: metaEnv.VITE_DRAFT_PUBLISH !== undefined ? String(metaEnv.VITE_DRAFT_PUBLISH) : undefined,
  };
}

export const env = parseEnv();
