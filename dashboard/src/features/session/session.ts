import { useSyncExternalStore } from 'react';
import { ApiError } from '../../lib/errors';
import { identityApi, normalizeUser } from '../../services/identity/api';
import {
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  setRefreshHandler,
  setOnSuspendedHandler,
} from '../../lib/authHeader';
import { clearDraft } from '../post-project/draft';

export type UserRole = 'owner' | 'freelancer' | 'admin';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'suspended';
  createdAt: string;
}

export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'anonymous'
  | 'suspended'
  | 'expired';

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  expiresAt: number | null;
}

const SESSION_STORAGE_KEY = 'cb_dashboard_session';

interface PersistedSession {
  user: User;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

function persistSession(data: PersistedSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function readPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.user) {
      return {
        user: normalizeUser(parsed.user),
        accessToken: parsed.accessToken || null,
        refreshToken: parsed.refreshToken || null,
        expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function clearPersistedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    const cookieNames = [
      'cb_access_token',
      'cb_token',
      'cb_refresh_token',
      'cb_rt',
      'cb_user',
      'mock_rt',
    ];
    for (const name of cookieNames) {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    }
  }
}

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// Decode JWT exp (ms) safely for proactive scheduling only
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function parseUserJsonParam(rawUser: string): User | null {
  try {
    return normalizeUser(JSON.parse(rawUser));
  } catch {
    try {
      return normalizeUser(JSON.parse(decodeURIComponent(rawUser)));
    } catch {
      return null;
    }
  }
}

export function redirectToWorkspace(
  token?: string | null,
  rt?: string | null,
  user?: User | null
) {
  const workspaceUrl =
    import.meta.env.VITE_WORKSPACE_URL || 'http://localhost:5177/';
  const url = new URL(workspaceUrl, window.location.origin);

  const activeToken = token;
  const activeRt = rt || getRefreshToken();

  if (activeToken) {
    url.searchParams.set('token', activeToken);
    url.searchParams.set('access_token', activeToken);
  }
  if (activeRt) {
    url.searchParams.set('refresh_token', activeRt);
    url.searchParams.set('rt', activeRt);
  }
  if (user) {
    url.searchParams.set('user', JSON.stringify(user));
    url.searchParams.set('role', user.role);
  }

  window.location.replace(url.toString());
}

function getInitialTokenAndUser(): {
  token: string | null;
  rt: string | null;
  user: User | null;
  expiresAt: number | null;
} {
  if (typeof window === 'undefined') {
    return { token: null, rt: null, user: null, expiresAt: null };
  }

  const url = new URL(window.location.href);
  let incomingToken =
    url.searchParams.get('token') || url.searchParams.get('access_token');
  let incomingRt =
    url.searchParams.get('rt') || url.searchParams.get('refresh_token');
  let incomingUser = url.searchParams.get('user');
  let incomingRole = url.searchParams.get('role');

  if (!incomingToken && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    incomingToken = hashParams.get('token') || hashParams.get('access_token');
    incomingRt = incomingRt || hashParams.get('rt') || hashParams.get('refresh_token');
    incomingUser = incomingUser || hashParams.get('user');
    incomingRole = incomingRole || hashParams.get('role');
  }

  let parsedUser: User | null = null;
  if (incomingUser) {
    parsedUser = parseUserJsonParam(incomingUser);
  }

  // If user profile is not yet parsed but token exists, decode JWT payload
  if (!parsedUser && incomingToken) {
    const payload = decodeJwtPayload(incomingToken);
    if (payload && (payload.sub || payload.id)) {
      const r = (payload.role || 'owner').toLowerCase();
      parsedUser = {
        id: payload.sub || payload.id,
        email: payload.email || '',
        displayName:
          payload.displayName ||
          payload.full_name ||
          payload.name ||
          payload.email?.split('@')[0] ||
          'User',
        role: r === 'admin' ? 'admin' : r === 'freelancer' ? 'freelancer' : 'owner',
        status: payload.status || 'active',
        createdAt: new Date().toISOString(),
      };
    }
  }

  if (!parsedUser && incomingRole) {
    const validRole =
      incomingRole.toLowerCase() === 'admin'
        ? 'admin'
        : incomingRole.toLowerCase() === 'freelancer'
        ? 'freelancer'
        : 'owner';
    parsedUser = {
      id: 'url-user',
      email: `${validRole}@codebridge.dev`,
      displayName: validRole.charAt(0).toUpperCase() + validRole.slice(1),
      role: validRole,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  }

  // If no URL handoff, restore persisted session on reload or shared localhost cookies from 5173
  let persistedExpiresAt: number | null = null;
  if (!incomingToken && !parsedUser) {
    const persisted = readPersistedSession();
    if (persisted && persisted.user) {
      incomingToken = persisted.accessToken;
      incomingRt = persisted.refreshToken;
      parsedUser = persisted.user;
      persistedExpiresAt = persisted.expiresAt;
    } else {
      const cookieToken = readCookieValue('cb_access_token') || readCookieValue('cb_token');
      const cookieRt = readCookieValue('cb_refresh_token') || readCookieValue('cb_rt');
      const cookieUserRaw = readCookieValue('cb_user');
      if (cookieToken) incomingToken = cookieToken;
      if (cookieRt) incomingRt = cookieRt;
      if (cookieUserRaw) {
        parsedUser = parseUserJsonParam(cookieUserRaw);
      }
      if (!parsedUser && incomingToken) {
        const payload = decodeJwtPayload(incomingToken);
        if (payload && (payload.sub || payload.id)) {
          const r = (payload.role || 'owner').toLowerCase();
          parsedUser = {
            id: payload.sub || payload.id,
            email: payload.email || '',
            displayName:
              payload.displayName ||
              payload.full_name ||
              payload.name ||
              payload.email?.split('@')[0] ||
              'User',
            role: r === 'admin' ? 'admin' : r === 'freelancer' ? 'freelancer' : 'owner',
            status: payload.status || 'active',
            createdAt: new Date().toISOString(),
          };
        }
      }
    }
  }

  if (incomingToken) {
    setAccessToken(incomingToken);
  }
  if (incomingRt) {
    setRefreshToken(incomingRt);
  }

  // Handle freelancer redirection to workspace
  const isFreelancerRoute =
    window.location.pathname.startsWith('/freelancer') ||
    window.location.hash.includes('/freelancer');
  if (parsedUser?.role === 'freelancer' || isFreelancerRoute) {
    redirectToWorkspace(incomingToken, incomingRt, parsedUser);
    return {
      token: incomingToken || null,
      rt: incomingRt || null,
      user: parsedUser,
      expiresAt: persistedExpiresAt,
    };
  }

  // Clean sensitive parameters from URL history
  if (
    url.searchParams.has('token') ||
    url.searchParams.has('access_token') ||
    url.searchParams.has('rt') ||
    url.searchParams.has('refresh_token') ||
    url.searchParams.has('user') ||
    url.searchParams.has('role')
  ) {
    url.searchParams.delete('token');
    url.searchParams.delete('access_token');
    url.searchParams.delete('rt');
    url.searchParams.delete('refresh_token');
    url.searchParams.delete('user');
    url.searchParams.delete('role');
    window.history.replaceState(
      {},
      '',
      url.pathname + (url.search ? url.search : '') + url.hash
    );
  }

  const resolvedExpiresAt =
    persistedExpiresAt || (incomingToken ? decodeJwtExp(incomingToken) : null);

  if (parsedUser && incomingToken) {
    persistSession({
      user: parsedUser,
      accessToken: incomingToken,
      refreshToken: incomingRt || null,
      expiresAt: resolvedExpiresAt,
    });
    return {
      token: incomingToken,
      rt: incomingRt || null,
      user: parsedUser,
      expiresAt: resolvedExpiresAt,
    };
  }

  return { token: incomingToken || null, rt: incomingRt || null, user: null, expiresAt: null };
}

const initialHandoff = getInitialTokenAndUser();

let state: SessionState = initialHandoff.user
  ? {
      status: 'authenticated',
      user: initialHandoff.user,
      accessToken: initialHandoff.token,
      expiresAt: initialHandoff.expiresAt,
    }
  : {
      status: 'loading',
      user: null,
      accessToken: initialHandoff.token,
      expiresAt: null,
    };

const listeners = new Set<() => void>();

let reauthCallback: ((token: string) => void) | null = null;

export function registerRealtimeReauth(fn: (token: string) => void) {
  reauthCallback = fn;
}

export const sessionStore = {
  getState: () => state,
  setState: (nextState: Partial<SessionState>) => {
    state = { ...state, ...nextState };
    if ('accessToken' in nextState) {
      setAccessToken(nextState.accessToken ?? null);
    }
    if (state.status === 'authenticated' && state.user) {
      persistSession({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: getRefreshToken(),
        expiresAt: state.expiresAt,
      });
    } else if (state.status === 'anonymous' || state.status === 'suspended') {
      clearPersistedSession();
    }
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let proactiveRefreshTimer: NodeJS.Timeout | number | null = null;

function scheduleProactiveRefresh(token: string) {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }

  const expMs = decodeJwtExp(token);
  if (!expMs) return;

  const now = Date.now();
  const timeUntilExp = expMs - now;
  const refreshInMs = Math.max(timeUntilExp - 60000, 5000);

  if (timeUntilExp > 0) {
    proactiveRefreshTimer = setTimeout(() => {
      refreshSession().catch(() => {});
    }, refreshInMs);
  }
}

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const storedRefreshToken = getRefreshToken() || undefined;

      const data = await identityApi.refresh(storedRefreshToken);
      const token = data.accessToken;
      if (!token) {
        throw new Error('No access token returned from refresh');
      }

      const expiresIn = data.expiresIn || 900;
      const expMs = decodeJwtExp(token) || Date.now() + expiresIn * 1000;

      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }

      setAccessToken(token);

      const resolvedUser =
        data.user && data.user.id !== 'anonymous' ? data.user : state.user;

      sessionStore.setState({
        status: 'authenticated',
        user: resolvedUser,
        accessToken: token,
        expiresAt: expMs,
      });

      scheduleProactiveRefresh(token);

      if (reauthCallback) {
        reauthCallback(token);
      }

      return token;
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_SUSPENDED') {
        sessionStore.setState({ status: 'suspended', accessToken: null });
        setRefreshToken(null);
        throw err;
      }

      // If we already have a non-expired access token in memory/sessionStorage and hit a transient error, keep the active session
      const hasValidSession =
        state.status === 'authenticated' &&
        Boolean(state.user) &&
        Boolean(state.accessToken) &&
        (!state.expiresAt || state.expiresAt > Date.now());

      if (
        hasValidSession &&
        (!err || err.status === 503 || err.status === 504 || state.accessToken?.startsWith('demo-token-'))
      ) {
        return state.accessToken;
      }

      sessionStore.setState({ status: 'anonymous', accessToken: null, user: null });
      setRefreshToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

setRefreshHandler(() => refreshSession());

setOnSuspendedHandler(() => {
  sessionStore.setState({ status: 'suspended', accessToken: null });
});

export async function initSession(): Promise<void> {
  if (state.status === 'authenticated' && state.user) {
    if (state.accessToken) {
      scheduleProactiveRefresh(state.accessToken);
      // Enrich displayName/email in background if missing or generic fallback ("User")
      if (
        state.user.displayName === 'User' ||
        state.user.displayName === 'Owner' ||
        !state.user.email
      ) {
        identityApi
          .getMe()
          .then((freshUser) => {
            if (freshUser && freshUser.id !== 'anonymous') {
              sessionStore.setState({ user: freshUser });
            }
          })
          .catch(() => {});
      }
    }
    return;
  }

  sessionStore.setState({ status: 'loading' });

  if (state.accessToken) {
    try {
      const user = await identityApi.getMe();
      if (user.role === 'freelancer') {
        redirectToWorkspace(state.accessToken, getRefreshToken(), user);
        return;
      }
      sessionStore.setState({
        status: 'authenticated',
        user,
      });
      scheduleProactiveRefresh(state.accessToken);
      return;
    } catch {
      // Fall through to refresh
    }
  }

  try {
    const token = await refreshSession();
    if (!token) {
      sessionStore.setState({ status: 'anonymous', user: null, accessToken: null });
    }
  } catch (err: any) {
    if (err instanceof ApiError && err.code === 'ACCOUNT_SUSPENDED') {
      sessionStore.setState({ status: 'suspended', accessToken: null });
    } else {
      sessionStore.setState({ status: 'anonymous', user: null, accessToken: null });
    }
  }
}

export const restoreSession = initSession;

export async function loginWithCredentials(
  email: string,
  pass: string
): Promise<void> {
  sessionStore.setState({ status: 'loading' });
  try {
    const data = await identityApi.login({ email, password: pass });
    const token = data.accessToken;
    if (!token) {
      throw new Error('No access token received');
    }

    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }

    setAccessToken(token);

    let user = data.user;
    if (!user || user.id === 'anonymous' || user.displayName === 'User') {
      try {
        user = await identityApi.getMe();
      } catch {
        // fallback to adapted user
      }
    }

    if (user.role === 'freelancer') {
      redirectToWorkspace(token, data.refreshToken, user);
      return;
    }

    const expMs = decodeJwtExp(token) || Date.now() + 900 * 1000;

    sessionStore.setState({
      status: 'authenticated',
      user,
      accessToken: token,
      expiresAt: expMs,
    });

    scheduleProactiveRefresh(token);
  } catch (err: any) {
    sessionStore.setState({ status: 'anonymous', user: null, accessToken: null });
    throw err;
  }
}

export async function logout(): Promise<void> {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }

  try {
    await identityApi.logout();
  } catch {
    // ignore
  }

  setAccessToken(null);
  setRefreshToken(null);
  clearDraft();
  clearPersistedSession();

  sessionStore.setState({
    status: 'anonymous',
    user: null,
    accessToken: null,
    expiresAt: null,
  });
}

export function handleSessionExpired(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }

  setAccessToken(null);
  setRefreshToken(null);
  clearPersistedSession();

  sessionStore.setState({
    status: 'expired',
    user: null,
    accessToken: null,
    expiresAt: null,
  });
}

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}
