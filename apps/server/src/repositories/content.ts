import {
  assertValid,
  CmsNotFoundError,
  validateSection,
  validateSettings,
  type HomepageSection,
  type SiteSettings,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { asc, eq } from "drizzle-orm";

import { iso } from "../lib/ids";

/**
 * The homepage bands and the site settings.
 *
 * The homepage is a fixed set of editorial bands: editors change the words,
 * photographs, links, order and visibility of a band, never its layout. So a
 * band is stored as its columns plus one document of per-kind fields, and
 * reassembled into the union the website and the admin both compile against.
 *
 * Routes: GET /homepage, PATCH /homepage/sections/:id, PUT /homepage/order,
 * GET/PUT /settings.
 */

type SectionRow = typeof schema.homepageSection.$inferSelect;

function toSection(row: SectionRow): HomepageSection {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    visible: row.visible,
    position: row.position,
    updatedAt: iso(row.updatedAt),
    ...row.data,
  } as HomepageSection;
}

/** Splits the union back into columns and the per-kind document. */
function toRow(section: HomepageSection) {
  const { id, kind, name, visible, position, updatedAt, ...data } = section;
  return { id, kind, name, visible, position, data: data as Record<string, unknown> };
}

export async function getHomepage(): Promise<HomepageSection[]> {
  const rows = await db
    .select()
    .from(schema.homepageSection)
    .orderBy(asc(schema.homepageSection.position));
  return rows.map(toSection);
}

export async function updateSection(section: HomepageSection): Promise<HomepageSection> {
  assertValid(validateSection(section));

  const [current] = await db
    .select()
    .from(schema.homepageSection)
    .where(eq(schema.homepageSection.id, section.id))
    .limit(1);
  if (!current) throw new CmsNotFoundError("This section");

  const next = toRow(section);
  await db
    .update(schema.homepageSection)
    .set({
      name: next.name,
      // The hero opens the page and is always shown.
      visible: next.kind === "hero" ? true : next.visible,
      data: next.data,
      updatedAt: new Date(),
    })
    .where(eq(schema.homepageSection.id, section.id));

  const [row] = await db
    .select()
    .from(schema.homepageSection)
    .where(eq(schema.homepageSection.id, section.id))
    .limit(1);
  return toSection(row!);
}

export async function setSectionVisibility(id: string, visible: boolean): Promise<void> {
  const [current] = await db
    .select()
    .from(schema.homepageSection)
    .where(eq(schema.homepageSection.id, id))
    .limit(1);
  if (!current) throw new CmsNotFoundError("This section");
  if (current.kind === "hero") return;

  await db
    .update(schema.homepageSection)
    .set({ visible, updatedAt: new Date() })
    .where(eq(schema.homepageSection.id, id));
}

/** The hero stays first whatever order is sent. */
export async function reorderSections(ids: string[]): Promise<void> {
  const ordered = ["hero", ...ids.filter((id) => id !== "hero")];
  await db.transaction(async (tx) => {
    for (const [position, id] of ordered.entries()) {
      await tx
        .update(schema.homepageSection)
        .set({ position })
        .where(eq(schema.homepageSection.id, id));
    }
  });
}

// ------------------------------------------------------------------ settings

type SettingsRow = typeof schema.siteSettings.$inferSelect;

function toSettings(row: SettingsRow): SiteSettings {
  return {
    business: row.business,
    contact: row.contact,
    booking: row.booking,
    social: row.social,
    seo: row.seo,
    footer: row.footer,
    updatedAt: iso(row.updatedAt),
  };
}

export async function getSettings(): Promise<SiteSettings> {
  const [row] = await db
    .select()
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.id, "default"))
    .limit(1);
  if (!row) throw new CmsNotFoundError("The site settings");
  return toSettings(row);
}

export async function updateSettings(settings: SiteSettings): Promise<SiteSettings> {
  assertValid(validateSettings(settings));
  await db
    .update(schema.siteSettings)
    .set({
      business: settings.business,
      contact: settings.contact,
      booking: settings.booking,
      social: settings.social,
      seo: settings.seo,
      footer: settings.footer,
      updatedAt: new Date(),
    })
    .where(eq(schema.siteSettings.id, "default"));
  return getSettings();
}

/** Reference list the enquiry forms need. */
export async function getEnquiryServices() {
  const rows = await db
    .select()
    .from(schema.enquiryServiceOption)
    .orderBy(asc(schema.enquiryServiceOption.position));
  return rows.map((row) => ({ value: row.value, label: row.label }));
}
