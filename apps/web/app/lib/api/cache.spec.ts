import { describe, it, expect, afterEach, vi } from 'vitest';
import { getCached, setCached, clearCache } from './cache';

afterEach(() => {
  clearCache();
  vi.restoreAllMocks();
});

describe('cache', () => {
  it('returns a stored value before it expires', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    setCached('k', { a: 1 }, 5000);
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    expect(getCached('k')).toEqual({ a: 1 });
  });

  it('returns undefined after the TTL passes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    setCached('k', { a: 1 }, 5000);
    vi.spyOn(Date, 'now').mockReturnValue(7000);
    expect(getCached('k')).toBeUndefined();
  });

  it('returns undefined for an unknown key', () => {
    expect(getCached('missing')).toBeUndefined();
  });
});
