import { VITE_API_BASE_URL } from "./env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly correlationId: string,
    public readonly detail: string,
    public readonly fieldErrors?: { field: string; message: string }[]
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

const STATUS_DEFAULT_CODES: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "VALIDATION_ERROR",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMIT_EXCEEDED",
  500: "INTERNAL_SERVER_ERROR",
  502: "SERVICE_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
  504: "SERVICE_TIMEOUT",
};

const STATUS_DEFAULT_MESSAGES: Record<number, string> = {
  400: "The request could not be validated.",
  401: "Authentication is required.",
  403: "You do not have permission to perform this action.",
  404: "The requested endpoint was not found.",
  405: "HTTP method is not allowed for this endpoint.",
  409: "The request conflicts with the current resource state.",
  422: "Request validation failed.",
  429: "Too many requests. Please wait before retrying.",
  500: "An unexpected internal server error occurred.",
  502: "An upstream service error occurred.",
  503: "The requested service is currently unavailable.",
  504: "The upstream service timed out while processing the request.",
};

export function normalizeApiError(
  status: number,
  rawText: string,
  headers?: Headers | Record<string, string>
): ApiError {
  let correlationId = "";
  if (headers) {
    if (typeof (headers as Headers).get === "function") {
      correlationId =
        (headers as Headers).get("X-Correlation-Id") ??
        (headers as Headers).get("X-Request-ID") ??
        "";
    } else {
      const h = headers as Record<string, string>;
      correlationId = h["x-correlation-id"] || h["X-Correlation-Id"] || h["x-request-id"] || h["X-Request-ID"] || "";
    }
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Non-JSON answer (e.g. HTML error page from tunnel or gateway)
    return new ApiError(
      status,
      "SERVICE_UNAVAILABLE",
      correlationId,
      "The API answered with a page instead of JSON. Check VITE_GATEWAY_URL."
    );
  }

  // Contract format: { success: false, error: { code, message }, request_id }
  if (parsed?.request_id && !correlationId) {
    correlationId = String(parsed.request_id);
  }

  const code: string =
    parsed?.error?.code ??
    parsed?.code ??
    STATUS_DEFAULT_CODES[status] ??
    "UNKNOWN_ERROR";

  let detail: string =
    parsed?.error?.message ??
    (typeof parsed?.detail === "string" ? parsed.detail : undefined) ??
    parsed?.message ??
    parsed?.title ??
    STATUS_DEFAULT_MESSAGES[status] ??
    "An error occurred.";

  let fieldErrors: { field: string; message: string }[] | undefined;

  if (Array.isArray(parsed?.errors)) {
    fieldErrors = parsed.errors;
  } else if (Array.isArray(parsed?.error?.details)) {
    fieldErrors = parsed.error.details.map((d: any) => ({
      field: String(d.field ?? d.loc ?? ""),
      message: String(d.message ?? d.msg ?? ""),
    }));
  } else if (Array.isArray(parsed?.detail)) {
    // FastAPI / Pydantic validation error shape
    fieldErrors = parsed.detail.map((d: any) => {
      const field = Array.isArray(d.loc)
        ? d.loc.filter((part: any) => part !== "body").join(".")
        : String(d.loc ?? "");
      return {
        field,
        message: String(d.msg ?? d.message ?? "Invalid value"),
      };
    });
  }

  return new ApiError(status, code, correlationId, detail, fieldErrors);
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuth = false, signal } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
    "ngrok-skip-browser-warning": "true",
  };

  if (!skipAuth && _accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const apiBase = VITE_API_BASE_URL || "/api/v1";
  const normalizedBase = apiBase.replace(/\/$/, "");
  const cleanPath = path.startsWith(normalizedBase)
    ? path
    : `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
  const url = cleanPath;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "include",
      signal: controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    throw fetchErr;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const rawText = await res.text();
    throw normalizeApiError(res.status, rawText, res.headers);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
