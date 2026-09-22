import { CmsValidationError } from "@CC-City-Chauffeurs/core";
import { mediaInputSchema, mediaUpdateSchema } from "@CC-City-Chauffeurs/core/schemas";
import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { requires, type Variables } from "../lib/session";
import { MAX_BYTES, storeUpload } from "../lib/storage";
import * as media from "../repositories/media";

/** Refused before it is read, rather than buffered whole and then measured. */
const uploadLimit = bodyLimit({
  // A little over the file limit: the multipart envelope has to fit too.
  maxSize: MAX_BYTES + 1024 * 1024,
  onError: (c) => c.json({ error: "That image is larger than 25 MB." }, 413),
});

async function fileFrom(c: Context): Promise<File> {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new CmsValidationError({ file: "Choose an image to upload." });
  return file;
}

export const mediaRoutes = new Hono<{ Variables: Variables }>()
  .get("/media", async (c) => c.json(await media.getMedia()))

  /** Every place each photograph is used, keyed by photograph. Before `/media/:id`, or it would be one. */
  .get("/media/usage", async (c) => c.json(await media.getAllUsage()))

  .get("/media/:id", async (c) => c.json(await media.getAsset(c.req.param("id"))))

  .get("/media/:id/usage", async (c) => c.json(await media.getUsage(c.req.param("id"))))

  /**
   * Takes the file itself, stores it, and records the address it came back
   * with. One round trip, so a half-uploaded file can never leave a row
   * pointing at nothing.
   */
  .post("/media/upload", requires("content.edit"), uploadLimit, async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new CmsValidationError({ file: "Choose an image to upload." });
    const stored = await storeUpload(file);
    const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : "";
    return c.json(await media.createMedia({ ...stored, alt }), 201);
  })

  /** Registers an address that is already stored elsewhere. */
  .post("/media", requires("content.edit"), async (c) => {
    const input = mediaInputSchema.parse(await c.req.json());
    return c.json(await media.createMedia(input), 201);
  })

  .patch("/media/:id", requires("content.edit"), async (c) => {
    const input = mediaUpdateSchema.parse(await c.req.json());
    return c.json(await media.updateMedia(c.req.param("id"), input));
  })

  /**
   * A new file takes this photograph's place everywhere it is used — on live
   * pages too, which is why it needs the capability to publish rather than
   * merely to edit. The record is checked before the file is stored, so a
   * miss leaves nothing behind in the bucket.
   */
  .post("/media/:id/replace", requires("content.publish"), uploadLimit, async (c) => {
    const id = c.req.param("id");
    await media.getAsset(id);
    const stored = await storeUpload(await fileFrom(c));
    return c.json(await media.replaceMedia(id, stored));
  })

  /** Refused with a 409 while a page still shows it. */
  .delete("/media/:id", requires("content.delete"), async (c) => {
    await media.deleteMedia(c.req.param("id"));
    return c.body(null, 204);
  });
