import { publicBookingSchema, publicEnquirySchema } from "@CC-City-Chauffeurs/core/schemas";
import type { FleetCategory, Service, Vehicle } from "@CC-City-Chauffeurs/core";
import { Hono } from "hono";

import { CmsNotFoundError } from "@CC-City-Chauffeurs/core";
import * as content from "../repositories/content";
import * as fleet from "../repositories/fleet";
import * as gallery from "../repositories/gallery";
import * as operations from "../repositories/operations";
import * as services from "../repositories/services";
import * as testimonials from "../repositories/testimonials";
import { publicWriteGuard } from "../lib/rate-limit";

/**
 * What the website reads.
 *
 * No session: this is the public site. Only published records leave here, and
 * a draft is indistinguishable from a record that does not exist — an
 * unpublished vehicle must not be readable by guessing its slug.
 *
 * Image `src` values stay site-relative ("/media/…"), because the website
 * serves those files itself.
 */

const published = <T extends { status: string }>(rows: T[]) =>
  rows.filter((row) => row.status === "published");

/**
 * The honeypot. `website` is a field no person can see — the form renders it
 * hidden, off the tab order and with autocomplete off — so anything arriving
 * with it filled in was filled in by a machine. It is answered exactly as a
 * real submission is, minus the record: telling a bot it has been caught only
 * teaches whoever wrote it to stop filling the field in.
 */
const trapped = (input: { website: string }) => input.website.trim().length > 0;

/** A grouping with only the vehicles that are actually live, in order. */
function liveGroupings(categories: FleetCategory[], vehicles: Vehicle[]) {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return categories
    .filter((category) => category.status === "published")
    .map((category) => ({
      ...category,
      vehicles: category.vehicleOrder
        .map((id) => byId.get(id))
        .filter((vehicle): vehicle is Vehicle => vehicle != null),
    }))
    .filter((category) => category.vehicles.length > 0);
}

export const publicRoutes = new Hono()
  /** Settings, navigation and the enquiry form's options — every page needs these. */
  .get("/site", async (c) => {
    const [settings, serviceRows, enquiryServices] = await Promise.all([
      content.getSettings(),
      services.getServices(),
      content.getEnquiryServices(),
    ]);
    return c.json({
      settings,
      enquiryServices,
      navigation: published(serviceRows).map((service) => ({
        slug: service.slug,
        name: service.name,
        summary: service.summary,
      })),
    });
  })

  /**
   * The homepage, with the bands' references already resolved: the page
   * should not have to fetch the fleet to render a featured-fleet band.
   */
  .get("/homepage", async (c) => {
    const [sections, vehicles, serviceRows, testimonialRows] = await Promise.all([
      content.getHomepage(),
      fleet.getVehicles(),
      services.getServices(),
      testimonials.getTestimonials(),
    ]);

    const liveVehicles = new Map(published(vehicles).map((item) => [item.id, item]));
    const liveServices = new Map(published(serviceRows).map((item) => [item.id, item]));

    const bands = sections
      .filter((section) => section.visible)
      .map((section) => {
        if (section.kind === "fleet") {
          return {
            ...section,
            vehicles: section.vehicleIds
              .map((id) => liveVehicles.get(id))
              .filter((item): item is Vehicle => item != null),
          };
        }
        if (section.kind === "services") {
          return {
            ...section,
            services: section.serviceIds
              .map((id) => liveServices.get(id))
              .filter((item): item is Service => item != null),
          };
        }
        return section;
      });

    return c.json({ sections: bands, testimonials: published(testimonialRows) });
  })

  /** The fleet page: live groupings, and every live vehicle. */
  .get("/fleet", async (c) => {
    const [categories, vehicles, features] = await Promise.all([
      fleet.getCategories(),
      fleet.getVehicles(),
      fleet.getFeatures(),
    ]);
    const live = published(vehicles);
    return c.json({
      categories: liveGroupings(categories, live),
      vehicles: live,
      features,
    });
  })

  .get("/fleet/:slug", async (c) => {
    const vehicles = published(await fleet.getVehicles());
    const vehicle = vehicles.find((item) => item.slug === c.req.param("slug"));
    if (!vehicle) throw new CmsNotFoundError("This vehicle");
    return c.json(vehicle);
  })

  .get("/services", async (c) => c.json(published(await services.getServices())))

  /** One service page, with the vehicles it lists resolved in order. */
  .get("/services/:slug", async (c) => {
    const [serviceRows, vehicles] = await Promise.all([
      services.getServices(),
      fleet.getVehicles(),
    ]);
    const service = published(serviceRows).find((item) => item.slug === c.req.param("slug"));
    if (!service) throw new CmsNotFoundError("This service");

    const byId = new Map(published(vehicles).map((item) => [item.id, item]));
    return c.json({
      ...service,
      vehicles: service.vehicleIds
        .map((id) => byId.get(id))
        .filter((item): item is Vehicle => item != null),
    });
  })

  .get("/gallery", async (c) => {
    const [items, rows] = await Promise.all([gallery.getGallery(), gallery.getGalleryRows()]);
    const live = published(items);
    return c.json({
      items: live,
      // Only rows that have something in them get a filter on the page.
      rows: rows.filter((row) => live.some((item) => item.row === row.id)),
    });
  })

  .get("/testimonials", async (c) => c.json(published(await testimonials.getTestimonials())))

  /**
   * The enquiry form. It records an enquiry and does nothing else — no email
   * is sent, no message is dispatched. The response carries the reference so
   * the visitor has something to quote.
   */
  .post("/enquiries", publicWriteGuard, async (c) => {
    const input = publicEnquirySchema.parse(await c.req.json());
    if (trapped(input)) return c.json({ reference: "" }, 201);
    const enquiry = await operations.createPublicEnquiry(input);
    return c.json({ reference: enquiry.reference }, 201);
  })

  /**
   * A booking *request* from the website — a date the visitor would like,
   * not a date they have been given. It lands as a pending booking for the
   * office to confirm, and, like an enquiry, nothing is sent to anybody.
   */
  .post("/bookings", publicWriteGuard, async (c) => {
    const input = publicBookingSchema.parse(await c.req.json());
    if (trapped(input)) return c.json({ reference: "" }, 201);
    const booking = await operations.createPublicBooking(input);
    return c.json({ reference: booking.reference }, 201);
  });
