import { ApiError } from './errors';
import { callLog } from './callLog';
import { env } from './env';
import { getAccessToken, executeRefresh, notifySuspended } from './authHeader';

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
  _isRetry?: boolean;
}

export async function httpRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeoutMs = 3500,
    skipAuth = false,
    _isRetry = false,
    headers: customHeaders = {},
    ...customOptions
  } = options;

  const method = (customOptions.method || 'GET').toUpperCase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If endpoint already starts with gateway prefix /api, use it directly; otherwise prepend VITE_API_BASE_URL
  let url: string;
  if (cleanEndpoint.startsWith('/api/') || cleanEndpoint === '/api') {
    url = cleanEndpoint;
  } else {
    const baseUrl = env.VITE_API_BASE_URL.replace(/\/$/, '');
    url = `${baseUrl}${cleanEndpoint}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' && !url.startsWith('http')) {
    url = `${window.location.origin}${url}`;
  }

  const startTime = Date.now();
  const controller =
    typeof globalThis.AbortController !== 'undefined'
      ? new globalThis.AbortController()
      : new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type') && !(customOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let correlationId = 'unknown';

  try {
    const fetchSignal =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
        ? undefined
        : controller.signal;

    const response = await fetch(url, {
      ...customOptions,
      method,
      headers,
      credentials: 'include',
      signal: fetchSignal,
    });

    clearTimeout(timer);
    const duration = Date.now() - startTime;
    correlationId =
      response.headers.get('X-Request-ID') ||
      response.headers.get('X-Correlation-Id') ||
      'unknown';

    // Handle 204 No Content
    if (response.status === 204) {
      callLog.addLog({
        method,
        path: cleanEndpoint,
        status: 204,
        ms: duration,
        correlationId,
        at: new Date().toISOString(),
      });
      return {} as T;
    }

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    let data: any = null;
    let isJson = false;

    if (rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText);
        isJson = true;
      } catch {
        isJson = false;
      }
    } else {
      isJson = true;
      data = {};
    }

    // Check for HTML response from tunnel or proxy (e.g. cloudflare, ngrok, loca.lt)
    const isHtml =
      contentType.includes('text/html') ||
      rawText.trim().toLowerCase().startsWith('<!doctype') ||
      rawText.trim().toLowerCase().startsWith('<html');

    if (isHtml || (!isJson && rawText.trim().length > 0)) {
      callLog.addLog({
        method,
        path: cleanEndpoint,
        status: 503,
        ms: duration,
        correlationId,
        at: new Date().toISOString(),
      });
      throw new ApiError({
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        detail:
          'The API answered with a page instead of JSON. Check VITE_GATEWAY_URL.',
        correlationId,
      });
    }

    if (data?.request_id && correlationId === 'unknown') {
      correlationId = data.request_id;
    }

    // Log successful call
    callLog.addLog({
      method,
      path: cleanEndpoint,
      status: response.status,
      ms: duration,
      correlationId,
      at: new Date().toISOString(),
    });

    if (!response.ok) {
      const status = response.status;

      // Extract canonical error shape from contract or fallback
      const backendError = data?.error;
      const code =
        backendError?.code ||
        data?.code ||
        (status === 401
          ? 'UNAUTHENTICATED'
          : status === 403
          ? 'FORBIDDEN'
          : status === 404
          ? 'NOT_FOUND'
          : status === 422
          ? 'VALIDATION_ERROR'
          : 'ERROR');

      const detail =
        backendError?.message ||
        data?.detail ||
        data?.message ||
        data?.title ||
        response.statusText;

      const retryAfter = response.headers.get('Retry-After')
        ? parseInt(response.headers.get('Retry-After')!, 10)
        : undefined;

      const errors = Array.isArray(data?.errors)
        ? data.errors
        : Array.isArray(backendError?.errors)
        ? backendError.errors
        : undefined;

      const fieldErrors: Record<string, string> | undefined =
        backendError?.fieldErrors ||
        backendError?.field_errors ||
        (errors && errors.length > 0
          ? errors.reduce(
              (acc: Record<string, string>, curr: { field: string; message: string }) => {
                if (curr.field) acc[curr.field] = curr.message;
                return acc;
              },
              {}
            )
          : undefined);

      // Handle ACCOUNT_SUSPENDED
      if (code === 'ACCOUNT_SUSPENDED') {
        notifySuspended();
        throw new ApiError({
          status,
          code,
          detail,
          correlationId,
          retryAfter,
          errors,
          fieldErrors,
        });
      }

      // Handle 401 TOKEN_EXPIRED replay
      if (status === 401 && (code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED') && !_isRetry) {
        try {
          const newToken = await executeRefresh();
          if (newToken) {
            // Replay once with new token
            return httpRequest<T>(endpoint, {
              ...options,
              _isRetry: true,
            });
          }
        } catch {
          throw new ApiError({
            status,
            code,
            detail,
            correlationId,
            retryAfter,
            errors,
            fieldErrors,
          });
        }
      }

      throw new ApiError({
        status,
        code,
        detail,
        correlationId,
        retryAfter,
        errors,
        fieldErrors,
      });
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timer);
    const duration = Date.now() - startTime;

    if (err instanceof ApiError) {
      throw err;
    }

    const isTimeout = err?.name === 'AbortError';
    const errorCorrelationId =
      correlationId !== 'unknown' ? correlationId : `client-${Date.now()}`;

    callLog.addLog({
      method,
      path: cleanEndpoint,
      status: 503,
      ms: duration,
      correlationId: errorCorrelationId,
      at: new Date().toISOString(),
    });

    throw new ApiError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      detail: isTimeout
        ? 'Request timed out'
        : err?.message || 'Network request failed',
      correlationId: errorCorrelationId,
    });
  }
}

export const http = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    httpRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    httpRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    httpRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    httpRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    httpRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
