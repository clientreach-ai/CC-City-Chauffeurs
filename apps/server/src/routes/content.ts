import {
  homepageSectionSchema,
  reorderSchema,
  siteSettingsSchema,
  visibleSchema,
} from "@CC-City-Chauffeurs/core/schemas";
import type { HomepageSection, SiteSettings } from "@CC-City-Chauffeurs/core";
import { Hono } from "hono";

import { mayPublish, requires, type Variables } from "../lib/session";
import * as content from "../repositories/content";

/** The homepage bands and the site settings. */
export const contentRoutes = new Hono<{ Variables: Variables }>()
  .get("/homepage", async (c) => c.json(await content.getHomepage()))

  .put("/homepage/order", requires("content.edit"), async (c) => {
    const { ids } = reorderSchema.parse(await c.req.json());
    await content.reorderSections(ids);
    return c.body(null, 204);
  })

  .patch("/homepage/sections/:id", requires("content.edit"), async (c) => {
    const parsed = homepageSectionSchema.parse(await c.req.json());
    // The id in the path is the authority; a mismatched body cannot move it.
    const section = { ...parsed, id: c.req.param("id") } as HomepageSection;
    if (!mayPublish(c)) {
      const current = (await content.getHomepage()).find((row) => row.id === section.id);
      if (current) section.visible = current.visible;
    }
    return c.json(await content.updateSection(section));
  })

  .patch("/homepage/sections/:id/visibility", requires("content.publish"), async (c) => {
    const { visible } = visibleSchema.parse(await c.req.json());
    await content.setSectionVisibility(c.req.param("id"), visible);
    return c.body(null, 204);
  })

  .get("/settings", async (c) => c.json(await content.getSettings()))

  .put("/settings", requires("settings.edit"), async (c) => {
    const settings = siteSettingsSchema.parse(await c.req.json()) as SiteSettings;
    return c.json(await content.updateSettings(settings));
  })

  .get("/enquiry-services", async (c) => c.json(await content.getEnquiryServices()));
