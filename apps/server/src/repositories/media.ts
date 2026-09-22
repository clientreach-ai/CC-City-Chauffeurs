import { CmsNotFoundError } from "@CC-City-Chauffeurs/core";
import type { ImageRef, MediaAsset, MediaOrigin, MediaUsage } from "@CC-City-Chauffeurs/core";
import type { MediaUpdateInput } from "@CC-City-Chauffeurs/core/schemas";
import { db, schema, type Database } from "@CC-City-Chauffeurs/db";
import { asc, desc, eq } from "drizzle-orm";

import { ConflictError } from "../lib/errors";
import { mapImageRefs } from "../lib/image-refs";
import { iso, newId, now } from "../lib/ids";
import { deleteObject, type StoredFile } from "../lib/storage";

/**
 * The media library — every photograph the editors can choose from, and
 * where each one is used.
 *
 * Routes: GET /media, GET /media/usage, GET /media/:id, GET /media/:id/usage,
 * POST /media/upload, POST /media, PATCH /media/:id, POST /media/:id/replace,
 * DELETE /media/:id.
 *
 * The file itself is the storage module's business: an upload arrives here
 * already stored, as the address and key it came back with. What this owns
 * is the record, and the one rule that keeps the website whole — a
 * photograph that a page still shows cannot be deleted, only replaced.
 */

type Row = typeof schema.mediaAsset.$inferSelect;

/** The database, or a transaction on it — the reads here work on either. */
type Reader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

function toAsset(row: Row): MediaAsset {
  return {
    id: row.id,
    src: row.src,
    key: row.key,
    width: row.width,
    height: row.height,
    alt: row.alt,
    filename: row.filename,
    origin: row.origin,
    bytes: row.bytes,
    createdAt: iso(row.createdAt),
  };
}

async function rowFor(id: string): Promise<Row> {
  const [row] = await db.select().from(schema.mediaAsset).where(eq(schema.mediaAsset.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This photograph");
  return row;
}

/** Newest first; the website's original photography, seeded on one date, sits together at the end. */
export async function getMedia(): Promise<MediaAsset[]> {
  const rows = await db
    .select()
    .from(schema.mediaAsset)
    .orderBy(desc(schema.mediaAsset.createdAt), asc(schema.mediaAsset.filename));
  return rows.map(toAsset);
}

export async function getAsset(id: string): Promise<MediaAsset> {
  return toAsset(await rowFor(id));
}

export async function createMedia(
  input: {
    src: string;
    key: string | null;
    width: number;
    height: number;
    alt: string;
    filename: string;
    bytes: number | null;
  },
  origin: MediaOrigin = "local",
): Promise<MediaAsset> {
  const id = newId("media");
  await db.insert(schema.mediaAsset).values({ ...input, id, origin });
  return getAsset(id);
}

/** The description and the name are the library's own; each use keeps its own description. */
export async function updateMedia(id: string, input: MediaUpdateInput): Promise<MediaAsset> {
  await rowFor(id);
  await db
    .update(schema.mediaAsset)
    .set({ alt: input.alt, filename: input.filename })
    .where(eq(schema.mediaAsset.id, id));
  return getAsset(id);
}

// ---------------------------------------------------------------- where used

/**
 * A record on the website that carries photographs: what it is called, whether
 * it is live, and its documents by column. Read once and matched in memory —
 * there are a few dozen of them, and the alternative is a JSON path query per
 * column per table.
 */
type Holder = {
  kind: MediaUsage["kind"];
  id: string;
  label: string;
  published: boolean;
  documents: Record<string, unknown>;
  /** What a path inside a document is called on screen. */
  slot: (column: string, path: string) => string;
};

const ordinal = (path: string, prefix: string) => {
  const index = Number(path.slice(prefix.length));
  return Number.isInteger(index) ? `Gallery, photograph ${index + 1}` : path;
};

async function loadHolders(reader: Reader = db): Promise<Holder[]> {
  const [vehicles, services, photographs, sections, settings] = await Promise.all([
    reader
      .select({
        id: schema.vehicle.id,
        name: schema.vehicle.name,
        status: schema.vehicle.status,
        images: schema.vehicle.images,
        seo: schema.vehicle.seo,
      })
      .from(schema.vehicle),
    reader
      .select({
        id: schema.service.id,
        name: schema.service.name,
        status: schema.service.status,
        heroImage: schema.service.heroImage,
        detail: schema.service.detail,
        gallery: schema.service.gallery,
        seo: schema.service.seo,
      })
      .from(schema.service),
    reader
      .select({
        id: schema.galleryItem.id,
        image: schema.galleryItem.image,
        caption: schema.galleryItem.caption,
        status: schema.galleryItem.status,
      })
      .from(schema.galleryItem),
    reader
      .select({
        id: schema.homepageSection.id,
        name: schema.homepageSection.name,
        visible: schema.homepageSection.visible,
        data: schema.homepageSection.data,
      })
      .from(schema.homepageSection),
    reader.select({ id: schema.siteSettings.id, seo: schema.siteSettings.seo }).from(schema.siteSettings),
  ]);

  return [
    ...vehicles.map<Holder>((row) => ({
      kind: "vehicle",
      id: row.id,
      label: row.name,
      published: row.status === "published",
      documents: { images: row.images, seo: row.seo },
      slot: (column, path) => {
        if (column === "images" && path === "main") return "Main photograph";
        if (column === "images" && path.startsWith("gallery.")) return ordinal(path, "gallery.");
        if (column === "seo") return "Share image";
        return `${column}.${path}`;
      },
    })),
    ...services.map<Holder>((row) => ({
      kind: "service",
      id: row.id,
      label: row.name,
      published: row.status === "published",
      documents: { heroImage: row.heroImage, detail: row.detail, gallery: row.gallery, seo: row.seo },
      slot: (column, path) => {
        if (column === "heroImage") return "Hero photograph";
        if (column === "detail") return "Detail photograph";
        if (column === "gallery") return ordinal(path, "");
        if (column === "seo") return "Share image";
        return `${column}.${path}`;
      },
    })),
    ...photographs.map<Holder>((row) => ({
      kind: "gallery",
      id: row.id,
      label: row.image.alt || row.caption || "Photograph without a description",
      published: row.status === "published",
      documents: { image: row.image },
      slot: () => "Gallery photograph",
    })),
    ...sections.map<Holder>((row) => ({
      kind: "homepage",
      id: row.id,
      label: row.name,
      published: row.visible,
      documents: { data: row.data },
      slot: (_column, path) => {
        if (path === "image") return "Photograph";
        const panel = /^panels\.(\d+)\.image$/.exec(path);
        if (panel) return `Panel ${Number(panel[1]) + 1} photograph`;
        return path;
      },
    })),
    ...settings.map<Holder>((row) => ({
      kind: "settings",
      id: row.id,
      label: "Site settings",
      published: true,
      documents: { seo: row.seo },
      slot: () => "Share image",
    })),
  ];
}

/**
 * Whether a reference is this photograph. The address is what actually ties
 * them: a reference made by hand, or seeded before the library existed,
 * carries no asset id but still points at the same file.
 */
function refersTo(ref: ImageRef, asset: Pick<MediaAsset, "id" | "src">) {
  return ref.src === asset.src || (ref.assetId != null && ref.assetId === asset.id);
}

function usagesFor(holders: Holder[], asset: Pick<MediaAsset, "id" | "src">): MediaUsage[] {
  const usages: MediaUsage[] = [];
  for (const holder of holders) {
    for (const [column, document] of Object.entries(holder.documents)) {
      mapImageRefs(document, (ref, path) => {
        if (refersTo(ref, asset)) {
          usages.push({
            kind: holder.kind,
            id: holder.id,
            label: holder.label,
            slot: holder.slot(column, path),
            published: holder.published,
          });
        }
        return null;
      });
    }
  }
  return usages;
}

/** Every place each photograph is used, keyed by photograph. Unused photographs are absent. */
export async function getAllUsage(): Promise<Record<string, MediaUsage[]>> {
  const [rows, holders] = await Promise.all([db.select().from(schema.mediaAsset), loadHolders()]);
  const usage: Record<string, MediaUsage[]> = {};
  for (const row of rows) {
    const found = usagesFor(holders, row);
    if (found.length) usage[row.id] = found;
  }
  return usage;
}

export async function getUsage(id: string): Promise<MediaUsage[]> {
  const row = await rowFor(id);
  return usagesFor(await loadHolders(), row);
}

// ---------------------------------------------------------------- rewriting

/**
 * Passes every photograph reference on the website through `fn`, and writes
 * back only the rows that changed. `fn` returns the replacement, or null to
 * leave a reference as it is. Returns how many references changed.
 *
 * Used by "replace" below, and by the one-off move of the website's own
 * photography into the bucket.
 */
export async function rewriteImageRefs(
  reader: Reader,
  fn: (ref: ImageRef) => ImageRef | null,
): Promise<number> {
  let changed = 0;
  const rewrite = <T>(document: T): T => {
    return mapImageRefs(document, (ref) => {
      const next = fn(ref);
      if (next) changed += 1;
      return next;
    });
  };
  const stamp = now();

  for (const row of await reader.select().from(schema.vehicle)) {
    const images = rewrite(row.images);
    const seo = rewrite(row.seo);
    if (images === row.images && seo === row.seo) continue;
    await reader.update(schema.vehicle).set({ images, seo, updatedAt: stamp }).where(eq(schema.vehicle.id, row.id));
  }

  for (const row of await reader.select().from(schema.service)) {
    const heroImage = rewrite(row.heroImage);
    const detail = rewrite(row.detail);
    const gallery = rewrite(row.gallery);
    const seo = rewrite(row.seo);
    if (heroImage === row.heroImage && detail === row.detail && gallery === row.gallery && seo === row.seo) continue;
    await reader
      .update(schema.service)
      .set({ heroImage, detail, gallery, seo, updatedAt: stamp })
      .where(eq(schema.service.id, row.id));
  }

  for (const row of await reader.select().from(schema.galleryItem)) {
    const image = rewrite(row.image);
    if (image === row.image) continue;
    await reader.update(schema.galleryItem).set({ image, updatedAt: stamp }).where(eq(schema.galleryItem.id, row.id));
  }

  for (const row of await reader.select().from(schema.homepageSection)) {
    const data = rewrite(row.data);
    if (data === row.data) continue;
    await reader
      .update(schema.homepageSection)
      .set({ data, updatedAt: stamp })
      .where(eq(schema.homepageSection.id, row.id));
  }

  for (const row of await reader.select().from(schema.siteSettings)) {
    const seo = rewrite(row.seo);
    if (seo === row.seo) continue;
    await reader.update(schema.siteSettings).set({ seo, updatedAt: stamp }).where(eq(schema.siteSettings.id, row.id));
  }

  return changed;
}

/**
 * A new file takes this photograph's place everywhere it is used.
 *
 * The record keeps its name and description — those are the library's — and
 * every reference keeps the description written for that page. What changes
 * is the file: its address, its key and its dimensions, in the record and in
 * every reference, in one transaction. The old file is removed from the
 * bucket only once that has committed; nothing points at it by then.
 */
export async function replaceMedia(
  id: string,
  stored: StoredFile,
): Promise<{ asset: MediaAsset; replaced: number }> {
  const current = await rowFor(id);

  const replaced = await db.transaction(async (tx) => {
    await tx
      .update(schema.mediaAsset)
      .set({
        src: stored.src,
        key: stored.key,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
      })
      .where(eq(schema.mediaAsset.id, id));

    return rewriteImageRefs(tx, (ref) =>
      refersTo(ref, current)
        ? { ...ref, src: stored.src, width: stored.width, height: stored.height, assetId: id }
        : null,
    );
  });

  if (current.key && current.key !== stored.key) await deleteObject(current.key);

  return { asset: await getAsset(id), replaced };
}

/** Reads as a sentence: "the Rolls-Royce Cullinan (Main photograph) and 2 other places". */
function describe(usages: MediaUsage[]) {
  const named = usages.slice(0, 2).map((usage) => `${usage.label} (${usage.slot.toLowerCase()})`);
  const more = usages.length - named.length;
  const list = more > 0 ? `${named.join(", ")} and ${more} other ${more === 1 ? "place" : "places"}` : named.join(" and ");
  return `This photograph is still used by ${list}. Replace it, or remove it there first.`;
}

/**
 * A photograph nothing points at can go; one a page still shows cannot,
 * because the page would be left with a broken image. The file leaves the
 * bucket only after the record has.
 */
export async function deleteMedia(id: string): Promise<void> {
  const row = await rowFor(id);
  const usages = usagesFor(await loadHolders(), row);
  if (usages.length) throw new ConflictError(describe(usages));

  await db.delete(schema.mediaAsset).where(eq(schema.mediaAsset.id, id));
  if (row.key) await deleteObject(row.key);
}
