import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { resilientFetch, ApiError } from './resilient-fetch';
import { clearCache } from './cache';

const BASE = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  clearCache();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const opts = { baseUrl: BASE, retryBaseDelayMs: 1 };

describe('resilientFetch', () => {
  it('retries on 500 then succeeds', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/gardens`, () => {
        calls += 1;
        if (calls < 3) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json([{ gardenId: 1 }]);
      }),
    );
    const data = await resilientFetch<{ gardenId: number }[]>('/gardens', opts);
    expect(data).toEqual([{ gardenId: 1 }]);
    expect(calls).toBe(3);
  });

  it('throws ApiError after exhausting retries', async () => {
    server.use(http.get(`${BASE}/gardens`, () => new HttpResponse(null, { status: 500 })));
    await expect(resilientFetch('/gardens', { ...opts, maxRetries: 2 })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('does not retry a 4xx and surfaces the body', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/plants`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'Validation error' }, { status: 400 });
      }),
    );
    await expect(
      resilientFetch('/plants', { ...opts, method: 'POST', body: { a: 1 } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });

  it('caches GET responses within the TTL (one network call for two reads)', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/gardens`, () => {
        calls += 1;
        return HttpResponse.json([{ gardenId: 1 }]);
      }),
    );
    await resilientFetch('/gardens', opts);
    await resilientFetch('/gardens', opts);
    expect(calls).toBe(1);
  });

  it('de-dups concurrent identical GETs', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/gardens`, async () => {
        calls += 1;
        return HttpResponse.json([{ gardenId: 1 }]);
      }),
    );
    await Promise.all([resilientFetch('/gardens', opts), resilientFetch('/gardens', opts)]);
    expect(calls).toBe(1);
  });

  it('attaches the bearer token', async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/gardens`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json([]);
      }),
    );
    await resilientFetch('/gardens', { ...opts, token: 'dev-secret' });
    expect(auth).toBe('Bearer dev-secret');
  });
});
