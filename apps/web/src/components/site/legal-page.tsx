import Link from "next/link";

import { shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { routes } from "@/content/site";
import { formatDate, LEGAL_DEFAULTS_DATE } from "@CC-City-Chauffeurs/core";
import type { PublicLegalDocument } from "@/lib/site-data";

/**
 * A legal page: plain type on the dark ground, no hero photograph. These are
 * read to be relied on, so the measure is kept narrow and every heading is a
 * real heading for a screen reader's outline.
 *
 * The text is whatever the editors last saved in the admin (Website → Legal
 * pages), or the default wording until they have.
 */
export function LegalPage({ document }: { document: PublicLegalDocument }) {
  return (
    <article className="bg-ink text-white">
      <div className={`${shell} pt-36 pb-24 lg:pt-44 lg:pb-36`}>
        <nav aria-label="Breadcrumb" className="label-xs flex gap-3 text-white/60">
          <Link href={routes.home} className="link-quiet hover:text-white">
            Home
          </Link>
          <span aria-hidden>/</span>
          <span className="text-silver">{document.title}</span>
        </nav>

        <h1 className="display-lg mt-8 text-white">{document.title}</h1>
        <p className="copy-lg mt-8 max-w-[56ch] text-white/75">{document.summary}</p>
        <p className="label-xs mt-6 text-white/60">
          Last updated {formatDate(document.updatedAt ?? LEGAL_DEFAULTS_DATE)}
        </p>

        <div className="mt-16 max-w-[68ch]">
          {document.sections.map((section) => (
            <section key={section.heading} className="border-t border-hairline py-10">
              <h2 className="display-sm text-white">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="copy mt-5 text-white/75">
                  {paragraph}
                </p>
              ))}
              {section.points?.length ? (
                <ul className="mt-5 flex flex-col gap-3">
                  {section.points.map((point) => (
                    <li key={point} className="copy flex gap-4 text-white/75">
                      <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-white/50" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
