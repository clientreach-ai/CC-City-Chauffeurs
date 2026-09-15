import Image from "next/image";

import type { HeroSection, SiteSettings } from "@CC-City-Chauffeurs/core";
import { Enter } from "@CC-City-Chauffeurs/ui/site/enter";
import { shell } from "@CC-City-Chauffeurs/ui/site/primitives";

/**
 * The vehicle is the hero object, so display type never crosses its
 * silhouette. Two deliberate compositions rather than one shrunk down:
 *   · small screens — full-bleed photograph above a black type band
 *   · sm and up     — cinematic full-screen photograph with a baseline band
 *
 * Every word and both links come from the homepage's hero band; the
 * photograph is whichever one the editors chose.
 */
export function Hero({ section, settings }: { section: HeroSection; settings: SiteSettings }) {
  const facts = [
    { label: "Based", value: settings.business.coverage },
    { label: "Airports", value: "Meet & greet · Flight tracking" },
    {
      label: "Enquiries",
      value: settings.contact.phoneDisplay,
      href: `tel:${settings.contact.phoneE164}`,
    },
  ];

  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh w-full flex-col overflow-hidden bg-obsidian"
    >
      <div className="relative h-[54svh] w-full shrink-0 sm:absolute sm:inset-0 sm:h-full">
        {section.image ? (
          <Image
            src={section.image.src}
            alt={section.image.alt}
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-[34%_center] sm:object-[center_38%]"
          />
        ) : null}
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
      </div>

      <div className="relative flex flex-1 flex-col justify-end pt-7 sm:pt-28">
        <div className={`${shell} pb-8 sm:pb-12`}>
          <div className="grid grid-cols-1 gap-x-16 gap-y-9 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Enter delay={120}>
                <p className="label-xs text-silver">{section.eyebrow}</p>
              </Enter>

              <Enter delay={220} className="mt-4 sm:mt-6">
                <h1 className="display-hero text-white">
                  {section.headingLines.map((line, i) => (
                    <span key={line}>
                      {i > 0 ? <br /> : null}
                      {line}
                    </span>
                  ))}
                </h1>
              </Enter>
            </div>

            <div className="lg:col-span-5 lg:pb-3">
              <Enter delay={420}>
                <p className="copy-lg max-w-[40ch] text-white/75">{section.body}</p>
              </Enter>

              <Enter
                delay={520}
                className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 sm:mt-7"
              >
                {section.primaryCta.label ? (
                  <a href={section.primaryCta.href} className="btn-ghost btn-on-dark">
                    {section.primaryCta.label}
                  </a>
                ) : null}
                {section.secondaryCta.label ? (
                  <a
                    href={section.secondaryCta.href}
                    className="label-xs link-quiet text-white/70 hover:text-white"
                  >
                    {section.secondaryCta.label}
                  </a>
                ) : null}
              </Enter>
            </div>
          </div>
        </div>

        {/* Hairline fact bar — grounds the hero without cluttering it */}
        <Enter delay={680}>
          <div className="border-t border-hairline">
            <div
              className={`${shell} grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0`}
            >
              {facts.map((fact) => (
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
