import type { HomepageSection } from "@CC-City-Chauffeurs/core/types";
import { eq } from "drizzle-orm";

import { createDb } from "../index";
import * as schema from "../schema";
import { buildContentSeed } from "./content";
import { buildSampleOperations } from "./operations";

/**
 * Seeds the database from the website's own content.
 *
 * Run with `pnpm db:seed`. It is destructive and idempotent: every content
 * table is emptied and rewritten, so running it twice leaves the same
 * database, and running it after the site's copy changes brings the database
 * back in step.
 *
 *   --samples      also insert the sample enquiries, bookings and customers
 *                  (invented records — see `operations.ts`)
 *   --keep-ops     leave operational data alone (the default is to keep it;
 *                  pass --reset-ops to clear it)
 *   --reset-ops    clear enquiries, bookings and customers first
 *
 * Operational data is real work — enquiries from real people — so it is
 * never touched unless asked for explicitly.
 */

const args = new Set(process.argv.slice(2));
const withSamples = args.has("--samples");
const resetOps = args.has("--reset-ops") || withSamples;

const db = createDb();

/** Splits the homepage union into the columns and the per-kind document. */
function sectionRow(section: HomepageSection) {
  const { id, kind, name, visible, position, updatedAt, ...data } = section;
  return {
    id,
    kind,
    name,
    visible,
    position,
    data: data as Record<string, unknown>,
    updatedAt: new Date(updatedAt),
  };
}

async function main() {
  const seed = buildContentSeed();
  const stamp = (value: string) => new Date(value);

  await db.transaction(async (tx) => {
    // ---------------------------------------------------------- clear
    if (resetOps) {
      await tx.delete(schema.activityEntry);
      await tx.delete(schema.enquiryNote);
      await tx.delete(schema.booking);
      await tx.delete(schema.enquiry);
      await tx.delete(schema.customer);
    }

    // Children before parents — the foreign keys are real.
    await tx.delete(schema.galleryItemService);
    await tx.delete(schema.galleryItem);
    await tx.delete(schema.galleryRow);
    await tx.delete(schema.serviceVehicle);
    await tx.delete(schema.vehicleFeatureLink);
    await tx.delete(schema.vehicleCategory);
    await tx.delete(schema.testimonial);
    await tx.delete(schema.service);
    await tx.delete(schema.vehicle);
    await tx.delete(schema.fleetCategory);
    await tx.delete(schema.vehicleFeature);
    await tx.delete(schema.mediaAsset);
    await tx.delete(schema.homepageSection);
    await tx.delete(schema.siteSettings);
    await tx.delete(schema.enquiryServiceOption);

    // ---------------------------------------------------------- media
    await tx.insert(schema.mediaAsset).values(
      seed.media.map((asset) => ({
        id: asset.id,
        src: asset.src,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        filename: asset.filename,
        origin: asset.origin,
        bytes: asset.bytes,
        createdAt: stamp(asset.createdAt),
      })),
    );

    await tx.insert(schema.vehicleFeature).values(seed.features);

    // ---------------------------------------------------------- fleet
    await tx.insert(schema.fleetCategory).values(
      seed.fleetCategories.map((category) => ({
        id: category.id,
        slug: category.slug,
        title: category.title,
        summary: category.summary,
        position: category.position,
        status: category.status,
        createdAt: stamp(category.createdAt),
        updatedAt: stamp(category.updatedAt),
      })),
    );

    await tx.insert(schema.vehicle).values(
      seed.vehicles.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        make: item.make,
        model: item.model,
        shortDescription: item.shortDescription,
        description: item.description,
        specs: item.specs,
        availability: item.availability,
        ownership: item.ownership,
        suitedTags: item.suitedTags,
        pricing: item.pricing,
        images: item.images,
        seo: item.seo,
        status: item.status,
        publishedAt: item.publishedAt ? stamp(item.publishedAt) : null,
        createdAt: stamp(item.createdAt),
        updatedAt: stamp(item.updatedAt),
      })),
    );

    // Membership, ordered as the grouping lists it.
    const membership = seed.fleetCategories.flatMap((category) =>
      category.vehicleOrder.map((vehicleId, position) => ({
        vehicleId,
        categoryId: category.id,
        position,
      })),
    );
    if (membership.length) await tx.insert(schema.vehicleCategory).values(membership);

    const featureLinks = seed.vehicles.flatMap((item) =>
      item.featureIds.map((featureId) => ({ vehicleId: item.id, featureId })),
    );
    if (featureLinks.length) await tx.insert(schema.vehicleFeatureLink).values(featureLinks);

    // ---------------------------------------------------------- services
    await tx.insert(schema.service).values(
      seed.services.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        headline: item.headline,
        summary: item.summary,
        standfirst: item.standfirst,
        heroImage: item.heroImage,
        facts: item.facts,
        benefits: item.benefits,
        detail: item.detail,
        gallery: item.gallery,
        booking: item.booking,
        enquiry: item.enquiry,
        seo: item.seo,
        template: item.template,
        position: item.position,
        status: item.status,
        publishedAt: item.publishedAt ? stamp(item.publishedAt) : null,
        createdAt: stamp(item.createdAt),
        updatedAt: stamp(item.updatedAt),
      })),
    );

    const offered = seed.services.flatMap((item) =>
      item.vehicleIds.map((vehicleId, position) => ({
        serviceId: item.id,
        vehicleId,
        position,
      })),
    );
    if (offered.length) await tx.insert(schema.serviceVehicle).values(offered);

    // ---------------------------------------------------------- gallery
    await tx.insert(schema.galleryRow).values(
      seed.galleryRows.map((row, position) => ({ id: row.id, label: row.label, position })),
    );

    await tx.insert(schema.galleryItem).values(
      seed.gallery.map((item) => ({
        id: item.id,
        image: item.image,
        caption: item.caption,
        location: item.location,
        vehicleId: item.vehicleId,
        rowId: item.row,
        category: item.category,
        position: item.position,
        status: item.status,
        createdAt: stamp(item.createdAt),
        updatedAt: stamp(item.updatedAt),
      })),
    );

    const galleryServices = seed.gallery.flatMap((item) =>
      item.serviceIds.map((serviceId) => ({ galleryItemId: item.id, serviceId })),
    );
    if (galleryServices.length) {
      await tx.insert(schema.galleryItemService).values(galleryServices);
    }

    // ---------------------------------------------------------- testimonials
    if (seed.testimonials.length) {
      await tx.insert(schema.testimonial).values(
        seed.testimonials.map((item) => ({
          id: item.id,
          quote: item.quote,
          firstName: item.firstName,
          role: item.role,
          district: item.district,
          serviceId: item.serviceId,
          date: item.date,
          permission: item.permission,
          position: item.position,
          status: item.status,
          createdAt: stamp(item.createdAt),
          updatedAt: stamp(item.updatedAt),
        })),
      );
    }

    // ---------------------------------------------------------- homepage
    await tx.insert(schema.homepageSection).values(seed.homepage.map(sectionRow));

    // ---------------------------------------------------------- settings
    await tx.insert(schema.siteSettings).values({
      id: "default",
      business: seed.settings.business,
      contact: seed.settings.contact,
      booking: seed.settings.booking,
      social: seed.settings.social,
      seo: seed.settings.seo,
      footer: seed.settings.footer,
      updatedAt: stamp(seed.settings.updatedAt),
    });

    await tx.insert(schema.enquiryServiceOption).values(
      seed.enquiryServices.map((option, position) => ({
        value: option.value,
        label: option.label,
        position,
      })),
    );

    // ---------------------------------------------------------- samples
    if (withSamples) {
      const sample = buildSampleOperations();

      await tx.insert(schema.customer).values(
        sample.customers.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          company: item.company,
          phone: item.phone,
          email: item.email,
          notes: item.notes,
          createdAt: stamp(item.createdAt),
          updatedAt: stamp(item.updatedAt),
        })),
      );

      // Enquiries first without their booking link, then the bookings, then
      // the link back — the two tables point at each other.
      await tx.insert(schema.enquiry).values(
        sample.enquiries.map((item) => ({
          id: item.id,
          reference: item.reference,
          customerId: item.customerId,
          contact: item.contact,
          source: item.source,
          replyBy: item.replyBy,
          journey: item.journey,
          message: item.message,
          status: item.status,
          lostReason: item.lostReason,
          quote: item.quote,
          bookingId: null,
          createdAt: stamp(item.createdAt),
          updatedAt: stamp(item.updatedAt),
        })),
      );

      if (sample.bookings.length) {
        await tx.insert(schema.booking).values(
          sample.bookings.map((item) => ({
            id: item.id,
            reference: item.reference,
            customerId: item.customerId,
            enquiryId: item.enquiryId,
            service: item.service,
            vehicleId: item.vehicleId,
            date: item.date,
            time: item.time,
            pickup: item.pickup,
            destination: item.destination,
            passengers: item.passengers,
            notes: item.notes,
            status: item.status,
            createdAt: stamp(item.createdAt),
            updatedAt: stamp(item.updatedAt),
          })),
        );
      }

      for (const item of sample.enquiries) {
        if (!item.bookingId) continue;
        await tx
          .update(schema.enquiry)
          .set({ bookingId: item.bookingId })
          .where(eq(schema.enquiry.id, item.id));
      }

      const notes = sample.enquiries.flatMap((item) =>
        item.notes.map((note) => ({
          id: note.id,
          enquiryId: item.id,
          body: note.body,
          author: note.author,
          createdAt: stamp(note.createdAt),
        })),
      );
      if (notes.length) await tx.insert(schema.enquiryNote).values(notes);

      const activity = [
        ...sample.enquiries.flatMap((item) =>
          item.activity.map((entry) => ({
            id: entry.id,
            enquiryId: item.id,
            bookingId: null,
            at: stamp(entry.at),
            kind: entry.kind,
            text: entry.text,
          })),
        ),
        ...sample.bookings.flatMap((item) =>
          item.activity.map((entry) => ({
            id: entry.id,
            enquiryId: null,
            bookingId: item.id,
            at: stamp(entry.at),
            kind: entry.kind,
            text: entry.text,
          })),
        ),
      ];
      if (activity.length) await tx.insert(schema.activityEntry).values(activity);
    }
  });

  const counts = {
    vehicles: seed.vehicles.length,
    groupings: seed.fleetCategories.length,
    services: seed.services.length,
    photographs: seed.gallery.length,
    testimonials: seed.testimonials.length,
    homepageBands: seed.homepage.length,
    media: seed.media.length,
  };
  console.log("Seeded from the website's own content:");
  for (const [what, count] of Object.entries(counts)) {
    console.log(`  ${String(count).padStart(4)}  ${what}`);
  }
  if (withSamples) console.log("  plus the sample enquiries, bookings and customers");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
