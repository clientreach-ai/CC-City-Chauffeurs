import { z } from "zod";

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

/** The public enquiry form on the website. */
export const publicEnquirySchema = z.object({
  name: trimmed.min(1).max(80),
  phone: trimmed.max(40).default(""),
  email: trimmed.max(120).default(""),
  replyBy: z.enum(["whatsapp", "phone", "email"]).default("whatsapp"),
  service: trimmed.max(80).default(""),
  vehicleId: z.string().nullable().default(null),
  pickup: trimmed.max(160).default(""),
  dropoff: trimmed.max(160).default(""),
  date: calendarDate.default(""),
  time: trimmed.max(20).default(""),
  passengers: nullableInt.default(null),
  luggage: trimmed.max(120).default(""),
  flight: trimmed.max(40).default(""),
  message: trimmed.max(2000).default(""),
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
