import { z } from "zod";

import { PUBLIC_FORM_LIMITS } from "./validation";

/**
 * Shape validation for every request body the API accepts.
 *
 * This is the outer gate: it proves the JSON is the right *shape* before any
 * of it reaches the database. The rules about what may be *published* — a
 * testimonial needs recorded permission, a photograph needs a description —
 * live in `validation.ts`, which the admin forms run too, so a rule is
 * written once and enforced in both places.
 */

// ---------------------------------------------------------------- primitives

const trimmed = z.string().trim();
/** "YYYY-MM-DD", or "" where the date is not yet known. */
const calendarDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]);
const nullableInt = z.number().int().nullable();
const nullableAmount = z.number().nullable();

export const imageRefSchema = z.object({
  src: trimmed.min(1),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  alt: z.string(),
  assetId: z.string().optional(),
});

export const ctaLinkSchema = z.object({ label: z.string(), href: z.string() });

export const publishStatusSchema = z.enum(["draft", "published", "archived"]);
export const visibilitySchema = z.enum(["published", "draft"]);

// ---------------------------------------------------------------- fleet

export const vehicleInputSchema = z.object({
  slug: z.string(),
  name: z.string(),
  make: z.string(),
  model: z.string(),
  categoryIds: z.array(z.string()),
  shortDescription: z.string(),
  description: z.string(),
  specs: z.object({
    passengers: nullableInt,
    luggage: z.string(),
    year: nullableInt,
    transmission: z.string(),
    bodyType: z.string(),
  }),
  availability: z.enum(["chauffeur", "chauffeur-or-self-drive"]),
  ownership: z.enum(["owned", "sourced", "unconfirmed"]),
  featureIds: z.array(z.string()),
  serviceIds: z.array(z.string()),
  suitedTags: z.array(z.string()),
  pricing: z.object({
    hourlyRate: nullableAmount,
    dayRate: nullableAmount,
    airportNote: z.string(),
    notes: z.string(),
  }),
  images: z.object({
    main: imageRefSchema.nullable(),
    gallery: z.array(imageRefSchema),
  }),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    shareImage: imageRefSchema.nullable(),
  }),
  status: publishStatusSchema,
});

export const fleetCategoryInputSchema = z.object({
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  status: visibilitySchema,
});

export const featureInputSchema = z.object({
  label: z.string(),
  note: z.string().default(""),
});

// ---------------------------------------------------------------- services

export const serviceInputSchema = z.object({
  slug: z.string(),
  name: z.string(),
  headline: z.array(z.string()),
  summary: z.string(),
  standfirst: z.string(),
  heroImage: imageRefSchema.nullable(),
  facts: z.array(z.object({ label: z.string(), value: z.string() })),
  benefits: z.array(z.object({ title: z.string(), copy: z.string() })),
  detail: z.object({
    heading: z.string(),
    paragraphs: z.array(z.string()),
    image: imageRefSchema.nullable(),
  }),
  gallery: z.array(imageRefSchema),
  vehicleIds: z.array(z.string()),
  booking: z.object({ needs: z.array(z.string()), note: z.string() }),
  enquiry: z.object({ heading: z.string(), ctaLabel: z.string() }),
  seo: z.object({ title: z.string(), description: z.string() }),
  template: z.enum(["index", "columns", "stack"]),
  status: publishStatusSchema,
});

// ---------------------------------------------------------------- gallery

export const galleryCategorySchema = z.enum([
  "vehicles",
  "weddings",
  "corporate",
  "events",
  "airport",
  "experiences",
]);

export const galleryItemInputSchema = z.object({
  image: imageRefSchema,
  caption: z.string(),
  location: z.string(),
  vehicleId: z.string().nullable(),
  row: z.string(),
  category: galleryCategorySchema,
  serviceIds: z.array(z.string()),
  status: visibilitySchema,
});

export const addGalleryImagesSchema = z.object({
  images: z.array(imageRefSchema).min(1),
  defaults: z.object({
    row: z.string(),
    category: galleryCategorySchema,
    vehicleId: z.string().nullable(),
  }),
});

export const galleryBulkStatusSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: visibilitySchema,
});

// ---------------------------------------------------------------- testimonials

export const testimonialInputSchema = z.object({
  quote: z.string(),
  firstName: z.string(),
  role: z.string(),
  district: z.string(),
  serviceId: z.string().nullable(),
  date: calendarDate,
  permission: z.boolean(),
  status: publishStatusSchema,
});

// ---------------------------------------------------------------- homepage

const sectionBase = {
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  position: z.number().int(),
  updatedAt: z.string().optional(),
};

const occasionPanelSchema = z.object({
  id: z.string(),
  eyebrow: z.string(),
  heading: z.string(),
  copy: z.string(),
  image: imageRefSchema.nullable(),
  primaryCta: ctaLinkSchema,
  secondaryCta: ctaLinkSchema,
});

export const homepageSectionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...sectionBase,
    kind: z.literal("hero"),
    eyebrow: z.string(),
    headingLines: z.array(z.string()),
    body: z.string(),
    image: imageRefSchema.nullable(),
    primaryCta: ctaLinkSchema,
    secondaryCta: ctaLinkSchema,
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("statement"),
    label: z.string(),
    note: z.string(),
    heading: z.string(),
    body: z.string(),
    signatureName: z.string(),
    signatureRole: z.string(),
    link: ctaLinkSchema,
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("services"),
    label: z.string(),
    note: z.string(),
    heading: z.string(),
    body: z.string(),
    serviceIds: z.array(z.string()),
    cta: ctaLinkSchema,
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("fleet"),
    label: z.string(),
    note: z.string(),
    heading: z.string(),
    body: z.string(),
    vehicleIds: z.array(z.string()),
    cta: ctaLinkSchema,
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("principles"),
    eyebrow: z.string(),
    quote: z.string(),
    image: imageRefSchema.nullable(),
    items: z.array(z.object({ title: z.string(), copy: z.string() })),
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("occasions"),
    label: z.string(),
    note: z.string(),
    panels: z.array(occasionPanelSchema),
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("testimonials"),
    label: z.string(),
    note: z.string(),
  }),
  z.object({
    ...sectionBase,
    kind: z.literal("enquire"),
    label: z.string(),
    heading: z.string(),
    body: z.string(),
  }),
]);

// ---------------------------------------------------------------- settings

export const siteSettingsSchema = z.object({
  business: z.object({
    companyName: z.string(),
    legalName: z.string(),
    director: z.string(),
    tagline: z.string(),
    positioning: z.string(),
    address: z.string(),
    base: z.string(),
    coverage: z.string(),
    serviceAreas: z.array(z.string()),
  }),
  contact: z.object({
    phoneDisplay: z.string(),
    phoneE164: z.string(),
    whatsappDisplay: z.string(),
    whatsappNumber: z.string(),
    whatsappIntro: z.string(),
    email: z.string(),
    responseNote: z.string(),
  }),
  booking: z.object({ terms: z.array(z.string()) }),
  social: z.array(
    z.object({
      id: z.string(),
      platform: z.enum(["instagram", "facebook", "linkedin", "tiktok", "x", "youtube"]),
      url: z.string(),
    }),
  ),
  seo: z.object({
    siteUrl: z.string(),
    siteTitle: z.string(),
    defaultDescription: z.string(),
    shareImage: imageRefSchema.nullable(),
  }),
  footer: z.object({
    text: z.string(),
    showServiceLinks: z.boolean(),
    showServiceAreas: z.boolean(),
    showContact: z.boolean(),
  }),
  updatedAt: z.string().optional(),
});

// ---------------------------------------------------------------- operations

export const enquiryStatusSchema = z.enum(["new", "contacted", "quoted", "won", "lost"]);
export const lostReasonSchema = z.enum(["price", "availability", "too-slow", "no-reply", "other"]);
export const bookingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
]);

export const enquiryStatusUpdateSchema = z.object({
  status: enquiryStatusSchema,
  lostReason: lostReasonSchema.optional(),
});

export const quoteInputSchema = z.object({
  amount: nullableAmount,
  note: z.string().default(""),
});

export const noteInputSchema = z.object({
  body: z.string(),
  author: z.string().optional(),
});

export const customerInputSchema = z.object({
  name: z.string(),
  type: z.enum(["private", "corporate", "event"]),
  company: z.string(),
  phone: z.string(),
  email: z.string(),
  notes: z.string(),
});

export const bookingStatusUpdateSchema = z.object({ status: bookingStatusSchema });
export const bookingNotesSchema = z.object({ notes: z.string() });

// ---------------------------------------------------------------- the public forms

/**
 * The website's forms and these schemas share `PUBLIC_FORM_LIMITS`, so a
 * field the form lets someone fill is never one the API then refuses.
 *
 * The public path validates the *shape* of an email address and a telephone
 * number as well as the length. `updateCustomer` has always done so on the
 * admin side; a visitor typing "sarah@gmail" into the one form that matters
 * deserves the same courtesy, because a contact detail that cannot be replied
 * to is an enquiry lost.
 */

const publicEmail = capped(PUBLIC_FORM_LIMITS.email, "email address")
  .default("")
  .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), {
    message: "That email address does not look complete.",
  });

const publicPhone = capped(PUBLIC_FORM_LIMITS.phone, "telephone number")
  .default("")
  .refine((value) => !value || value.replace(/[^\d]/g, "").length >= 7, {
    message: "That number looks too short — include the area code.",
  });

/**
 * The browser's own id for this submission, sent back unchanged on a retry.
 * A visitor who presses "Open WhatsApp again" or loses signal mid-send would
 * otherwise leave the office two identical records to untangle; the API
 * returns the first reference instead of recording a second enquiry.
 */
const submissionId = trimmed.max(64).default("");

/**
 * A field no person can see and every crude bot fills in. Anything arriving
 * with it set is dropped without a record; the form renders it hidden, off
 * the tab order and with autocomplete off.
 */
const honeypot = trimmed.max(200).default("");

/**
 * A length a customer could exceed, with a message written for them.
 *
 * Left to itself the library says "Too big: expected string to have <=160
 * characters", which is addressed to whoever wrote the form rather than to
 * the person filling it in. These are the only validation messages a customer
 * ever reads.
 */
function capped(limit: number, field: string) {
  return trimmed.max(limit, `Please keep the ${field} under ${limit} characters.`);
}

/** What both public forms ask for: who is asking, and about what journey. */
const publicJourney = {
  /**
   * The messages are written out because these are the only validation
   * messages a customer ever reads. Left to itself the library says "Too
   * small: expected string to have >=1 characters", which is addressed to
   * whoever wrote the form, not to the person filling it in.
   */
  name: trimmed
    .min(1, "Tell us your name so we know who we are replying to.")
    .max(PUBLIC_FORM_LIMITS.name, `Please keep the name under ${PUBLIC_FORM_LIMITS.name} characters.`),
  phone: publicPhone,
  email: publicEmail,
  service: capped(PUBLIC_FORM_LIMITS.service, "service").default(""),
  vehicleId: z.string().nullable().default(null),
  pickup: capped(PUBLIC_FORM_LIMITS.pickup, "pick-up address").default(""),
  dropoff: capped(PUBLIC_FORM_LIMITS.dropoff, "destination").default(""),
  time: capped(PUBLIC_FORM_LIMITS.time, "time").default(""),
  passengers: nullableInt.default(null),
  luggage: capped(PUBLIC_FORM_LIMITS.luggage, "luggage note").default(""),
  flight: capped(PUBLIC_FORM_LIMITS.flight, "flight number").default(""),
  message: capped(PUBLIC_FORM_LIMITS.message, "message").default(""),
  submissionId,
  website: honeypot,
};

/** The public enquiry form on the website. */
export const publicEnquirySchema = z.object({
  ...publicJourney,
  replyBy: z.enum(["whatsapp", "phone", "email"]).default("whatsapp"),
  /** An enquiry may be about a date the visitor has not settled on yet. */
  date: calendarDate.default(""),
});

/**
 * The website's booking request. Not a reservation: it lands as a `pending`
 * booking for the office to confirm, exactly as one raised from a won enquiry
 * does — there is one set of booking statuses and this uses it.
 *
 * The date is required, because a booking is a row in the diary and the diary
 * has a column for it. An enquiry is where "sometime in June" belongs.
 */
export const publicBookingSchema = z.object({
  ...publicJourney,
  date: z
    .string({ error: "Choose the date of the journey." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date of the journey."),
});

// ---------------------------------------------------------------- shared

export const reorderSchema = z.object({ ids: z.array(z.string()) });
export const idsSchema = z.object({ ids: z.array(z.string()).min(1) });
export const statusSchema = z.object({ status: publishStatusSchema });
export const visibilityUpdateSchema = z.object({ status: visibilitySchema });
export const visibleSchema = z.object({ visible: z.boolean() });

export const mediaInputSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  alt: z.string().default(""),
  filename: z.string(),
  bytes: z.number().int().nullable().default(null),
});

export type PublicEnquiryInput = z.infer<typeof publicEnquirySchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
