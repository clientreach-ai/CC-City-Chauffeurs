import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { Enter } from "./enter";
import { shell } from "./primitives";

export type HeroFact = { label: string; value: string };

type Crumb = { label: string; href?: string };

/**
 * The interior-page hero. Same grammar as the homepage — photograph, a scrim,
 * display type on a baseline band and a hairline fact bar — at a slightly
 * lower height so the page below it starts sooner.
 */
export function PageHero({
  eyebrow,
  crumbs,
  display,
  standfirst,
  image,
  imageAlt,
  facts,
  actions,
  objectPosition = "object-center",
  mobileObjectPosition,
  height = "tall",
}: {
  eyebrow?: string;
  crumbs?: readonly Crumb[];
  display: readonly string[];
  standfirst?: string;
  image: StaticImageData;
  imageAlt: string;
  facts?: readonly HeroFact[];
  actions?: React.ReactNode;
  objectPosition?: string;
  mobileObjectPosition?: string;
  height?: "tall" | "short";
}) {
  const frame =
    height === "tall"
      ? "min-h-[86svh] sm:min-h-[88svh]"
      : "min-h-[70svh] sm:min-h-[74svh]";

  return (
    <section
      className={`relative isolate flex w-full flex-col overflow-hidden bg-obsidian ${frame}`}
    >
      <div className="absolute inset-0">
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          quality={85}
          sizes="100vw"
          placeholder="blur"
          className={`object-cover ${mobileObjectPosition ?? objectPosition} sm:${objectPosition}`}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,7,0.78)_0%,rgba(6,6,7,0.28)_20%,rgba(6,6,7,0.08)_38%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,6,7,0.97)_0%,rgba(6,6,7,0.88)_18%,rgba(6,6,7,0.62)_32%,rgba(6,6,7,0.28)_50%,rgba(6,6,7,0.06)_66%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden sm:block sm:bg-[linear-gradient(90deg,rgba(6,6,7,0.62)_0%,rgba(6,6,7,0.18)_40%,rgba(6,6,7,0)_66%)]"
        />
        {/* Corners fall away so the headline holds against the photograph */}
        <div aria-hidden className="vignette absolute inset-0" />
      </div>

      <div className="relative flex flex-1 flex-col justify-end pt-28 sm:pt-32">
        <div className={`${shell} pb-9 sm:pb-12`}>
          {crumbs?.length ? (
            <Enter delay={80}>
              <nav aria-label="Breadcrumb" className="label-xs flex flex-wrap gap-x-3 gap-y-1 text-white/55">
                {crumbs.map((crumb, i) => (
                  <span key={crumb.label} className="flex items-center gap-3">
                    {crumb.href ? (
                      <Link
                        href={crumb.href as Route}
                        className="link-quiet transition-colors duration-500 hover:text-white"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-silver">{crumb.label}</span>
                    )}
                    {i < crumbs.length - 1 ? <span aria-hidden>/</span> : null}
                  </span>
                ))}
              </nav>
            </Enter>
          ) : eyebrow ? (
            <Enter delay={80}>
              <p className="label-xs text-silver">{eyebrow}</p>
            </Enter>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-x-16 gap-y-8 sm:mt-6 lg:grid-cols-12 lg:items-end">
            <Enter delay={180} className="lg:col-span-7">
              <h1 className="display-hero text-white">
                {display.map((line, i) => (
                  <span key={line} className="block">
                    {line}
                    {i < display.length - 1 ? null : null}
                  </span>
                ))}
              </h1>
            </Enter>

            {standfirst || actions ? (
              <div className="lg:col-span-5 lg:pb-3">
                {standfirst ? (
                  <Enter delay={340}>
                    <p className="copy-lg max-w-[44ch] text-white/75">{standfirst}</p>
                  </Enter>
                ) : null}
                {actions ? (
                  <Enter
                    delay={440}
                    className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 sm:mt-7"
                  >
                    {actions}
                  </Enter>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {facts?.length ? (
          <Enter delay={560}>
            <div className="border-t border-hairline">
              <div
                className={`${shell} grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0`}
              >
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-baseline gap-4 py-3 sm:flex-col sm:gap-2 sm:py-5 sm:first:pr-8 sm:not-first:pl-8"
                  >
                    <span className="label-xs w-24 shrink-0 text-white/50 sm:w-auto">
                      {fact.label}
                    </span>
                    <span className="label-sm text-white/85">{fact.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Enter>
        ) : null}
      </div>
    </section>
  );
}
