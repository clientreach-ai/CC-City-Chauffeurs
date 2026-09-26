/**
 * What an uploaded photograph becomes before it reaches the bucket: upright,
 * no larger than the site can show, WebP, and carrying no metadata.
 *
 * The images are made here, in memory, so the tests say exactly what they
 * feed in — a size, an orientation, an alpha channel — rather than relying on
 * fixture files whose properties nobody remembers.
 */

import { beforeAll, expect, test } from "bun:test";
import sharp from "sharp";

import { setTestEnvironment } from "./harness";

setTestEnvironment();

let convert: typeof import("../src/lib/image-convert");
let storage: typeof import("../src/lib/storage");

beforeAll(async () => {
  // Imported after the test environment is set, as the other suites do.
  convert = await import("../src/lib/image-convert");
  storage = await import("../src/lib/storage");
});

const JPEG = { type: "image/jpeg", extension: ".jpg" };
const PNG = { type: "image/png", extension: ".png" };
const WEBP = { type: "image/webp", extension: ".webp" };

/** A photograph-like image: a gradient with noise, so it compresses like one. */
async function photo(width: number, height: number) {
  const noise = await sharp({
    // The types ask for a background even when noise is given; noise wins.
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .png()
    .toBuffer();
  return sharp(noise).blur(1.2);
}

const bytes = (buffer: Buffer) => new Uint8Array(buffer);

test("a large camera JPEG is scaled to the longest edge the site shows, as WebP", async () => {
  const input = bytes(await (await photo(4000, 3000)).jpeg({ quality: 95 }).toBuffer());
  const out = await convert.convertForWeb(input, JPEG);

  expect(out.type).toBe("image/webp");
  expect(out.extension).toBe(".webp");
  expect([out.width, out.height]).toEqual([2400, 1800]);
  expect(out.bytes.byteLength).toBeLessThan(input.byteLength);

  // What the bytes actually are, not only what we said about them.
  const stored = await sharp(out.bytes).metadata();
  expect(stored.format).toBe("webp");
  expect([stored.width, stored.height]).toEqual([2400, 1800]);
});

test("a portrait photograph is limited by its height", async () => {
  const input = bytes(await (await photo(1800, 3000)).jpeg().toBuffer());
  const out = await convert.convertForWeb(input, JPEG);
  expect([out.width, out.height]).toEqual([1440, 2400]);
});

test("a small photograph is converted but never enlarged", async () => {
  const input = bytes(await (await photo(800, 600)).png().toBuffer());
  const out = await convert.convertForWeb(input, PNG);
  expect(out.type).toBe("image/webp");
  expect([out.width, out.height]).toEqual([800, 600]);
});

test("a phone photograph is turned upright, and its EXIF — GPS included — is removed", async () => {
  // Stored 400×200 with orientation 6: a portrait photograph, lying on its side.
  const input = bytes(
    await (await photo(400, 200))
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCo" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } })
      .withMetadata({ orientation: 6 })
      .toBuffer(),
  );
  const before = await sharp(input).metadata();
  expect(before.orientation).toBe(6);
  expect(before.exif).toBeDefined();

  const out = await convert.convertForWeb(input, JPEG);
  expect([out.width, out.height]).toEqual([200, 400]);

  const after = await sharp(out.bytes).metadata();
  expect([after.width, after.height]).toEqual([200, 400]);
  expect(after.exif).toBeUndefined();
  expect(after.orientation).toBeUndefined();
});

test("transparency survives the conversion", async () => {
  const input = bytes(
    await sharp({
      create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.4 } },
    })
      .png()
      .toBuffer(),
  );
  const out = await convert.convertForWeb(input, PNG);
  expect(out.type).toBe("image/webp");
  expect((await sharp(out.bytes).metadata()).hasAlpha).toBe(true);
});

test("a file that is already small and clean is kept exactly as it came", async () => {
  // Heavily compressed already: re-encoding at our quality would only grow it.
  const input = bytes(await (await photo(640, 480)).webp({ quality: 5 }).toBuffer());
  const out = await convert.convertForWeb(input, WEBP);
  expect(out.bytes).toBe(input);
  expect(out.type).toBe("image/webp");
  expect([out.width, out.height]).toEqual([640, 480]);
});

test("a small file carrying metadata is still re-encoded, so the metadata goes", async () => {
  const input = bytes(
    await (await photo(640, 480))
      .webp({ quality: 5 })
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } })
      .toBuffer(),
  );
  const out = await convert.convertForWeb(input, WEBP);
  expect(out.bytes).not.toBe(input);
  expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
});

test("an image with too many pixels is refused with a message an editor can act on", async () => {
  const input = bytes(await (await photo(1000, 1000)).jpeg().toBuffer());
  await expect(convert.convertForWeb(input, JPEG, { maxPixels: 500_000 })).rejects.toMatchObject({
    fields: { file: expect.stringContaining("too many pixels") },
  });
});

test("bytes that start like a JPEG but are not one are refused", async () => {
  const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(200).fill(7)]);
  await expect(convert.convertForWeb(input, JPEG)).rejects.toMatchObject({
    fields: { file: expect.stringContaining("could not be read") },
  });
});

test("every upload route's entry point hands back the prepared file, not the original", async () => {
  const original = await (await photo(3200, 2400)).jpeg({ quality: 95 }).toBuffer();
  const file = new File([original], "cullinan.jpg", { type: "image/jpeg" });

  const image = await storage.readImage(file);
  expect(image.type).toBe("image/webp");
  expect(image.extension).toBe(".webp");
  expect([image.width, image.height]).toEqual([2400, 1800]);
  expect(image.bytes.byteLength).toBeLessThan(original.byteLength);
});

test("the browser's claimed type is still checked before any work is done", async () => {
  const file = new File([new Uint8Array(10)], "notes.txt", { type: "text/plain" });
  await expect(storage.readImage(file)).rejects.toMatchObject({
    fields: { file: expect.stringContaining("is not a JPEG, PNG, WebP or AVIF") },
  });
});
