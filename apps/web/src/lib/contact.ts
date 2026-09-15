import type { SiteSettings } from "@CC-City-Chauffeurs/core";

/**
 * The ways to reach the business, built from the settings the admin holds.
 *
 * One definition, so a number changed in the admin changes every place the
 * site prints it — the homepage band, the contact page, the quote page and
 * the footer — rather than three of the four.
 */

export function whatsappLink(settings: SiteSettings, message?: string) {
  const base = `https://wa.me/${settings.contact.whatsappNumber}`;
  const text = message ?? settings.contact.whatsappIntro;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(settings: SiteSettings) {
  return `tel:${settings.contact.phoneE164}`;
}

export function mailLink(settings: SiteSettings) {
  return `mailto:${settings.contact.email}`;
}

export type Channel = {
  label: string;
  value: string;
  note: string;
  href: string;
  external?: boolean;
};

/** A channel with no number or address configured is not offered at all. */
export function contactChannels(
  settings: SiteSettings,
  notes: { whatsapp: string; phone: string; email: string },
): Channel[] {
  const { contact } = settings;
  return [
    {
      label: "WhatsApp",
      value: contact.whatsappDisplay,
      note: notes.whatsapp,
      href: whatsappLink(settings),
      external: true,
    },
    { label: "Telephone", value: contact.phoneDisplay, note: notes.phone, href: telLink(settings) },
    { label: "Email", value: contact.email, note: notes.email, href: mailLink(settings) },
  ].filter((channel) => channel.value);
}

/** What the enquiry form needs to reach the business. */
export function contactDetails(settings: SiteSettings) {
  return {
    phoneDisplay: settings.contact.phoneDisplay,
    phoneE164: settings.contact.phoneE164,
    email: settings.contact.email,
    whatsappNumber: settings.contact.whatsappNumber,
    whatsappIntro: settings.contact.whatsappIntro,
  };
}
