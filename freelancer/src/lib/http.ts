import { ApiError, FieldError } from "./errors";
import { appendCallLog } from "./callLog";
import { env } from "./env";

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
  _isRetry?: boolean;
}

let getAccessTokenFn: () => string | null = () => null;
let refreshSessionFn: () => Promise<string | null> = () => Promise.resolve(null);
let refreshPromise: Promise<string | null> | null = null;

export function configureHttpAuth(
  getToken: () => string | null,
  refreshToken: () => Promise<string | null>
): void {
  getAccessTokenFn = getToken;
  refreshSessionFn = refreshToken;
}

export function resolveApiUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const base = (env.apiBaseUrl || "/api/v1").replace(/\/$/, "");

  // If endpoint already starts with base (e.g. /api/v1/projects)
  if (endpoint.startsWith(base)) {
    return endpoint;
  }

  // If endpoint starts with /api/ (e.g. /api/v1 or any /api/ route)
  if (endpoint.startsWith("/api/")) {
    return endpoint;
  }

  // Otherwise cleanly prepend base
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

export async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? 10000;
  const isRetry = options._isRetry ?? false;

  const url = resolveApiUrl(endpoint);

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth) {
    const token = getAccessTokenFn();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let response: Response;
  let correlationId = "unknown";

  try {
    response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const ms = Date.now() - startTime;
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    const status = isTimeout ? 504 : 503;
    const code = isTimeout ? "SERVICE_TIMEOUT" : "SERVICE_UNAVAILABLE";
    const detail = isTimeout
      ? "The upstream service timed out while processing the request."
      : "Network error or service unavailable";

    appendCallLog({
      method,
      path: endpoint,
      status,
      ms,
      correlationId: "net_err",
      at: new Date().toISOString(),
    });

    throw new ApiError({
      status,
      code,
      detail,
      correlationId: "net_err",
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const ms = Date.now() - startTime;
  correlationId =
    response.headers.get("x-request-id") ||
    response.headers.get("X-Request-ID") ||
    response.headers.get("x-correlation-id") ||
    response.headers.get("X-Correlation-Id") ||
    "none";

  appendCallLog({
    method,
    path: endpoint,
    status: response.status,
    ms,
    correlationId,
    at: new Date().toISOString(),
  });

  if (
    response.status === 401 &&
    !isRetry &&
    !options.skipAuth &&
    !endpoint.includes("/auth/refresh") &&
    !endpoint.includes("/auth/login")
  ) {
    let errorCode = "";
    try {
      const cloned = response.clone();
      const errJson = await cloned.json();
      errorCode = errJson.error?.code || errJson.code || "";
    } catch {
      // not JSON
    }

    if (errorCode === "UNAUTHORIZED" || errorCode === "TOKEN_EXPIRED" || !errorCode) {
      if (!refreshPromise) {
        refreshPromise = refreshSessionFn().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        return request<T>(endpoint, {
          ...options,
          _isRetry: true,
        });
      }
    }
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json") || contentType.includes("problem+json");

    let errorCode = "UNKNOWN_ERROR";
    let errorDetail = response.statusText;
    let fieldErrors: FieldError[] | undefined = undefined;

    if (!isJson) {
      // Non-JSON answer (e.g. HTML from tunnel proxy)
      throw new ApiError({
        status: response.status === 200 ? 503 : response.status,
        code: "SERVICE_UNAVAILABLE",
        detail: "The API answered with a page instead of JSON. Check VITE_GATEWAY_URL.",
        correlationId,
      });
    }

    try {
      const rawText = await response.text();
      if (!rawText.trim().startsWith("{") && !rawText.trim().startsWith("[")) {
        throw new ApiError({
          status: response.status === 200 ? 503 : response.status,
          code: "SERVICE_UNAVAILABLE",
          detail: "The API answered with a page instead of JSON. Check VITE_GATEWAY_URL.",
          correlationId,
        });
      }

      const errJson = JSON.parse(rawText);

      // Backend canonical error shape from contract: { success: false, error: { code, message }, request_id }
      if (errJson.error && typeof errJson.error === "object") {
        errorCode = errJson.error.code || errorCode;
        errorDetail = errJson.error.message || errorDetail;
      } else {
        errorCode = errJson.code || errorCode;
        errorDetail =
          (typeof errJson.detail === "string" ? errJson.detail : undefined) ||
          errJson.message ||
          errJson.title ||
          errorDetail;
      }

      if (errJson.request_id) {
        correlationId = errJson.request_id;
      } else if (errJson.correlationId) {
        correlationId = errJson.correlationId;
      }

      // FastAPI validation error detail array [{ loc: [...], msg: "..." }]
      if (Array.isArray(errJson.detail)) {
        fieldErrors = errJson.detail.map((d: any) => ({
          field: Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1] ?? "") : "",
          message: d.msg || d.message || "Invalid value",
        }));
      } else if (Array.isArray(errJson.errors)) {
        fieldErrors = errJson.errors.map((e: any) => ({
          field: e.field || "",
          message: e.message || "",
        }));
      }
    } catch (parseErr) {
      if (parseErr instanceof ApiError) {
        throw parseErr;
      }
      throw new ApiError({
        status: response.status === 200 ? 503 : response.status,
        code: "SERVICE_UNAVAILABLE",
        detail: "The API answered with a page instead of JSON. Check VITE_GATEWAY_URL.",
        correlationId,
      });
    }

    const retryAfterHeader = response.headers.get("retry-after") || response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

    throw new ApiError({
      status: response.status,
      code: errorCode,
      detail: errorDetail,
      correlationId,
      fieldErrors,
      retryAfter,
    });
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      throw new ApiError({
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        detail: "The API answered with a page instead of JSON. Check VITE_GATEWAY_URL.",
        correlationId,
      });
    }
    return JSON.parse(text) as T;
  }

  return (await response.json()) as T;
}
