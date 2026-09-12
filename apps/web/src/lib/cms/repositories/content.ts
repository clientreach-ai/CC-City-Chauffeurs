import { getDatabase, latency, now } from "../store/database";
import type { CtaLink, HomepageSection, SiteSettings } from "../types";
import { assertValid, CmsNotFoundError, SEO_LIMITS, validator, type FieldErrors } from "../validation";

/**
 * Homepage content and site settings.
 *
 * The homepage is a fixed set of editorial bands. Editors change the words,
 * photographs, links, order and visibility of each band — not its layout.
 *
 * Future API: GET /homepage, PATCH /homepage/sections/:id,
 * PUT /homepage/order, GET/PUT /settings.
 */

// ------------------------------------------------------------------ homepage

function checkCta(v: ReturnType<typeof validator>, field: string, cta: CtaLink, required: boolean) {
  if (required) v.required(`${field}.label`, cta.label, "Add the button text.");
  if (cta.label.trim()) v.required(`${field}.href`, cta.href, "Add where the button goes.");
  v.maxLength(`${field}.label`, cta.label, 40).link(`${field}.href`, cta.href);
}

export function validateSection(section: HomepageSection): FieldErrors {
  const v = validator();
  switch (section.kind) {
    case "hero":
      v.required("headingLines", section.headingLines.filter((line) => line.trim()), "Add the headline.")
        .custom("headingLines", section.headingLines.length > 4, "Keep the headline to four lines or fewer.")
        .maxLength("body", section.body, 220)
        .required("image", section.image, "The hero needs a photograph.")
        .custom("image", section.image != null && !section.image.alt.trim(), "Describe the photograph (alt text).");
      checkCta(v, "primaryCta", section.primaryCta, true);
      checkCta(v, "secondaryCta", section.secondaryCta, false);
      break;
    case "statement":
      v.required("heading", section.heading, "Add the statement.").maxLength("body", section.body, 420);
      checkCta(v, "link", section.link, false);
      break;
    case "services":
      v.required("heading", section.heading, "Add a heading.")
        .required("serviceIds", section.serviceIds, "Feature at least one service.")
        .custom("serviceIds", section.serviceIds.length > 6, "Feature six services or fewer.");
      checkCta(v, "cta", section.cta, false);
      break;
    case "fleet":
      v.required("heading", section.heading, "Add a heading.")
        .required("vehicleIds", section.vehicleIds, "Feature at least one vehicle.")
        .custom("vehicleIds", section.vehicleIds.length > 3, "Feature three vehicles or fewer.");
      checkCta(v, "cta", section.cta, false);
      break;
    case "principles":
      v.required("quote", section.quote, "Add the line set over the photograph.")
        .custom("image", section.image != null && !section.image.alt.trim(), "Describe the photograph (alt text).");
      section.items.forEach((item, i) => {
        v.required(`items.${i}.title`, item.title, "Add a title.").required(`items.${i}.copy`, item.copy, "Add the copy.");
      });
      break;
    case "occasions":
      section.panels.forEach((panel, i) => {
        v.required(`panels.${i}.heading`, panel.heading, "Add a heading.")
          .required(`panels.${i}.image`, panel.image, "Each panel needs a photograph.")
          .custom(
            `panels.${i}.image`,
            panel.image != null && !panel.image.alt.trim(),
            "Describe the photograph (alt text).",
          );
        checkCta(v, `panels.${i}.primaryCta`, panel.primaryCta, true);
        checkCta(v, `panels.${i}.secondaryCta`, panel.secondaryCta, false);
      });
      break;
    case "testimonials":
      v.required("label", section.label, "Add the band label.");
      break;
    case "enquire":
      v.required("heading", section.heading, "Add the heading.").maxLength("body", section.body, 320);
      break;
  }
  return v.result();
}

export async function getHomepage(): Promise<HomepageSection[]> {
  await latency("read");
  return getDatabase()
    .read("homepage")
    .sort((a, b) => a.position - b.position);
}

export async function updateSection(section: HomepageSection): Promise<HomepageSection> {
  await latency("write");
  assertValid(validateSection(section));
  const db = getDatabase();
  if (!db.read("homepage").some((item) => item.id === section.id)) throw new CmsNotFoundError("This section");
  const next = { ...structuredClone(section), updatedAt: now() };
  // The hero opens the page and is always shown.
  if (next.kind === "hero") next.visible = true;
  db.write((draft) => {
    draft.homepage = draft.homepage.map((item) => (item.id === section.id ? next : item));
  });
  return next;
}

export async function setSectionVisibility(id: string, visible: boolean): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    const section = draft.homepage.find((item) => item.id === id);
    if (!section) throw new CmsNotFoundError("This section");
    if (section.kind === "hero") return;
    section.visible = visible;
    section.updatedAt = now();
  });
}

/** The hero stays first whatever order is sent. */
export async function reorderSections(ids: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    const ordered = ["hero", ...ids.filter((id) => id !== "hero")];
    for (const section of draft.homepage) {
      const position = ordered.indexOf(section.id);
      if (position >= 0) section.position = position;
    }
  });
}

// ------------------------------------------------------------------ settings

export function validateSettings(settings: SiteSettings): FieldErrors {
  const v = validator()
    .required("business.companyName", settings.business.companyName, "Add the trading name.")
    .required("business.legalName", settings.business.legalName, "Add the legal name.")
    .required("contact.phoneDisplay", settings.contact.phoneDisplay, "Add the office number.")
    .phone("contact.phoneDisplay", settings.contact.phoneDisplay)
    .required("contact.phoneE164", settings.contact.phoneE164, "Add the number in international format.")
    .custom(
      "contact.phoneE164",
      !!settings.contact.phoneE164 && !/^\+\d{8,15}$/.test(settings.contact.phoneE164),
      "Use + followed by the country code and number, no spaces — e.g. +442084433332.",
    )
    .required("contact.whatsappNumber", settings.contact.whatsappNumber, "Add the WhatsApp number.")
    .custom(
      "contact.whatsappNumber",
      !!settings.contact.whatsappNumber && !/^\d{8,15}$/.test(settings.contact.whatsappNumber),
      "Digits only, starting with the country code — e.g. 447804429407.",
    )
    .required("contact.email", settings.contact.email, "Add the enquiries email address.")
    .email("contact.email", settings.contact.email)
    .maxLength("contact.responseNote", settings.contact.responseNote, 160)
    .required("seo.siteTitle", settings.seo.siteTitle, "Add the default page title.")
    .maxLength("seo.siteTitle", settings.seo.siteTitle, SEO_LIMITS.title)
    .required("seo.defaultDescription", settings.seo.defaultDescription, "Add the default description.")
    .maxLength("seo.defaultDescription", settings.seo.defaultDescription, SEO_LIMITS.description)
    .url("seo.siteUrl", settings.seo.siteUrl);

  settings.social.forEach((link, i) => {
    v.required(`social.${i}.url`, link.url, "Add the profile address, or remove this link.").url(
      `social.${i}.url`,
      link.url,
    );
  });
  return v.result();
}

export async function getSettings(): Promise<SiteSettings> {
  await latency("read");
  return getDatabase().read("settings");
}

export async function updateSettings(settings: SiteSettings): Promise<SiteSettings> {
  await latency("write");
  assertValid(validateSettings(settings));
  const next = { ...structuredClone(settings), updatedAt: now() };
  getDatabase().write((draft) => {
    draft.settings = next;
  });
  return next;
}

/** Reference lists the forms need — the enquiry service options. */
export async function getEnquiryServices() {
  await latency("read");
  return getDatabase().read("enquiryServices");
}

/** Throws away every local change and restores the seeded content. */
export async function resetLocalData(): Promise<void> {
  await latency("write");
  getDatabase().reset();
}
