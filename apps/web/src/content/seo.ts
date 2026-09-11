import type { Metadata } from "next";

import { site } from "./site";

/**
 * The share card — the client's own photograph with the logo, so a link
 * pasted into WhatsApp shows the Cullinan rather than a blank preview.
 *
 * Every page references it explicitly: Next overwrites a parent's `openGraph`
 * object wholesale when a page sets its own, so an image set once in the root
 * layout (or by an `opengraph-image` file) silently disappears from every
 * page that defines a title.
 */
export const shareImage = {
  url: "/og/city-chauffeurs.jpg",
  width: 1200,
  height: 630,
  alt: "A black Rolls-Royce Cullinan waiting at a London hotel entrance at night, with the CC City Chauffeurs logo",
} as const;

/**
 * One shape of metadata for every public page, so titles, descriptions,
 * canonicals and social cards can never drift apart page by page.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  /** Aim for 160 characters or fewer — search results cut the rest. */
  description: string;
  /** Route path, e.g. "/fleet". Resolved against `metadataBase`. */
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: site.legalName,
      locale: "en_GB",
      type: "website",
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage],
    },
  };
}
