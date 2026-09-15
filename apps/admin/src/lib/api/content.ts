import type { HomepageSection, SiteSettings } from "@CC-City-Chauffeurs/core";

import { api } from "./client";

export { validateSection, validateSettings } from "@CC-City-Chauffeurs/core";

/** The homepage bands and the site settings. */

export async function getHomepage() {
  return api.get<HomepageSection[]>("/homepage");
}

export async function updateSection(section: HomepageSection) {
  return api.patch<HomepageSection>(`/homepage/sections/${section.id}`, section);
}

export async function setSectionVisibility(id: string, visible: boolean) {
  return api.patch<void>(`/homepage/sections/${id}/visibility`, { visible });
}

/** The hero stays first whatever order is sent. */
export async function reorderSections(ids: string[]) {
  return api.put<void>("/homepage/order", { ids });
}

export async function getSettings() {
  return api.get<SiteSettings>("/settings");
}

export async function updateSettings(settings: SiteSettings) {
  return api.put<SiteSettings>("/settings", settings);
}

/** Reference list the forms need — the enquiry service options. */
export async function getEnquiryServices() {
  return api.get<{ value: string; label: string }[]>("/enquiry-services");
}
