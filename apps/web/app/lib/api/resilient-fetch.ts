import { peek, setCached, clearCache } from './cache';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ResilientOptions {
  method?: string;
  body?: unknown;
  token?: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 100;

const inFlight = new Map<string, Promise<unknown>>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resilientFetch<T>(path: string, options: ResilientOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const url = (options.baseUrl ?? '') + path;
  const cacheKey = `${method} ${url}`;
  const isGet = method === 'GET';

  if (isGet) {
    const hit = peek<T>(cacheKey);
    if (hit?.fresh) return hit.value;
    if (hit) {
      // Stale-while-revalidate: serve the stale value immediately and refresh
      // it in the background so the next read is fresh — the user never waits
      // on the slow API once an entry has been populated.
      refresh<T>(url, method, options, cacheKey);
      return hit.value;
    }
    const pending = inFlight.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const run = execute<T>(url, method, options, isGet, cacheKey);

  if (isGet) {
    inFlight.set(cacheKey, run);
    try {
      return await run;
    } finally {
      inFlight.delete(cacheKey);
    }
  }
  return run;
}

/**
 * Fire-and-forget background refresh for a stale cache entry. De-duped via the
 * in-flight map so concurrent stale reads trigger only one refresh, and errors
 * are swallowed — a failed refresh leaves the existing (stale) value in place,
 * so the next read serves stale and tries again (self-healing).
 */
function refresh<T>(url: string, method: string, options: ResilientOptions, cacheKey: string): void {
  if (inFlight.has(cacheKey)) return;
  const run = execute<T>(url, method, options, true, cacheKey);
  inFlight.set(cacheKey, run);
  run.catch(() => undefined).finally(() => inFlight.delete(cacheKey));
}

async function execute<T>(
  url: string,
  method: string,
  options: ResilientOptions,
  isGet: boolean,
  cacheKey: string,
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });

      if (response.status >= 500) {
        throw new ApiError(response.status, `Server error ${response.status}`);
      }
      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(response.status, text || `Request failed with ${response.status}`);
      }

      const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
      if (isGet) setCached(cacheKey, data, options.cacheTtlMs ?? DEFAULT_TTL_MS);
      return data;
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ApiError ? error.status >= 500 : true;
      if (!retryable || attempt === maxRetries) break;
      await delay(baseDelay * 2 ** attempt);
    }
  }
  throw lastError;
}

export { clearCache as invalidateCache };
