import { reorderSchema, serviceInputSchema, statusSchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { requires, type Variables } from "../lib/session";
import * as services from "../repositories/services";

/** The chauffeur service pages. */
export const serviceRoutes = new Hono<{ Variables: Variables }>()
  .get("/services", async (c) => c.json(await services.getServices()))

  .post("/services", requires("content.edit"), async (c) => {
    const input = serviceInputSchema.parse(await c.req.json());
    return c.json(await services.createService(input), 201);
  })

  // Declared before "/services/:id" so "order" is never read as an id.
  .put("/services/order", requires("content.edit"), async (c) => {
    const { ids } = reorderSchema.parse(await c.req.json());
    await services.reorderServices(ids);
    return c.body(null, 204);
  })

  .get("/services/:id", async (c) => c.json(await services.getService(c.req.param("id"))))

  .get("/services/:id/usage", async (c) => c.json(await services.getServiceUsage(c.req.param("id"))))

  .patch("/services/:id", requires("content.edit"), async (c) => {
    const input = serviceInputSchema.parse(await c.req.json());
    return c.json(await services.updateService(c.req.param("id"), input));
  })

  .patch("/services/:id/status", requires("content.publish"), async (c) => {
    const { status } = statusSchema.parse(await c.req.json());
    return c.json(await services.setServiceStatus(c.req.param("id"), status));
  })

  .delete("/services/:id", requires("content.delete"), async (c) => {
    await services.deleteService(c.req.param("id"));
    return c.body(null, 204);
  });
