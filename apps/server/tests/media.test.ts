/**
 * The media library, and the one rule that keeps the website whole: a
 * photograph a page still shows cannot be deleted, only replaced — and a
 * replacement reaches every page that showed the old one.
 *
 * The bucket is replaced with a map: what is under test is the record, the
 * lookup and the rewrite, none of which care where the bytes went.
 */

import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import type { ImageRef } from "@CC-City-Chauffeurs/core";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

/** What the fake bucket has been asked to do. */
const bucket = { objects: new Map<string, string>(), deleted: [] as string[] };

let database: TestDatabase;
let media: typeof import("../src/repositories/media");
let schema: typeof import("@CC-City-Chauffeurs/db/schema/index");
let realStorage: typeof import("../src/lib/storage");
let findImageRefs: typeof import("../src/lib/image-refs").findImageRefs;
let mapImageRefs: typeof import("../src/lib/image-refs").mapImageRefs;

beforeAll(async () => {
  // Imported here, not at the top: a static import would run before the
  // test environment is set and read the developer's own .env instead.
  realStorage = await import("../src/lib/storage");
  ({ findImageRefs, mapImageRefs } = await import("../src/lib/image-refs"));

  mock.module("../src/lib/storage", () => ({
    ...realStorage,
    putObject: async (key: string, _data: unknown, type: string) => {
      bucket.objects.set(key, type);
    },
    objectExists: async (key: string) => bucket.objects.has(key),
    deleteObject: async (key: string) => {
      bucket.objects.delete(key);
      bucket.deleted.push(key);
    },
    listObjects: async () => [...bucket.objects.keys()].map((key) => ({ key, size: 0 })),
  }));

  database = await startDatabase();
  media = await import("../src/repositories/media");
  schema = await import("@CC-City-Chauffeurs/db/schema/index");
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  bucket.objects.clear();
  bucket.deleted.length = 0;
  await database.client.exec(`
    truncate table gallery_item_service, gallery_item, gallery_row, service_vehicle, vehicle_category,
      vehicle_feature_link, vehicle, service, homepage_section, site_settings, media_asset cascade;
  `);
});

const OLD = "https://files.example.test/test-site/uploads/old.jpg";
const ref = (src: string, alt = "", assetId?: string): ImageRef => ({ src, width: 1600, height: 1000, alt, ...(assetId ? { assetId } : {}) });

/** A photograph in the library, used by a vehicle (by address only), a gallery photograph (by id) and a homepage band. */
async function seedUsage() {
  const db = database.db;
  await db.insert(schema.mediaAsset).values({
    id: "media-1",
    src: OLD,
    key: "test-site/uploads/old.jpg",
    width: 1600,
    height: 1000,
    alt: "A car",
    filename: "old.jpg",
    origin: "local",
    bytes: 1000,
  });
  bucket.objects.set("test-site/uploads/old.jpg", "image/jpeg");

  await db.insert(schema.vehicle).values({
    id: "cullinan",
    slug: "cullinan",
    name: "Rolls-Royce Cullinan",
    status: "published",
    images: { main: ref(OLD, "Cullinan outside a hotel"), gallery: [ref("https://elsewhere.test/other.jpg"), ref(OLD, "Second")] },
  });
  await db.insert(schema.galleryRow).values({ id: "row-1", label: "Cullinan" });
  await db.insert(schema.galleryItem).values({
    id: "gal-1",
    image: ref("https://files.example.test/test-site/uploads/renamed.jpg", "Night", "media-1"),
    rowId: "row-1",
    status: "draft",
  });
  await db.insert(schema.homepageSection).values({
    id: "hero",
    kind: "hero",
    name: "Hero",
    visible: true,
    data: { eyebrow: "", image: ref(OLD, "Hero"), panels: [] },
  });
}

test("keys and addresses round-trip through the prefix", () => {
  const key = realStorage.objectKey("/media/fleet cullinan.jpg");
  expect(key).toBe("test-site/media/fleet cullinan.jpg");
  const src = realStorage.publicUrl(key);
  expect(src).toBe("https://files.example.test/test-site/media/fleet%20cullinan.jpg");
  expect(realStorage.keyFromSrc(src)).toBe(key);
  expect(realStorage.keyFromSrc("https://elsewhere.test/x.jpg")).toBeNull();
  expect(realStorage.keyFromSrc("https://files.example.test/other-site/x.jpg")).toBeNull();
});

test("photograph references are found wherever they sit in a document", () => {
  const document = {
    heading: "x",
    image: ref("a"),
    panels: [{ image: null }, { image: ref("b") }],
    nested: { deeper: { gallery: [ref("c")] } },
  };
  expect(findImageRefs(document).map((found) => `${found.path}=${found.ref.src}`)).toEqual([
    "image=a",
    "panels.1.image=b",
    "nested.deeper.gallery.0=c",
  ]);

  const untouched = mapImageRefs(document, () => null);
  expect(untouched).toBe(document);

  const changed = mapImageRefs(document, (found) => (found.src === "b" ? { ...found, src: "B" } : null));
  expect(changed).not.toBe(document);
  expect(changed.panels[1]?.image?.src).toBe("B");
  expect(changed.image).toBe(document.image);
});

test("where a photograph is used is read from every kind of record", async () => {
  await seedUsage();
  const usage = await media.getUsage("media-1");
  expect(usage.map((use) => `${use.kind}:${use.label}:${use.slot}:${use.published}`).sort()).toEqual(
    [
      "vehicle:Rolls-Royce Cullinan:Main photograph:true",
      "vehicle:Rolls-Royce Cullinan:Gallery, photograph 2:true",
      "gallery:Night:Gallery photograph:false",
      "homepage:Hero:Photograph:true",
    ].sort(),
  );

  const all = await media.getAllUsage();
  expect(Object.keys(all)).toEqual(["media-1"]);
});

test("a photograph a page still shows cannot be deleted", async () => {
  await seedUsage();
  await expect(media.deleteMedia("media-1")).rejects.toMatchObject({
    name: "ConflictError",
    message: expect.stringContaining("Rolls-Royce Cullinan (main photograph)"),
  });
  expect(await media.getAsset("media-1")).toBeTruthy();
  expect(bucket.deleted).toEqual([]);
});

test("replacing a photograph reaches every page that showed it, and keeps each page's description", async () => {
  await seedUsage();
  const stored = {
    src: "https://files.example.test/test-site/uploads/new.avif",
    key: "test-site/uploads/new.avif",
    width: 3000,
    height: 2000,
    filename: "IMG_0001.avif",
    bytes: 2_000_000,
  };
  const { asset, replaced } = await media.replaceMedia("media-1", stored);

  expect(replaced).toBe(4);
  // The record keeps the library's own name and description; the file changes.
  expect(asset).toMatchObject({ src: stored.src, key: stored.key, width: 3000, height: 2000, bytes: 2_000_000, alt: "A car", filename: "old.jpg" });
  expect(bucket.deleted).toEqual(["test-site/uploads/old.jpg"]);

  const [vehicle] = await database.db.select().from(schema.vehicle);
  expect(vehicle?.images.main).toEqual({ src: stored.src, width: 3000, height: 2000, alt: "Cullinan outside a hotel", assetId: "media-1" });
  expect(vehicle?.images.gallery[0]?.src).toBe("https://elsewhere.test/other.jpg");
  expect(vehicle?.images.gallery[1]).toMatchObject({ src: stored.src, alt: "Second", assetId: "media-1" });

  const [photograph] = await database.db.select().from(schema.galleryItem);
  expect(photograph?.image).toMatchObject({ src: stored.src, width: 3000, alt: "Night" });

  const [hero] = await database.db.select().from(schema.homepageSection);
  expect((hero?.data as { image: ImageRef }).image).toMatchObject({ src: stored.src, alt: "Hero" });

  // Now nothing points at the old address, and the usage follows the new one.
  expect((await media.getUsage("media-1")).length).toBe(4);
});

test("a photograph nothing shows can be deleted, and leaves the bucket with it", async () => {
  await seedUsage();
  await database.db.delete(schema.vehicle);
  await database.db.delete(schema.galleryItem);
  await database.db.delete(schema.homepageSection);

  await media.deleteMedia("media-1");
  await expect(media.getAsset("media-1")).rejects.toMatchObject({ name: "CmsNotFoundError" });
  expect(bucket.deleted).toEqual(["test-site/uploads/old.jpg"]);
});

test("the name and description are the library's own", async () => {
  await seedUsage();
  const updated = await media.updateMedia("media-1", { alt: "Cullinan, Park Lane", filename: "cullinan-park-lane.jpg" });
  expect(updated).toMatchObject({ alt: "Cullinan, Park Lane", filename: "cullinan-park-lane.jpg", src: OLD });
  // A page's own description is not rewritten.
  const [vehicle] = await database.db.select().from(schema.vehicle);
  expect(vehicle?.images.main?.alt).toBe("Cullinan outside a hotel");
});

test("the library lists newest first", async () => {
  const db = database.db;
  const base = { width: 1, height: 1, alt: "", origin: "site" as const, bytes: null, key: null };
  await db.insert(schema.mediaAsset).values([
    { ...base, id: "a", src: "https://x/a.jpg", filename: "a.jpg", createdAt: new Date("2026-01-01") },
    { ...base, id: "b", src: "https://x/b.jpg", filename: "b.jpg", createdAt: new Date("2026-03-01") },
    { ...base, id: "c", src: "https://x/c.jpg", filename: "c.jpg", createdAt: new Date("2026-02-01") },
  ]);
  expect((await media.getMedia()).map((asset) => asset.id)).toEqual(["b", "c", "a"]);
});
