import "server-only";

import type { Metadata } from "next";

import type { SiteSettings } from "@CC-City-Chauffeurs/core";
import { shareImage as defaultShareImage } from "@/content/seo";
import { site } from "@/content/site";
import { getSite } from "@/lib/site-data";

/**
 * Titles, descriptions, canonicals and social cards, built from the SEO
 * settings the admin holds — so the site URL, default title, description and
 * share card an editor sets are the ones the pages actually carry. The values
 * in `content/` are only the fallback for a field left empty.
 */

type Seo = SiteSettings["seo"];

/** The live site's own address, with no trailing slash. */
export function siteUrlOf(seo: Seo | undefined) {
  return (seo?.siteUrl || site.url).replace(/\/+$/, "");
}

/** Resolves a stored address — absolute, or site-relative — to an absolute one. */
export function absoluteUrl(src: string, siteUrl: string) {
  return new URL(src, `${siteUrl}/`).href;
}

function shareImageOf(seo: Seo | undefined) {
  const image = seo?.shareImage;
  if (!image?.src) return defaultShareImage;
  return { url: image.src, width: image.width, height: image.height, alt: image.alt };
}

/** The defaults every page inherits: base URL, title, description, card. */
export async function siteMetadata(): Promise<Metadata> {
  const settings = (await getSite())?.settings;
  const seo = settings?.seo;
  const legalName = settings?.business.legalName || site.legalName;
  const image = shareImageOf(seo);

  return {
    // Resolves every relative canonical and social URL against the live domain.
    metadataBase: new URL(siteUrlOf(seo)),
    title: seo?.siteTitle || "CC City Chauffeurs | Luxury Chauffeur Service, London",
    description: seo?.defaultDescription || site.positioning,
    applicationName: legalName,
    openGraph: { siteName: legalName, locale: "en_GB", type: "website", images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
    // Phone numbers on the page are real links already; stop iOS restyling them.
    formatDetection: { telephone: false },
  };
}

/**
 * One shape of metadata for every public page, so titles, descriptions,
 * canonicals and social cards can never drift apart page by page.
 *
 * Every page names the share card explicitly: Next overwrites a parent's
 * `openGraph` object wholesale when a page sets its own, so a card set once in
 * the root layout silently disappears from every page that defines a title.
 */
export async function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  /** Aim for 160 characters or fewer — search results cut the rest. */
  description: string;
  /** Route path, e.g. "/fleet". Resolved against `metadataBase`. */
  path: string;
}): Promise<Metadata> {
  const settings = (await getSite())?.settings;
  const image = shareImageOf(settings?.seo);
  const siteName = settings?.business.legalName || site.legalName;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName,
      locale: "en_GB",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
