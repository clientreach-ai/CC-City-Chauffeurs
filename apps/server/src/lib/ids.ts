import { randomUUID } from "node:crypto";

/**
 * Readable, sortable-enough identifiers.
 *
 * Seeded records keep the ids the website already uses ("cullinan",
 * "weddings") so links stay stable; anything created later gets a prefixed
 * random id, which makes a row's type obvious in a log or a URL.
 */
export function newId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function now() {
  return new Date();
}

/** The domain contract speaks ISO-8601 strings; Postgres speaks Date. */
export function iso(value: Date | string | null | undefined): string {
  if (value == null) return "";
  return value instanceof Date ? value.toISOString() : value;
}

export function isoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}
