import type { QueryClient } from "@tanstack/react-query";

/**
 * The browser's one query cache.
 *
 * Held at module scope so the API client can reach it without a hook: a
 * successful write needs to mark the cache out of date, and it happens deep
 * inside a repository call rather than in a component.
 */

let client: QueryClient | null = null;

export function setQueryClient(next: QueryClient) {
  client = next;
}

/**
 * Marks everything the admin has cached as out of date, after a write.
 *
 * Deliberately broad: publishing a vehicle changes the fleet list, the
 * dashboard's counts, the grouping it belongs to and the homepage band that
 * features it. Naming those relationships at every call site is how they get
 * missed, so a write invalidates the admin's cache and the screens that are
 * mounted refetch.
 */
export function invalidateAdmin() {
  void client?.invalidateQueries({ queryKey: ["admin"] });
}
