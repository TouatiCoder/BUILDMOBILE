import { API_BASE_URL, REQUEST_TIMEOUT_MS, assertApiConfigured } from '@/lib/config';
import { SESSION_COOKIE_NAME } from '@/auth/token';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status: number = 0,
    readonly code?: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

type SessionBridge = {
  getToken: () => string | null;
  /** `sentToken` is the session the rejected request carried (it may belong to a session that already ended). */
  onUnauthorized: (sentToken: string | null) => void;
};

let session: SessionBridge = { getToken: () => null, onUnauthorized: () => {} };

/** Wired by AuthProvider so the client never imports React state directly. */
export function bindSession(bridge: SessionBridge) {
  session = bridge;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skip the global 401 handler (used by login/logout). */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

function extractErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.error === 'string') return b.error;
    if (typeof b.message === 'string') return b.message;
  }
  return undefined;
}

export type RawResponse = { status: number; headers: Headers; body: unknown; sentToken: string | null };

/**
 * Low-level request. `credentials: 'omit'` keeps the native cookie jar out of
 * the loop: the session is sent explicitly and only from secure storage.
 */
export async function rawRequest(path: string, options: RequestOptions = {}): Promise<RawResponse> {
  assertApiConfigured();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = options.anonymous ? null : session.getToken();
  if (token) headers.Cookie = `${SESSION_COOKIE_NAME}=${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onOuterAbort);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = controller.signal.aborted && !options.signal?.aborted;
    throw new ApiError(
      aborted ? 'timeout' : error instanceof Error ? error.message : 'network',
      aborted ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, headers: response.headers, body, sentToken: token };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, options);
  if (res.status >= 200 && res.status < 300) return res.body as T;

  if (res.status === 401 && !options.anonymous) session.onUnauthorized(res.sentToken);
  const code =
    res.body && typeof res.body === 'object' && typeof (res.body as Record<string, unknown>).code === 'string'
      ? ((res.body as Record<string, unknown>).code as string)
      : undefined;
  throw new ApiError(extractErrorMessage(res.body) ?? `HTTP ${res.status}`, 'http', res.status, code, res.body);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
