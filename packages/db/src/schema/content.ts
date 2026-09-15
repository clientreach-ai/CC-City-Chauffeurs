import type {
  GalleryCategory,
  HomepageSection,
  ImageRef,
  PublishStatus,
  ServiceTemplate,
  SiteSettings,
  Visibility,
} from "@CC-City-Chauffeurs/core/types";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { vehicle } from "./fleet";

/**
 * Website content: the service pages, the gallery, testimonials, the
 * homepage bands and the site settings.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// ---------------------------------------------------------------- services

export const service = pgTable(
  "service",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** Display type — one entry per printed line. */
    headline: jsonb("headline").$type<string[]>().default([]).notNull(),
    summary: text("summary").default("").notNull(),
    standfirst: text("standfirst").default("").notNull(),
    heroImage: jsonb("hero_image").$type<ImageRef | null>(),
    facts: jsonb("facts").$type<{ label: string; value: string }[]>().default([]).notNull(),
    benefits: jsonb("benefits").$type<{ title: string; copy: string }[]>().default([]).notNull(),
    detail: jsonb("detail")
      .$type<{ heading: string; paragraphs: string[]; image: ImageRef | null }>()
      .default({ heading: "", paragraphs: [], image: null })
      .notNull(),
    gallery: jsonb("gallery").$type<ImageRef[]>().default([]).notNull(),
    booking: jsonb("booking")
      .$type<{ needs: string[]; note: string }>()
      .default({ needs: [], note: "" })
      .notNull(),
    enquiry: jsonb("enquiry")
      .$type<{ heading: string; ctaLabel: string }>()
      .default({ heading: "", ctaLabel: "Request a quote" })
      .notNull(),
    seo: jsonb("seo")
      .$type<{ title: string; description: string }>()
      .default({ title: "", description: "" })
      .notNull(),
    template: text("template").$type<ServiceTemplate>().default("index").notNull(),
    position: integer("position").default(0).notNull(),
    status: text("status").$type<PublishStatus>().default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("service_slug_uidx").on(table.slug),
    index("service_status_idx").on(table.status),
  ],
);

/**
 * Vehicles offered for a service. The order belongs to the service — it is
 * the order the service page shows them in.
 */
export const serviceVehicle = pgTable(
  "service_vehicle",
  {
    serviceId: text("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.vehicleId] }),
    index("service_vehicle_vehicle_idx").on(table.vehicleId),
  ],
);

// ---------------------------------------------------------------- gallery

export const galleryRow = pgTable("gallery_row", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  position: integer("position").default(0).notNull(),
});

export const galleryItem = pgTable(
  "gallery_item",
  {
    id: text("id").primaryKey(),
    image: jsonb("image").$type<ImageRef>().notNull(),
    caption: text("caption").default("").notNull(),
    location: text("location").default("").notNull(),
    /** Null when the car pictured is not on the fleet. */
    vehicleId: text("vehicle_id").references(() => vehicle.id, { onDelete: "set null" }),
    rowId: text("row_id")
      .notNull()
      .references(() => galleryRow.id, { onDelete: "restrict" }),
    category: text("category").$type<GalleryCategory>().default("vehicles").notNull(),
    position: integer("position").default(0).notNull(),
    status: text("status").$type<Visibility>().default("draft").notNull(),
    ...timestamps,
  },
  (table) => [
    index("gallery_item_status_idx").on(table.status),
    index("gallery_item_row_idx").on(table.rowId),
  ],
);

export const galleryItemService = pgTable(
  "gallery_item_service",
  {
    galleryItemId: text("gallery_item_id")
      .notNull()
      .references(() => galleryItem.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.galleryItemId, table.serviceId] })],
);

// ---------------------------------------------------------------- testimonials

export const testimonial = pgTable(
  "testimonial",
  {
    id: text("id").primaryKey(),
    quote: text("quote").notNull(),
    /** First name only — surnames are never published. */
    firstName: text("first_name").default("").notNull(),
    role: text("role").default("").notNull(),
    district: text("district").default("").notNull(),
    serviceId: text("service_id").references(() => service.id, { onDelete: "set null" }),
    /** "YYYY-MM-DD", or "" where the customer did not give one. */
    date: text("date").default("").notNull(),
    /** Written permission to publish — required before it can go live. */
    permission: boolean("permission").default(false).notNull(),
    position: integer("position").default(0).notNull(),
    status: text("status").$type<PublishStatus>().default("draft").notNull(),
    ...timestamps,
  },
  (table) => [index("testimonial_status_idx").on(table.status)],
);

// ---------------------------------------------------------------- homepage

/**
 * The homepage is a fixed set of editorial bands. Editors change the words,
 * photographs, links, order and visibility of a band — never its layout — so
 * the per-kind fields live in one `data` document rather than in eight tables
 * of columns that are never queried individually.
 */
export const homepageSection = pgTable(
  "homepage_section",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<HomepageSection["kind"]>().notNull(),
    name: text("name").notNull(),
    visible: boolean("visible").default(true).notNull(),
    position: integer("position").default(0).notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [index("homepage_section_position_idx").on(table.position)],
);

// ---------------------------------------------------------------- settings

/** A single row, id "default" — the site's own settings. */
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("default"),
  business: jsonb("business").$type<SiteSettings["business"]>().notNull(),
  contact: jsonb("contact").$type<SiteSettings["contact"]>().notNull(),
  booking: jsonb("booking").$type<SiteSettings["booking"]>().notNull(),
  social: jsonb("social").$type<SiteSettings["social"]>().default([]).notNull(),
  seo: jsonb("seo").$type<SiteSettings["seo"]>().notNull(),
  footer: jsonb("footer").$type<SiteSettings["footer"]>().notNull(),
  updatedAt: timestamps.updatedAt,
});

/** The service list the public enquiry form offers. */
export const enquiryServiceOption = pgTable("enquiry_service_option", {
  value: text("value").primaryKey(),
  label: text("label").notNull(),
  position: integer("position").default(0).notNull(),
});

// ---------------------------------------------------------------- relations

export const serviceRelations = relations(service, ({ many }) => ({
  vehicles: many(serviceVehicle),
  testimonials: many(testimonial),
}));

export const serviceVehicleRelations = relations(serviceVehicle, ({ one }) => ({
  service: one(service, { fields: [serviceVehicle.serviceId], references: [service.id] }),
  vehicle: one(vehicle, { fields: [serviceVehicle.vehicleId], references: [vehicle.id] }),
}));

export const galleryItemRelations = relations(galleryItem, ({ one, many }) => ({
  vehicle: one(vehicle, { fields: [galleryItem.vehicleId], references: [vehicle.id] }),
  row: one(galleryRow, { fields: [galleryItem.rowId], references: [galleryRow.id] }),
  services: many(galleryItemService),
}));

export const galleryItemServiceRelations = relations(galleryItemService, ({ one }) => ({
  item: one(galleryItem, {
    fields: [galleryItemService.galleryItemId],
    references: [galleryItem.id],
  }),
  service: one(service, { fields: [galleryItemService.serviceId], references: [service.id] }),
}));

export const galleryRowRelations = relations(galleryRow, ({ many }) => ({
  items: many(galleryItem),
}));

export const testimonialRelations = relations(testimonial, ({ one }) => ({
  service: one(service, { fields: [testimonial.serviceId], references: [service.id] }),
}));
