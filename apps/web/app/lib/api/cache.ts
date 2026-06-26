interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

/**
 * Return the cached entry if present, with whether it is still fresh. Stale
 * entries are kept (not deleted) so the caller can serve them while a
 * background refresh runs (stale-while-revalidate).
 */
export function peek<T>(key: string): { value: T; fresh: boolean } | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  return { value: entry.value as T, fresh: Date.now() <= entry.expiresAt };
}

export function setCached(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}
