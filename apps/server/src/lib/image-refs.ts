import type { ImageRef } from "@CC-City-Chauffeurs/core";

/**
 * Finding and rewriting photograph references inside stored documents.
 *
 * A vehicle's image set, a service's gallery, a homepage band's panels: the
 * records that carry photographs keep them as `ImageRef` objects inside
 * `jsonb` documents of different shapes. Rather than teach every caller the
 * shape of every document, these walk any document and act on whatever has
 * the shape of a reference — a `src`, a `width` and a `height`.
 */

export function isImageRef(value: unknown): value is ImageRef {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<ImageRef>;
  return (
    typeof candidate.src === "string" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

export type FoundRef = {
  ref: ImageRef;
  /** Where in the document it sits, e.g. "images.gallery.2". */
  path: string;
};

/** Every photograph reference in a document, with the path it sits at. */
export function findImageRefs(value: unknown, path: string[] = []): FoundRef[] {
  if (isImageRef(value)) return [{ ref: value, path: path.join(".") }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findImageRefs(item, [...path, String(index)]));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => findImageRefs(item, [...path, key]));
  }
  return [];
}

/**
 * A copy of a document with every photograph reference passed through `fn`.
 * `fn` returns the replacement, or null to leave that reference alone.
 *
 * Returns the very same object when nothing changed, so a caller can tell
 * with `===` whether the row needs writing back.
 */
export function mapImageRefs<T>(value: T, fn: (ref: ImageRef, path: string) => ImageRef | null): T {
  return walk(value, [], fn) as T;
}

function walk(value: unknown, path: string[], fn: (ref: ImageRef, path: string) => ImageRef | null): unknown {
  if (isImageRef(value)) return fn(value, path.join(".")) ?? value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item, index) => {
      const result = walk(item, [...path, String(index)], fn);
      if (result !== item) changed = true;
      return result;
    });
    return changed ? next : value;
  }

  if (typeof value === "object" && value !== null) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const result = walk(item, [...path, key], fn);
      if (result !== item) changed = true;
      next[key] = result;
    }
    return changed ? next : value;
  }

  return value;
}
