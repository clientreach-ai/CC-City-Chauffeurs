import { buildSampleOperations } from "../seed/operations";
import type {
  Booking,
  ContentSeed,
  Customer,
  Enquiry,
} from "../types";

/**
 * The mock database — the one piece that is replaced when a real backend
 * exists.
 *
 * It keeps every collection in memory and mirrors it to this browser's
 * localStorage, so edits survive a reload but never leave the device and
 * never reach the live website. Repositories are the only callers; screens
 * never touch it directly.
 *
 * The content collections are seeded from the public site's own data (built
 * on the server — see `seed/content.ts`); operations are sample records. If
 * the site's content changes in a new deploy, the stored copy is discarded
 * and re-seeded so the admin never shows stale content as current.
 */

export type Tables = Omit<ContentSeed, never> & {
  enquiries: Enquiry[];
  bookings: Booking[];
  customers: Customer[];
};

type Stored = {
  schema: number;
  /** Fingerprint of the content seed the stored data was built from. */
  seed: string;
  savedAt: string;
  data: Tables;
};

const STORAGE_KEY = "cc-admin:database";
/** Bump when the shape of `Tables` changes incompatibly. */
const SCHEMA_VERSION = 1;

type Listener = () => void;

export type PersistenceState =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "quota" };

class MockDatabase {
  private data: Tables;
  private listeners = new Set<Listener>();
  private revision = 0;
  persistence: PersistenceState = { ok: true };

  constructor(
    private readonly seed: ContentSeed,
    private readonly fingerprint: string,
  ) {
    this.data = this.load() ?? this.fresh();
  }

  private fresh(): Tables {
    return structuredClone({ ...this.seed, ...buildSampleOperations() });
  }

  private load(): Tables | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const stored = JSON.parse(raw) as Stored;
      if (stored.schema !== SCHEMA_VERSION || stored.seed !== this.fingerprint) return null;
      return stored.data;
    } catch {
      return null;
    }
  }

  private persist() {
    try {
      const stored: Stored = {
        schema: SCHEMA_VERSION,
        seed: this.fingerprint,
        savedAt: new Date().toISOString(),
        data: this.data,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      this.persistence = { ok: true };
    } catch (error) {
      const quota = error instanceof DOMException && /quota/i.test(error.name + error.message);
      this.persistence = { ok: false, reason: quota ? "quota" : "unavailable" };
      if (quota) throw new StorageFullError();
    }
  }

  /** A deep copy — callers can never mutate stored records by accident. */
  read<K extends keyof Tables>(table: K): Tables[K] {
    return structuredClone(this.data[table]);
  }

  /**
   * Applies a change to a working copy, persists it, then publishes it. If
   * persisting fails the change is rolled back, so memory and storage never
   * disagree.
   */
  write(mutate: (draft: Tables) => void) {
    const previous = this.data;
    const draft = structuredClone(this.data);
    mutate(draft);
    this.data = draft;
    try {
      this.persist();
    } catch (error) {
      this.data = previous;
      throw error;
    }
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }

  /** Discards every local change and starts again from the seed. */
  reset() {
    this.data = this.fresh();
    this.persist();
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRevision() {
    return this.revision;
  }
}

export class StorageFullError extends Error {
  constructor() {
    super(
      "This browser's preview storage is full. Remove some locally previewed images and try again.",
    );
    this.name = "StorageFullError";
  }
}

// ------------------------------------------------------------------ access

let configuredSeed: ContentSeed | null = null;
let database: MockDatabase | null = null;

/**
 * Called by the admin shell with the server-built seed. Idempotent, and cheap
 * to call on every render: the database itself is only created on first use.
 */
export function configureDatabase(seed: ContentSeed) {
  configuredSeed ??= seed;
}

function fingerprint(seed: ContentSeed) {
  // djb2 over the serialised seed: content changes produce a new value.
  const text = JSON.stringify(seed);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

export function getDatabase() {
  if (typeof window === "undefined") {
    throw new Error("The mock database runs in the browser only.");
  }
  if (!database) {
    if (!configuredSeed) throw new Error("The CMS has not been configured with its seed.");
    database = new MockDatabase(configuredSeed, fingerprint(configuredSeed));
  }
  return database;
}

export function subscribeDatabase(listener: Listener) {
  if (typeof window === "undefined" || !configuredSeed) return () => {};
  return getDatabase().subscribe(listener);
}

export function databaseRevision() {
  return database?.getRevision() ?? 0;
}

// ------------------------------------------------------------------ helpers

/** Simulated network time, so loading and saving states are exercised. */
const LATENCY = { read: 140, write: 320 } as const;

export function latency(kind: keyof typeof LATENCY) {
  const jitter = Math.round(Math.random() * 80);
  return new Promise<void>((resolve) => setTimeout(resolve, LATENCY[kind] + jitter));
}

export function newId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function now() {
  return new Date().toISOString();
}
