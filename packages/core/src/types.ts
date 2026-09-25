/**
 * The CMS data contract.
 *
 * These types describe what the future API returns and accepts. The admin
 * screens are written against them only — never against the mock adapter —
 * so connecting a real database later means replacing the repository
 * implementations in `./repositories`, not rebuilding the UI.
 *
 * Conventions:
 *   · ids are opaque strings; seeded records keep the ids the public site
 *     already uses ("cullinan", "weddings"), so links stay stable
 *   · dates are ISO-8601 strings; calendar dates are "YYYY-MM-DD"
 *   · a value the client has not confirmed is `null` or "" — never a guess
 *   · a relationship is stored once, on the side that orders it (see the
 *     notes on `Vehicle.categoryIds` and `Vehicle.serviceIds`)
 */

export type ISODateTime = string;
/** "YYYY-MM-DD" */
export type CalendarDate = string;

// ---------------------------------------------------------------- shared

export type PublishStatus = "draft" | "published" | "archived";

/** Two-state visibility for supporting records (categories, gallery). */
export type Visibility = "published" | "draft";

/** A reference to a stored image, as the public site renders it. */
export type ImageRef = {
  src: string;
  width: number;
  height: number;
  /** Required before publishing — describes the photograph, not the brand. */
  alt: string;
  /** The media-library record this came from, when there is one. */
  assetId?: string;
};

export type MediaOrigin =
  /** Came with the website — the client's own photography, registered by the seed. */
  | "site"
  /** Uploaded through the admin. */
  | "local";

export type MediaAsset = {
  id: string;
  /** The absolute address it is served from. */
  src: string;
  /** Its key in the bucket; null for an address this API does not manage. */
  key: string | null;
  width: number;
  height: number;
  /** The description offered when an editor picks it. Each use keeps its own. */
  alt: string;
  filename: string;
  origin: MediaOrigin;
  /** Size of the stored file in bytes, when known. */
  bytes: number | null;
  createdAt: ISODateTime;
};

/** One place on the website a photograph is used. */
export type MediaUsage = {
  kind: "vehicle" | "service" | "gallery" | "homepage" | "settings";
  /** The record: a vehicle, a service, a gallery photograph, a homepage band. */
  id: string;
  /** The record's name as the admin lists it. */
  label: string;
  /** Which slot on that record, e.g. "Main photograph". */
  slot: string;
  /** Whether that record is live on the website. */
  published: boolean;
};

export type Timestamps = {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

// ---------------------------------------------------------------- fleet

export type VehicleAvailability = "chauffeur" | "chauffeur-or-self-drive";

/**
 * PRD §10.7: owned vs sourced is tracked internally and never published.
 * Every seeded vehicle starts "unconfirmed" — the client has said most are
 * owned, but not which.
 */
export type VehicleOwnership = "owned" | "sourced" | "unconfirmed";

export type VehicleFeature = {
  id: string;
  label: string;
  /** Qualifier shown beside the label, e.g. "On request". */
  note: string;
  position: number;
};

export type VehicleSpecs = {
  /** Client-confirmed only. `null` renders as "On enquiry". */
  passengers: number | null;
  /** Client-confirmed only, as written, e.g. "2 large cases". */
  luggage: string;
  year: number | null;
  transmission: string;
  bodyType: string;
};

export type VehiclePricing = {
  /** Indicative, in pounds. `null` renders as "On request". */
  hourlyRate: number | null;
  dayRate: number | null;
  airportNote: string;
  notes: string;
};

export type Vehicle = Timestamps & {
  id: string;
  slug: string;
  name: string;
  make: string;
  model: string;
  /**
   * Membership of the fleet groupings. Stored on the vehicle; the order of
   * vehicles inside a grouping is stored on the grouping (`vehicleOrder`).
   */
  categoryIds: string[];
  /** One editorial line — descriptive, never a specification claim. */
  shortDescription: string;
  description: string;
  specs: VehicleSpecs;
  availability: VehicleAvailability;
  ownership: VehicleOwnership;
  featureIds: string[];
  /**
   * Services this vehicle is offered for. Derived: the relationship is stored
   * on `Service.vehicleIds`, which also orders it on the service page. Writing
   * this field through the repository updates the services.
   */
  serviceIds: string[];
  /** The "Suited to" labels on /fleet. */
  suitedTags: string[];
  pricing: VehiclePricing;
  images: { main: ImageRef | null; gallery: ImageRef[] };
  seo: { title: string; description: string; shareImage: ImageRef | null };
  status: PublishStatus;
  publishedAt: ISODateTime | null;
};

export type FleetCategory = Timestamps & {
  id: string;
  slug: string;
  /** The client's names — "Chauffeur Fleet", "High-Profile SUVs"… */
  title: string;
  summary: string;
  position: number;
  status: Visibility;
  /** Display order of member vehicles. Membership lives on the vehicle. */
  vehicleOrder: string[];
};

// ---------------------------------------------------------------- services

export type ServiceTemplate = "index" | "columns" | "stack";

export type Service = Timestamps & {
  id: string;
  slug: string;
  /** Short name for navigation and indexes, e.g. "Airport Transfers". */
  name: string;
  /** Page title as display type — one entry per line. */
  headline: string[];
  /** One line for overviews, navigation and the footer. */
  summary: string;
  /** The opening paragraph of the page. */
  standfirst: string;
  heroImage: ImageRef | null;
  facts: { label: string; value: string }[];
  /** Key benefits — "What the service involves". */
  benefits: { title: string; copy: string }[];
  detail: { heading: string; paragraphs: string[]; image: ImageRef | null };
  gallery: ImageRef[];
  /** Vehicles typically used, in the order the page shows them. */
  vehicleIds: string[];
  booking: { needs: string[]; note: string };
  enquiry: { heading: string; ctaLabel: string };
  seo: { title: string; description: string };
  template: ServiceTemplate;
  position: number;
  status: PublishStatus;
  publishedAt: ISODateTime | null;
};

// ---------------------------------------------------------------- gallery

export type GalleryCategory =
  | "vehicles"
  | "weddings"
  | "corporate"
  | "events"
  | "airport"
  | "experiences";

export type GalleryItem = Timestamps & {
  id: string;
  image: ImageRef;
  caption: string;
  location: string;
  /** Fleet vehicle pictured, or null for cars that are not on the fleet. */
  vehicleId: string | null;
  /** The row this photograph sits in on /gallery. */
  row: string;
  category: GalleryCategory;
  serviceIds: string[];
  position: number;
  status: Visibility;
};

// ---------------------------------------------------------------- testimonials

export type Testimonial = Timestamps & {
  id: string;
  quote: string;
  /** First name only — surnames are not published. */
  firstName: string;
  role: string;
  /** London district, e.g. "Mayfair". */
  district: string;
  serviceId: string | null;
  date: CalendarDate | "";
  /** The client has written permission from the customer to publish. */
  permission: boolean;
  position: number;
  status: PublishStatus;
};

// ---------------------------------------------------------------- homepage

export type CtaLink = { label: string; href: string };

type SectionBase = {
  id: string;
  /** Admin-facing name of the band. */
  name: string;
  visible: boolean;
  position: number;
  updatedAt: ISODateTime;
};

export type HeroSection = SectionBase & {
  kind: "hero";
  eyebrow: string;
  headingLines: string[];
  body: string;
  image: ImageRef | null;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
};

export type StatementSection = SectionBase & {
  kind: "statement";
  label: string;
  note: string;
  heading: string;
  body: string;
  signatureName: string;
  signatureRole: string;
  link: CtaLink;
};

export type FeaturedServicesSection = SectionBase & {
  kind: "services";
  label: string;
  note: string;
  heading: string;
  body: string;
  serviceIds: string[];
  cta: CtaLink;
};

export type FeaturedFleetSection = SectionBase & {
  kind: "fleet";
  label: string;
  note: string;
  heading: string;
  body: string;
  vehicleIds: string[];
  cta: CtaLink;
};

export type PrinciplesSection = SectionBase & {
  kind: "principles";
  eyebrow: string;
  quote: string;
  image: ImageRef | null;
  items: { title: string; copy: string }[];
};

export type OccasionPanel = {
  id: string;
  eyebrow: string;
  heading: string;
  copy: string;
  image: ImageRef | null;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
};

export type OccasionsSection = SectionBase & {
  kind: "occasions";
  label: string;
  note: string;
  panels: OccasionPanel[];
};

export type TestimonialsSection = SectionBase & {
  kind: "testimonials";
  label: string;
  note: string;
};

export type EnquireSection = SectionBase & {
  kind: "enquire";
  label: string;
  heading: string;
  body: string;
};

export type HomepageSection =
  | HeroSection
  | StatementSection
  | FeaturedServicesSection
  | FeaturedFleetSection
  | PrinciplesSection
  | OccasionsSection
  | TestimonialsSection
  | EnquireSection;

export type HomepageSectionKind = HomepageSection["kind"];

// ---------------------------------------------------------------- settings

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "tiktok" | "x" | "youtube";

export type SiteSettings = {
  business: {
    companyName: string;
    legalName: string;
    director: string;
    tagline: string;
    positioning: string;
    /** Street address. Blank until the client confirms one to publish. */
    address: string;
    base: string;
    coverage: string;
    serviceAreas: string[];
  };
  contact: {
    phoneDisplay: string;
    /** E.164, e.g. "+442084433332". */
    phoneE164: string;
    whatsappDisplay: string;
    /** International digits only, e.g. "447804429407". */
    whatsappNumber: string;
    whatsappIntro: string;
    email: string;
    /** Shown beside the contact details. Never a response-time promise. */
    responseNote: string;
  };
  booking: { terms: string[] };
  /** Only accounts that exist. Empty until the client confirms any. */
  social: { id: string; platform: SocialPlatform; url: string }[];
  seo: {
    siteUrl: string;
    siteTitle: string;
    defaultDescription: string;
    shareImage: ImageRef | null;
  };
  footer: {
    text: string;
    showServiceLinks: boolean;
    showServiceAreas: boolean;
    showContact: boolean;
  };
  updatedAt: ISODateTime;
};

// ---------------------------------------------------------------- operations

export type EnquiryStatus = "new" | "contacted" | "quoted" | "won" | "lost";

/** PRD §10.5 — a one-tap reason whenever an enquiry is lost. */
export type LostReason = "price" | "availability" | "too-slow" | "no-reply" | "other";

export type EnquirySource = "website" | "whatsapp" | "phone" | "email" | "referral";

export type ReplyChannel = "whatsapp" | "phone" | "email";

export type ActivityEntry = {
  id: string;
  at: ISODateTime;
  kind: "created" | "status" | "note" | "quote" | "booking" | "edit";
  text: string;
};

export type Note = {
  id: string;
  body: string;
  author: string;
  createdAt: ISODateTime;
};

export type Enquiry = Timestamps & {
  id: string;
  /** Human reference, e.g. "ENQ-1042". */
  reference: string;
  customerId: string | null;
  /** As given on the enquiry — kept even if the customer record changes. */
  contact: { name: string; phone: string; email: string };
  source: EnquirySource;
  replyBy: ReplyChannel;
  journey: {
    /** A service slug, or one of the extra enquiry options ("supercar-hire"…). */
    service: string;
    vehicleId: string | null;
    pickup: string;
    dropoff: string;
    date: CalendarDate | "";
    time: string;
    passengers: number | null;
    luggage: string;
    flight: string;
  };
  message: string;
  status: EnquiryStatus;
  lostReason: LostReason | null;
  /** A recorded quote. Recording it does not send it to anyone. */
  quote: { amount: number | null; note: string; recordedAt: ISODateTime } | null;
  notes: Note[];
  activity: ActivityEntry[];
  bookingId: string | null;
};

export type BookingStatus = "pending" | "confirmed" | "in-progress" | "completed" | "cancelled";

/**
 * Where a booking came from. Derived rather than stored: a booking made from
 * an enquiry carries that enquiry, and one the assistant recorded carries a
 * submission id of its own, so the column the enquiry table has is not
 * needed here.
 */
export type BookingOrigin = "enquiry" | "whatsapp" | "office";

export type Booking = Timestamps & {
  id: string;
  reference: string;
  customerId: string | null;
  enquiryId: string | null;
  origin: BookingOrigin;
  service: string;
  vehicleId: string | null;
  date: CalendarDate;
  time: string;
  pickup: string;
  destination: string;
  passengers: number | null;
  notes: string;
  status: BookingStatus;
  activity: ActivityEntry[];
};

export type CustomerType = "private" | "corporate" | "event";

export type Customer = Timestamps & {
  id: string;
  name: string;
  type: CustomerType;
  company: string;
  phone: string;
  email: string;
  notes: string;
};

/** A customer with the history the list and detail screens need. */
export type CustomerSummary = Customer & {
  enquiryCount: number;
  bookingCount: number;
  lastActivityAt: ISODateTime;
};

// ---------------------------------------------------------------- inputs

/** Fields the server owns; everything else is editable. */
type ServerOwned = "id" | "createdAt" | "updatedAt" | "publishedAt";

export type VehicleInput = Omit<Vehicle, ServerOwned>;
export type ServiceInput = Omit<Service, ServerOwned | "position">;
export type GalleryItemInput = Omit<GalleryItem, "id" | "createdAt" | "updatedAt" | "position">;
export type TestimonialInput = Omit<Testimonial, "id" | "createdAt" | "updatedAt" | "position">;
export type FleetCategoryInput = Pick<FleetCategory, "title" | "slug" | "summary" | "status">;
export type CustomerInput = Omit<Customer, "id" | "createdAt" | "updatedAt">;

/** Everything the content seed provides, built from the public site's data. */
export type ContentSeed = {
  vehicles: Vehicle[];
  fleetCategories: FleetCategory[];
  features: VehicleFeature[];
  services: Service[];
  gallery: GalleryItem[];
  galleryRows: { id: string; label: string }[];
  testimonials: Testimonial[];
  homepage: HomepageSection[];
  settings: SiteSettings;
  media: MediaAsset[];
  /** The enquiry form's service list — slugs plus the extra options. */
  enquiryServices: { value: string; label: string }[];
};
