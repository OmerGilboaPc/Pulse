import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { clearMemo } from '../services/content';

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Re-fetching while showing existing data. */
  refreshing: boolean;
  /** When `data` was fetched from the network. */
  updatedAt: number | undefined;
  /** Data came from the offline cache because the network call failed. */
  stale: boolean;
  refresh: () => void;
}

const memory = new Map<string, { data: unknown; at: number }>();

/** Drop all cached query results (used after keys/sources change). */
export async function invalidateQueries(prefix = '') {
  clearMemo();
  for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  try {
    if (!prefix) await db.cache.clear();
    else await db.cache.where('key').startsWith(prefix).delete();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('pulse:invalidate', { detail: prefix }));
}

/**
 * Stale-while-revalidate data hook backed by IndexedDB, so screens render
 * instantly from the last good response and keep working offline.
 */
export function useQuery<T>(key: string | null, fn: () => Promise<T>, ttlMs = 15 * 60_000): QueryState<T> {
  const [state, setState] = useState<Omit<QueryState<T>, 'refresh'>>(() => {
    const m = key ? memory.get(key) : undefined;
    return {
      data: m?.data as T | undefined,
      error: undefined,
      loading: !!key && !m,
      refreshing: false,
      updatedAt: m?.at,
      stale: false,
    };
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      if (!key) {
        setState({ data: undefined, error: undefined, loading: false, refreshing: false, updatedAt: undefined, stale: false });
        return;
      }
      const id = ++run.current;
      let cached = memory.get(key);
      if (!cached) {
        try {
          const row = await db.cache.get(key);
          if (row) {
            cached = { data: row.data, at: row.at };
            memory.set(key, cached);
          }
        } catch {
          /* ignore */
        }
      }
      if (id !== run.current) return;
      const fresh = cached && Date.now() - cached.at < ttlMs;
      setState((s) => ({
        ...s,
        data: (cached?.data as T) ?? undefined,
        updatedAt: cached?.at,
        loading: !cached,
        refreshing: !!cached && (force || !fresh),
        error: undefined,
        stale: false,
      }));
      if (fresh && !force) return;
      try {
        const data = await fnRef.current();
        const at = Date.now();
        memory.set(key, { data, at });
        void db.cache.put({ key, data, at }).catch(() => undefined);
        if (id !== run.current) return;
        setState({ data, error: undefined, loading: false, refreshing: false, updatedAt: at, stale: false });
      } catch (error) {
        if (id !== run.current) return;
        setState((s) => ({ ...s, error, loading: false, refreshing: false, stale: s.data !== undefined }));
      }
    },
    [key, ttlMs],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const onInvalidate = (e: Event) => {
      const prefix = (e as CustomEvent<string>).detail ?? '';
      if (key && key.startsWith(prefix)) void load(true);
    };
    const onOnline = () => {
      if (state.error) void load(true);
    };
    window.addEventListener('pulse:invalidate', onInvalidate);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pulse:invalidate', onInvalidate);
      window.removeEventListener('online', onOnline);
    };
  }, [key, load, state.error]);

  const refresh = useCallback(() => void load(true), [load]);
  return { ...state, refresh };
}
