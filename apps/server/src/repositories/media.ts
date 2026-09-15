import { CmsNotFoundError } from "@CC-City-Chauffeurs/core";
import type { MediaAsset } from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { and, desc, eq } from "drizzle-orm";

import { iso, newId } from "../lib/ids";

/**
 * The media library — every photograph the editors can choose from.
 *
 * Routes: GET /media, POST /media, DELETE /media/:id.
 *
 * Uploads are recorded, not performed: the caller stores the file (today the
 * admin keeps a reduced preview; tomorrow a signed PUT to object storage) and
 * registers the resulting address here. That seam is why swapping in R2 or S3
 * changes this file not at all.
 */

type Row = typeof schema.mediaAsset.$inferSelect;

function toAsset(row: Row): MediaAsset {
  return {
    id: row.id,
    src: row.src,
    width: row.width,
    height: row.height,
    alt: row.alt,
    filename: row.filename,
    origin: row.origin,
    bytes: row.bytes,
    createdAt: iso(row.createdAt),
  };
}

export async function getMedia(): Promise<MediaAsset[]> {
  const rows = await db.select().from(schema.mediaAsset).orderBy(desc(schema.mediaAsset.createdAt));
  const assets = rows.map(toAsset);
  // Newest uploads first, then the website's own photography.
  return [
    ...assets.filter((asset) => asset.origin === "local"),
    ...assets.filter((asset) => asset.origin === "site"),
  ];
}

export async function createMedia(input: {
  src: string;
  width: number;
  height: number;
  alt: string;
  filename: string;
  bytes: number | null;
}): Promise<MediaAsset> {
  const id = newId("media");
  await db.insert(schema.mediaAsset).values({ ...input, id, origin: "local" });
  const [row] = await db.select().from(schema.mediaAsset).where(eq(schema.mediaAsset.id, id)).limit(1);
  return toAsset(row!);
}

/** The website's own photography belongs to the codebase, not to the admin. */
export async function deleteMedia(id: string): Promise<void> {
  const [row] = await db.select().from(schema.mediaAsset).where(eq(schema.mediaAsset.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This image");
  await db
    .delete(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.id, id), eq(schema.mediaAsset.origin, "local")));
}
