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

  it('204 returns undefined', async () => {
    server.use(
      http.get(`${BASE}/gardens`, () => new HttpResponse(null, { status: 204 })),
    );
    const data = await resilientFetch('/gardens', opts);
    expect(data).toBeUndefined();
  });

  it('network errors are retried then succeed', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/gardens`, () => {
        calls += 1;
        if (calls < 3) return HttpResponse.error();
        return HttpResponse.json([{ gardenId: 1 }]);
      }),
    );
    const data = await resilientFetch<{ gardenId: number }[]>('/gardens', opts);
    expect(data).toEqual([{ gardenId: 1 }]);
    expect(calls).toBeGreaterThan(1);
  });
});

describe('stale-while-revalidate', () => {
  it('serves stale data immediately and refreshes in the background', async () => {
    let calls = 0;
    let body = 'v1';
    server.use(
      http.get(`${BASE}/g`, () => {
        calls += 1;
        return HttpResponse.json(body);
      }),
    );
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);

    expect(await resilientFetch('/g', opts)).toBe('v1'); // cold fetch caches v1 (fresh)
    expect(calls).toBe(1);

    now.mockReturnValue(1_000 + 31_000); // past the 30s TTL → stale
    body = 'v2';
    expect(await resilientFetch('/g', opts)).toBe('v1'); // stale served immediately
    await vi.waitFor(() => expect(calls).toBe(2)); // background refresh ran

    expect(await resilientFetch('/g', opts)).toBe('v2'); // cache now fresh with v2
  });

  it('fires only one background refresh for concurrent stale reads', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/g`, () => {
        calls += 1;
        return HttpResponse.json('v');
      }),
    );
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    await resilientFetch('/g', opts); // calls = 1
    now.mockReturnValue(1_000 + 31_000); // stale

    await Promise.all([
      resilientFetch('/g', opts),
      resilientFetch('/g', opts),
      resilientFetch('/g', opts),
    ]);
    await vi.waitFor(() => expect(calls).toBe(2)); // one refresh, not three
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(2); // and no extra refreshes leaked in
  });

  it('keeps serving stale data when the background refresh fails', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/g`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json('v1') : new HttpResponse(null, { status: 500 });
      }),
    );
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    await resilientFetch('/g', opts); // v1 cached
    now.mockReturnValue(1_000 + 31_000); // stale

    expect(await resilientFetch('/g', opts)).toBe('v1'); // stale served; bg refresh will 500
    await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(2)); // refresh attempted
    expect(await resilientFetch('/g', opts)).toBe('v1'); // still stale (failed refresh kept old value)
  });
});
