import type {
  ImageRef,
  PublishStatus,
  VehicleAvailability,
  VehicleOwnership,
  VehiclePricing,
  VehicleSpecs,
  Visibility,
} from "@CC-City-Chauffeurs/core/types";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * The fleet: vehicles, the groupings they appear in, and the feature list.
 *
 * Scalar columns are used for everything the API filters, sorts or joins on.
 * The value objects a record is only ever read and written *whole* — specs,
 * pricing, the image set, the SEO block — are `jsonb` typed against the
 * domain contract, so they come back out of the database as the exact shapes
 * the admin and the website already compile against.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const mediaAsset = pgTable("media_asset", {
  id: text("id").primaryKey(),
  /** Site-relative ("/media/x.jpg") or the absolute address of an upload. */
  src: text("src").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  alt: text("alt").default("").notNull(),
  filename: text("filename").notNull(),
  /** "site" is the website's own photography and cannot be deleted here. */
  origin: text("origin").$type<"site" | "local">().default("local").notNull(),
  bytes: integer("bytes"),
  createdAt: timestamps.createdAt,
});

export const vehicleFeature = pgTable("vehicle_feature", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  note: text("note").default("").notNull(),
  position: integer("position").default(0).notNull(),
});

export const fleetCategory = pgTable(
  "fleet_category",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").default("").notNull(),
    position: integer("position").default(0).notNull(),
    status: text("status").$type<Visibility>().default("published").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("fleet_category_slug_uidx").on(table.slug)],
);

export const vehicle = pgTable(
  "vehicle",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    make: text("make").default("").notNull(),
    model: text("model").default("").notNull(),
    shortDescription: text("short_description").default("").notNull(),
    description: text("description").default("").notNull(),
    specs: jsonb("specs")
      .$type<VehicleSpecs>()
      .default({ passengers: null, luggage: "", year: null, transmission: "", bodyType: "" })
      .notNull(),
    availability: text("availability").$type<VehicleAvailability>().default("chauffeur").notNull(),
    ownership: text("ownership").$type<VehicleOwnership>().default("unconfirmed").notNull(),
    suitedTags: jsonb("suited_tags").$type<string[]>().default([]).notNull(),
    pricing: jsonb("pricing")
      .$type<VehiclePricing>()
      .default({ hourlyRate: null, dayRate: null, airportNote: "", notes: "" })
      .notNull(),
    images: jsonb("images")
      .$type<{ main: ImageRef | null; gallery: ImageRef[] }>()
      .default({ main: null, gallery: [] })
      .notNull(),
    seo: jsonb("seo")
      .$type<{ title: string; description: string; shareImage: ImageRef | null }>()
      .default({ title: "", description: "", shareImage: null })
      .notNull(),
    status: text("status").$type<PublishStatus>().default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vehicle_slug_uidx").on(table.slug),
    index("vehicle_status_idx").on(table.status),
  ],
);

/**
 * Grouping membership. The *order* of vehicles inside a grouping belongs to
 * the grouping (it is what the fleet page prints), so it is a column here
 * rather than a field on the vehicle.
 */
export const vehicleCategory = pgTable(
  "vehicle_category",
  {
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => fleetCategory.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.vehicleId, table.categoryId] }),
    index("vehicle_category_category_idx").on(table.categoryId),
  ],
);

export const vehicleFeatureLink = pgTable(
  "vehicle_feature_link",
  {
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => vehicleFeature.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.vehicleId, table.featureId] })],
);

// ---------------------------------------------------------------- relations

export const vehicleRelations = relations(vehicle, ({ many }) => ({
  categories: many(vehicleCategory),
  features: many(vehicleFeatureLink),
}));

export const fleetCategoryRelations = relations(fleetCategory, ({ many }) => ({
  vehicles: many(vehicleCategory),
}));

export const vehicleCategoryRelations = relations(vehicleCategory, ({ one }) => ({
  vehicle: one(vehicle, { fields: [vehicleCategory.vehicleId], references: [vehicle.id] }),
  category: one(fleetCategory, {
    fields: [vehicleCategory.categoryId],
    references: [fleetCategory.id],
  }),
}));

export const vehicleFeatureLinkRelations = relations(vehicleFeatureLink, ({ one }) => ({
  vehicle: one(vehicle, { fields: [vehicleFeatureLink.vehicleId], references: [vehicle.id] }),
  feature: one(vehicleFeature, {
    fields: [vehicleFeatureLink.featureId],
    references: [vehicleFeature.id],
  }),
}));
