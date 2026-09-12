"use client";

import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";

import { databaseRevision, subscribeDatabase } from "./store/database";

/**
 * Data hooks for the admin screens.
 *
 * `useCmsQuery` loads through a repository function and loads again whenever
 * anything in the CMS changes, so a list is current the moment an editor
 * saves elsewhere. With a real API this becomes a cache (SWR, TanStack Query)
 * keyed the same way; the screens keep the same `{ data, loading, error }`.
 */

export type QueryState<T> = {
  data: T | undefined;
  /** True only for the first load — later refreshes keep showing data. */
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useCmsRevision() {
  return useSyncExternalStore(subscribeDatabase, databaseRevision, () => 0);
}

export function useCmsQuery<T>(key: string, load: () => Promise<T>): QueryState<T> {
  const revision = useCmsRevision();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | undefined; error: Error | null; settled: boolean }>({
    key,
    data: undefined,
    error: null,
    settled: false,
  });

  const run = useEffectEvent(() => load());

  useEffect(() => {
    let cancelled = false;
    run().then(
      (data) => {
        if (!cancelled) setState({ key, data, error: null, settled: true });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState((previous) => ({
            key,
            data: previous.key === key ? previous.data : undefined,
            error: error instanceof Error ? error : new Error(String(error)),
            settled: true,
          }));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, revision, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === key;

  return {
    data: current ? state.data : undefined,
    loading: !current || !state.settled,
    error: current ? state.error : null,
    reload,
  };
}

/** Describes a thrown value in a sentence fit for a toast. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Nothing was changed.") {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
