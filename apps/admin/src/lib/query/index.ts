"use client";

import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Data loading for the admin screens.
 *
 * `useCmsQuery` keeps the shape the screens were written against —
 * `{ data, loading, error, reload }` — so a screen does not know or care
 * that it is now reading a real API through a cache. What it gains is
 * deduplication, background refetching and a cache that survives navigation.
 *
 * `loading` is true only for the first load of a key. A refetch keeps the
 * previous data on screen, which is what stops a list flashing empty every
 * time an editor saves something elsewhere.
 */

export type QueryState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Admin data changes because someone in this building changed it,
        // so a short window is enough to dedupe a burst of mounts without
        // ever showing an editor something stale.
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failures, error) => {
          // A rejection is an answer, not a blip: never retry it.
          const name = error instanceof Error ? error.name : "";
          if (["CmsValidationError", "CmsNotFoundError", "UnauthorisedError"].includes(name)) {
            return false;
          }
          return failures < 2;
        },
      },
    },
  });
}

export function useCmsQuery<T>(
  key: string,
  load: () => Promise<T>,
  /**
   * `refreshMs` reloads on a timer. Only for a screen somebody sits in front
   * of waiting for something to arrive — a WhatsApp conversation, or the
   * count of customers waiting for a person. Everything else reloads when
   * the window is focused, which is enough.
   */
  options: { refreshMs?: number } = {},
): QueryState<T> {
  const query = useQuery({
    queryKey: ["admin", key],
    queryFn: load,
    ...(options.refreshMs ? { refetchInterval: options.refreshMs } : {}),
  });

  const refetch = query.refetch;
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    data: query.data,
    loading: query.isPending,
    error: (query.error as Error | null) ?? null,
    reload,
  };
}

/**
 * Marks everything the admin has cached as out of date.
 *
 * A write anywhere can change what is shown anywhere else — publishing a
 * vehicle changes the fleet list, the dashboard's counts and the homepage
 * band that features it — so the API client calls this after every
 * successful write rather than each screen trying to name its neighbours.
 */
export function useInvalidateAll() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ["admin"] }), [client]);
}

/** Describes a thrown value in a sentence fit for a toast. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Nothing was changed.") {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
