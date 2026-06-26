import { getCached, setCached, clearCache } from './cache';

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
    const cached = getCached<T>(cacheKey);
    if (cached !== undefined) return cached;
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
