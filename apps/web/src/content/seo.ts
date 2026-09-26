/**
 * The share card — the client's own photograph with the logo, so a link
 * pasted into WhatsApp shows the Cullinan rather than a blank preview.
 *
 * The seed stores this as the site's share card, and the pages fall back to
 * it when the admin's setting is empty. What the pages carry is built in
 * `lib/metadata.ts`, from the settings.
 */
export const shareImage = {
  url: "/og/city-chauffeurs.jpg",
  width: 1200,
  height: 630,
  alt: "A black Rolls-Royce Cullinan waiting at a London hotel entrance at night, with the CC City Chauffeurs logo",
} as const;
