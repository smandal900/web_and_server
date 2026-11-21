import type { Endpoint } from './endpoints';

/** An HTTP error from the server. `message` is already human readable. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The server does not implement this endpoint yet (see endpoints.ts). */
export class NotSupportedError extends ApiError {
  constructor(public endpoint: string) {
    super(501, 'This feature is not supported by the server yet.');
  }
}

export interface CallOptions {
  /** Fills `{id}`-style placeholders in the path. */
  params?: Record<string, string | number>;
  query?: Record<string, unknown>;
  /** Sent as JSON, unless it is FormData/Blob/ArrayBuffer. */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Use 'blob' for file downloads (zip archives). */
  as?: 'json' | 'blob';
}

let onUnauthorized: (() => void) | undefined;
/** AuthProvider registers a callback so any 401 sends the user to the login page. */
export const setUnauthorizedHandler = (fn?: () => void) => (onUnauthorized = fn);

export const API_BASE = '/api';

export function buildUrl(path: string, params: CallOptions['params'] = {}, query: CallOptions['query'] = {}) {
  const filled = path.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(String(params[key] ?? '')));
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    for (const v of Array.isArray(value) ? value : [value]) search.append(key, String(v));
  }
  const qs = search.toString();
  return `${API_BASE}${filled}${qs ? `?${qs}` : ''}`;
}

const isRawBody = (b: unknown): b is BodyInit =>
  b instanceof FormData || b instanceof Blob || b instanceof ArrayBuffer || b instanceof ReadableStream;

/** Call one endpoint from endpoints.ts and return the parsed JSON (or undefined for 204). */
export async function call<T = unknown>(endpoint: Endpoint, options: CallOptions = {}): Promise<T> {
  const { params, query, body, headers, signal } = options;
  const init: RequestInit = { method: endpoint.method, credentials: 'same-origin', headers: { ...headers }, signal };
  if (body !== undefined) {
    if (isRawBody(body)) init.body = body;
    else {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(endpoint.path, params, query), init);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    if (options.as === 'blob') return (await response.blob()) as T;
    const type = response.headers.get('content-type') ?? '';
    return (type.includes('json') ? await response.json() : await response.text()) as T;
  }

  const payload = await response.json().catch(() => null);
  const text = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
  const message: string = text || response.statusText || `Request failed (${response.status})`;

  // The server answers unknown routes with exactly "Not found"; that means the feature is missing.
  const missing =
    [404, 405, 501].includes(response.status) && (endpoint.support === 'todo' || message === 'Not found');
  if (missing) throw new NotSupportedError(`${endpoint.method} ${endpoint.path}`);

  if (response.status === 401 && !endpoint.path.startsWith('/auth/login')) onUnauthorized?.();
  throw new ApiError(response.status, message);
}

/** Text to show a person for any thrown value. */
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong';
