import { describe, it, expect, afterEach, vi } from 'vitest';
import { peek, setCached, clearCache } from './cache';

afterEach(() => {
  clearCache();
  vi.restoreAllMocks();
});

describe('cache', () => {
  it('returns a fresh entry before it expires', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    setCached('k', { a: 1 }, 5000);
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    expect(peek('k')).toEqual({ value: { a: 1 }, fresh: true });
  });

  it('returns the value marked stale after the TTL passes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    setCached('k', { a: 1 }, 5000);
    vi.spyOn(Date, 'now').mockReturnValue(7000);
    expect(peek('k')).toEqual({ value: { a: 1 }, fresh: false });
  });

  it('returns undefined for an unknown key', () => {
    expect(peek('missing')).toBeUndefined();
  });
});
