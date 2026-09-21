import { reorderSchema, statusSchema, testimonialInputSchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { mayPublish, requires, type Variables } from "../lib/session";
import * as testimonials from "../repositories/testimonials";

export const testimonialRoutes = new Hono<{ Variables: Variables }>()
  .get("/testimonials", async (c) => c.json(await testimonials.getTestimonials()))

  .post("/testimonials", requires("content.edit"), async (c) => {
    const input = testimonialInputSchema.parse(await c.req.json());
    if (!mayPublish(c)) input.status = "draft";
    return c.json(await testimonials.createTestimonial(input), 201);
  })

  .put("/testimonials/order", requires("content.edit"), async (c) => {
    const { ids } = reorderSchema.parse(await c.req.json());
    await testimonials.reorderTestimonials(ids);
    return c.body(null, 204);
  })

  .patch("/testimonials/:id", requires("content.edit"), async (c) => {
    const input = testimonialInputSchema.parse(await c.req.json());
    if (!mayPublish(c)) {
      const current = (await testimonials.getTestimonials()).find((row) => row.id === c.req.param("id"));
      if (current) input.status = current.status;
    }
    return c.json(await testimonials.updateTestimonial(c.req.param("id"), input));
  })

  .patch("/testimonials/:id/status", requires("content.publish"), async (c) => {
    const { status } = statusSchema.parse(await c.req.json());
    return c.json(await testimonials.setTestimonialStatus(c.req.param("id"), status));
  })

  .delete("/testimonials/:id", requires("content.delete"), async (c) => {
    await testimonials.deleteTestimonial(c.req.param("id"));
    return c.body(null, 204);
  });
