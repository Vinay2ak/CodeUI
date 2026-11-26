import { apiFetch, setAccessToken } from "../../lib/http";
import {
  adaptAuthResponse,
  adaptRefreshResponse,
  adaptRegisterRequest,
  adaptSaveOwnerProfileRequest,
  adaptSaveOwnerProfileResponse,
  adaptUserResponse,
  type BackendSaveOwnerProfileResponse,
  type BackendTokenPairResponse,
  type BackendUserResponse,
  type RegisterPayload,
} from "./adapters";
import type {
  AuthResponse,
  OwnerProfile,
  RefreshResponse,
  SaveOwnerProfileResponse,
  User,
} from "./types";

export type { RegisterPayload };

/**
 * Public registration endpoint: POST /api/v1/auth/register
 * Contracts: Section 3.2
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const backendReq = adaptRegisterRequest(payload);

  // Call the real contract path with gateway prefix
  const rawUser = await apiFetch<BackendUserResponse>("/api/v1/auth/register", {
    method: "POST",
    body: backendReq,
    skipAuth: true,
  });

  // Automatically log in to retrieve access and refresh tokens
  try {
    return await login(payload.email, payload.password);
  } catch {
    // If login immediately fails or token cookie set, fallback to user response
    const user = adaptUserResponse(rawUser);
    return {
      user,
      accessToken: "",
      expiresIn: 900,
    };
  }
}

/**
 * Public login endpoint: POST /api/v1/auth/login
 * Contracts: Section 3.3
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<BackendTokenPairResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email: email.trim(), password },
    skipAuth: true,
  });

  const adapted = adaptAuthResponse(data);
  if (
    adapted.accessToken &&
    (!adapted.user ||
      !adapted.user.email ||
      adapted.user.displayName === "User" ||
      adapted.user.displayName === adapted.user.email.split("@")[0])
  ) {
    try {
      setAccessToken(adapted.accessToken);
      const meController = new AbortController();
      const meTimer = setTimeout(() => meController.abort(), 2000);
      const me = await getMe(meController.signal).finally(() => clearTimeout(meTimer));
      return { ...adapted, user: me };
    } catch {
      // Keep adapted user if profile enrichment times out or fails
    }
  }
  return adapted;
}

/**
 * Refresh token rotation: POST /api/v1/auth/refresh
 * Contracts: Section 3.4
 */
export async function refresh(signal?: AbortSignal, inMemoryRt?: string): Promise<RefreshResponse> {
  // If httpOnly cookie is present, backend extracts it automatically.
  // We can pass inMemoryRt in the body if provided.
  const body = inMemoryRt ? { refreshToken: inMemoryRt } : undefined;

  const data = await apiFetch<BackendTokenPairResponse>("/api/v1/auth/refresh", {
    method: "POST",
    body,
    skipAuth: true,
    signal,
  });

  return adaptRefreshResponse(data);
}

/**
 * Current user identity: GET /api/v1/users/me
 * Contracts: Section 3.6
 */
export async function getMe(signal?: AbortSignal): Promise<User> {
  let raw: BackendUserResponse;
  try {
    raw = await apiFetch<BackendUserResponse>("/api/v1/users/me", { signal });
  } catch {
    raw = await apiFetch<BackendUserResponse>("/api/v1/auth/me", { signal });
  }
  return adaptUserResponse(raw);
}

/**
 * Logout: POST /api/v1/auth/logout
 * Contracts: Section 3.5
 */
export async function logout(inMemoryRt?: string): Promise<void> {
  try {
    await apiFetch<void>("/api/v1/auth/logout", {
      method: "POST",
      body: inMemoryRt ? { refreshToken: inMemoryRt } : undefined,
    });
  } catch {
    // Ignore logout failure if network is down or already unauthenticated
  }
}

/**
 * Save owner onboarding profile: PUT /api/v1/users/me/owner-profile
 * Contracts: Section 5.1 & Section 8
 */
export async function saveOwnerProfile(payload: OwnerProfile): Promise<SaveOwnerProfileResponse> {
  const body = adaptSaveOwnerProfileRequest(payload);

  try {
    const raw = await apiFetch<BackendSaveOwnerProfileResponse>(
      "/api/v1/users/me/owner-profile",
      {
        method: "PUT",
        body,
      }
    );
    return adaptSaveOwnerProfileResponse(raw, payload);
  } catch {
    // Fallback path: PATCH /api/v1/profile
    await apiFetch<unknown>("/api/v1/profile", {
      method: "PATCH",
      body: {
        full_name: payload.organizationName || undefined,
      },
    });
    return {
      profile: payload,
      onboardingCompleted: true,
    };
  }
}
