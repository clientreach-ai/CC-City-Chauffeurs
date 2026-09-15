import {
  featureInputSchema,
  fleetCategoryInputSchema,
  reorderSchema,
  statusSchema,
  vehicleInputSchema,
  visibilityUpdateSchema,
} from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { requires, type Variables } from "../lib/session";
import * as fleet from "../repositories/fleet";

/** Vehicles, the groupings they appear in, and the feature list. */
export const fleetRoutes = new Hono<{ Variables: Variables }>()
  // ------------------------------------------------------------ vehicles
  .get("/vehicles", async (c) => c.json(await fleet.getVehicles()))

  .get("/vehicles/:id", async (c) => c.json(await fleet.getVehicle(c.req.param("id"))))

  .get("/vehicles/:id/usage", async (c) => c.json(await fleet.getVehicleUsage(c.req.param("id"))))

  .post("/vehicles", requires("content.edit"), async (c) => {
    const input = vehicleInputSchema.parse(await c.req.json());
    return c.json(await fleet.createVehicle(input), 201);
  })

  .patch("/vehicles/:id", requires("content.edit"), async (c) => {
    const input = vehicleInputSchema.parse(await c.req.json());
    return c.json(await fleet.updateVehicle(c.req.param("id"), input));
  })

  .patch("/vehicles/:id/status", requires("content.publish"), async (c) => {
    const { status } = statusSchema.parse(await c.req.json());
    return c.json(await fleet.setVehicleStatus(c.req.param("id"), status));
  })

  .post("/vehicles/:id/duplicate", requires("content.edit"), async (c) =>
    c.json(await fleet.duplicateVehicle(c.req.param("id")), 201),
  )

  .delete("/vehicles/:id", requires("content.delete"), async (c) => {
    await fleet.deleteVehicle(c.req.param("id"));
    return c.body(null, 204);
  })

  // ------------------------------------------------------------ features
  .get("/features", async (c) => c.json(await fleet.getFeatures()))

  .post("/features", requires("content.edit"), async (c) => {
    const { label, note } = featureInputSchema.parse(await c.req.json());
    return c.json(await fleet.createFeature(label, note), 201);
  })

  // ------------------------------------------------------------ groupings
  .get("/fleet-categories", async (c) => c.json(await fleet.getCategories()))

  .post("/fleet-categories", requires("content.edit"), async (c) => {
    const input = fleetCategoryInputSchema.parse(await c.req.json());
    return c.json(await fleet.createCategory(input), 201);
  })

  .put("/fleet-categories/order", requires("content.edit"), async (c) => {
    const { ids } = reorderSchema.parse(await c.req.json());
    await fleet.reorderCategories(ids);
    return c.body(null, 204);
  })

  .patch("/fleet-categories/:id", requires("content.edit"), async (c) => {
    const input = fleetCategoryInputSchema.parse(await c.req.json());
    return c.json(await fleet.updateCategory(c.req.param("id"), input));
  })

  .patch("/fleet-categories/:id/status", requires("content.publish"), async (c) => {
    const { status } = visibilityUpdateSchema.parse(await c.req.json());
    return c.json(await fleet.setCategoryStatus(c.req.param("id"), status));
  })

  .put("/fleet-categories/:id/vehicles", requires("content.edit"), async (c) => {
    const { ids } = reorderSchema.parse(await c.req.json());
    await fleet.reorderCategoryVehicles(c.req.param("id"), ids);
    return c.body(null, 204);
  })

  .delete("/fleet-categories/:id", requires("content.delete"), async (c) => {
    await fleet.deleteCategory(c.req.param("id"));
    return c.body(null, 204);
  });
