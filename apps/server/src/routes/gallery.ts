import {
  addGalleryImagesSchema,
  galleryBulkStatusSchema,
  galleryItemInputSchema,
  idsSchema,
  reorderSchema,
} from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { requires, type Variables } from "../lib/session";
import * as gallery from "../repositories/gallery";

export const galleryRoutes = new Hono<{ Variables: Variables }>()
  .get("/gallery", async (c) => c.json(await gallery.getGallery()))

  .get("/gallery-rows", async (c) => c.json(await gallery.getGalleryRows()))

  .post("/gallery", requires("content.edit"), async (c) => {
    const { images, defaults } = addGalleryImagesSchema.parse(await c.req.json());
    return c.json(await gallery.addGalleryImages(images, defaults), 201);
  })

  /** Bulk publish or hide. Photographs without a description are skipped. */
  .patch("/gallery", requires("content.publish"), async (c) => {
    const { ids, status } = galleryBulkStatusSchema.parse(await c.req.json());
    return c.json(await gallery.setGalleryStatus(ids, status));
  })

  .put("/gallery/order", requires("content.edit"), async (c) => {
    const { ids } = reorderSchema.parse(await c.req.json());
    await gallery.reorderGallery(ids);
    return c.body(null, 204);
  })

  .delete("/gallery", requires("content.delete"), async (c) => {
    const { ids } = idsSchema.parse(await c.req.json());
    await gallery.deleteGalleryItems(ids);
    return c.body(null, 204);
  })

  .patch("/gallery/:id", requires("content.edit"), async (c) => {
    const input = galleryItemInputSchema.parse(await c.req.json());
    return c.json(await gallery.updateGalleryItem(c.req.param("id"), input));
  });
