import Image from "next/image";

import { media } from "@/content/media";
import { contact, site } from "@/content/site";
import { Enter } from "./enter";
import { shell } from "./primitives";
import { QuoteBar } from "./quote-bar";

/**
 * Facts, not claims. Each of these is evidenced by the client intake — see
 * the gated list in `content/site.ts` for what may not appear here.
 */
const heroFacts = [
  { label: "Based", value: "London · UK & Europe" },
  { label: "Airports", value: "Meet & greet · Flight tracking" },
  { label: "Enquiries", value: contact.phoneDisplay, href: contact.phoneHref },
];

/**
 * The vehicle is the hero object, so display type never crosses its
 * silhouette. Two deliberate compositions rather than one shrunk down:
 *   · small screens — full-bleed photograph above a type band
 *   · sm and up     — cinematic full-screen photograph with a baseline band
 *
 * The quote bar is docked into the baseline. Every reference design puts a
 * search bar here; ours asks the two questions that start a quote, because
 * the commercial goal is a price in the visitor's hands, not a search result.
 */
export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh w-full flex-col overflow-hidden bg-obsidian"
    >
      <div className="relative h-[52svh] w-full shrink-0 sm:absolute sm:inset-0 sm:h-full">
        <Image
          src={media.hero}
          alt="Rolls-Royce Cullinan waiting at a London hotel entrance at night"
          fill
          priority
          quality={90}
          sizes="100vw"
          placeholder="blur"
          className="object-cover object-[34%_center] sm:object-[center_38%]"
        />
        {/* Scrims: navigation legibility, the type band, and — on wider
            screens — a gentle draw from the left so the display face holds. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,7,0.72)_0%,rgba(6,6,7,0.2)_18%,rgba(6,6,7,0)_36%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,6,7,1)_0%,rgba(6,6,7,0.5)_14%,rgba(6,6,7,0)_34%)] sm:bg-[linear-gradient(0deg,rgba(6,6,7,0.97)_0%,rgba(6,6,7,0.9)_20%,rgba(6,6,7,0.68)_32%,rgba(6,6,7,0.3)_46%,rgba(6,6,7,0.05)_62%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden sm:block sm:bg-[linear-gradient(90deg,rgba(6,6,7,0.6)_0%,rgba(6,6,7,0.15)_38%,rgba(6,6,7,0)_62%)]"
        />
        {/* Corners fall away so the headline holds against the photograph */}
        <div aria-hidden className="vignette absolute inset-0" />
      </div>

      <div className="relative flex flex-1 flex-col justify-end pt-7 sm:pt-28">
        <div className={`${shell} pb-8 sm:pb-10`}>
          <div className="grid grid-cols-1 gap-x-16 gap-y-9 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Enter delay={120}>
                <p className="label-xs flex items-center gap-3 text-silver">
                  <span aria-hidden className="h-px w-8 bg-silver/50" />
                  {site.tagline}
                </p>
              </Enter>

              <Enter delay={220} className="mt-5 sm:mt-7">
                <h1 className="display-hero text-white">
                  The quiet luxury
                  <br />
                  of being driven
                </h1>
              </Enter>
            </div>

            <div className="lg:col-span-5 lg:pb-3">
              <Enter delay={420}>
                <p className="copy-lg max-w-[40ch] text-white/75">
                  {site.positioning} Chauffeur-driven travel across London, the
                  UK and Europe.
                </p>
              </Enter>

              <Enter
                delay={520}
                className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4"
              >
                <a
                  href="#enquire"
                  className="btn-ghost btn-solid-invert"
                >
                  Get an indicative quote
                </a>
                <a
                  href="#fleet"
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  Explore the fleet
                </a>
              </Enter>
            </div>
          </div>
        </div>

        {/* The quote bar — the front door to a price */}
        <Enter delay={640}>
          <div className={`${shell} pb-8 sm:pb-10`}>
            <QuoteBar />
          </div>
        </Enter>

        {/* Hairline fact bar — grounds the hero without cluttering it */}
        <Enter delay={760}>
          <div className="border-t border-hairline">
            <div
              className={`${shell} grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0`}
            >
              {heroFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-baseline gap-4 py-3 sm:flex-col sm:gap-2 sm:py-5 sm:first:pr-8 sm:not-first:pl-8"
                >
                  <span className="label-xs w-20 shrink-0 text-white/50 sm:w-auto">
                    {fact.label}
                  </span>
                  {fact.href ? (
                    <a
                      href={fact.href}
                      className="label-sm link-quiet text-white/85 hover:text-white"
                    >
                      {fact.value}
                    </a>
                  ) : (
                    <span className="label-sm text-white/85">{fact.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Enter>
      </div>
    </section>
  );
}
