import type { LegalDocumentContent } from "@CC-City-Chauffeurs/core";
import { legalDocumentSchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { authorName, requires, type Variables } from "../lib/session";
import * as legal from "../repositories/legal";

/**
 * The privacy notice and the terms of service, for the admin.
 *
 * Anyone signed in may read them. Changing one publishes legal text in the
 * business's name, so it needs the same capability as the business settings.
 */
export const legalRoutes = new Hono<{ Variables: Variables }>()
  .get("/legal", async (c) => c.json(await legal.getLegalDocuments()))

  .get("/legal/:id", async (c) => c.json(await legal.getLegalDocument(c.req.param("id"))))

  .put("/legal/:id", requires("settings.edit"), async (c) => {
    const content = legalDocumentSchema.parse(await c.req.json()) as LegalDocumentContent;
    return c.json(await legal.updateLegalDocument(c.req.param("id"), content, authorName(c.get("user"))));
  })

  /** Discards the saved version; the default wording is served again. */
  .delete("/legal/:id", requires("settings.edit"), async (c) => c.json(await legal.resetLegalDocument(c.req.param("id"))));
