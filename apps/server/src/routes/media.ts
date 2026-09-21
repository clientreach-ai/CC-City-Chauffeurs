import { mediaInputSchema } from "@CC-City-Chauffeurs/core/schemas";
import { CmsValidationError } from "@CC-City-Chauffeurs/core";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { requires, type Variables } from "../lib/session";
import { storeUpload } from "../lib/uploads";
import * as media from "../repositories/media";

export const mediaRoutes = new Hono<{ Variables: Variables }>()
  .get("/media", async (c) => c.json(await media.getMedia()))

  /**
   * Takes the file itself, stores it, and records the address it came back
   * with. One round trip, so a half-uploaded file can never leave a row
   * pointing at nothing.
   */
  .post(
    "/media/upload",
    requires("content.edit"),
    // Refused before it is read, rather than buffered whole and then measured.
    bodyLimit({
      maxSize: 26 * 1024 * 1024,
      onError: (c) => c.json({ error: "That image is larger than 25 MB." }, 413),
    }),
    async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new CmsValidationError({ file: "Choose an image to upload." });
    }
    const stored = await storeUpload(file);
    const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : "";
    return c.json(await media.createMedia({ ...stored, alt }), 201);
    },
  )

  /** Registers an address that is already stored elsewhere. */
  .post("/media", requires("content.edit"), async (c) => {
    const input = mediaInputSchema.parse(await c.req.json());
    return c.json(await media.createMedia(input), 201);
  })

  .delete("/media/:id", requires("content.delete"), async (c) => {
    await media.deleteMedia(c.req.param("id"));
    return c.body(null, 204);
  });
