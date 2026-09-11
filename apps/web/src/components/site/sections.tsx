import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { getVehicle, passengersLabel, type VehicleId } from "@/content/fleet";
import { contact, routes, WHATSAPP_INTRO, whatsappUrl } from "@/content/site";
import { GhostLink, Rule, SectionHead, shell } from "./primitives";
import { Reveal } from "./reveal";

type Tone = "dark" | "light";

const surface = {
  dark: "bg-ink text-white",
  light: "bg-mist text-ink",
} as const;

const bodyTone = {
  dark: "text-white/65",
  light: "text-slate",
} as const;

/** Standard section frame: surface, gutter and vertical rhythm. */
export function Section({
  tone = "dark",
  id,
  children,
  className = "",
}: {
  tone?: Tone;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`${surface[tone]} ${className}`}>
      <div className={`${shell} pb-24 lg:pb-36`}>{children}</div>
    </section>
  );
}

/**
 * A large statement with a supporting paragraph — the standard opening for a
 * section, kept asymmetric so it never reads as a centred marketing stack.
 */
export function Statement({
  heading,
  body,
  tone = "dark",
  action,
}: {
  heading: readonly string[] | string;
  body?: string;
  tone?: Tone;
  action?: ReactNode;
}) {
  const lines = Array.isArray(heading) ? heading : [heading];
  return (
    <div className="grid grid-cols-1 gap-8 pb-16 lg:grid-cols-12 lg:items-end lg:pb-24">
      <Reveal className="lg:col-span-7">
        <h2 className={`display-xl ${tone === "dark" ? "text-white" : "text-ink"}`}>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
      </Reveal>
      {body || action ? (
        <Reveal delay={120} className="lg:col-span-4 lg:col-start-9">
          {body ? <p className={`copy max-w-[44ch] ${bodyTone[tone]}`}>{body}</p> : null}
          {action ? <div className="mt-8">{action}</div> : null}
        </Reveal>
      ) : null}
    </div>
  );
}

/** Image on one side, copy on the other. Alternates via `flip`. */
export function EditorialSplit({
  image,
  imageAlt,
  eyebrow,
  heading,
  paragraphs,
  points,
  action,
  tone = "dark",
  flip = false,
  aspect = "aspect-4/5",
}: {
  image: StaticImageData;
  imageAlt: string;
  eyebrow?: string;
  heading: string;
  paragraphs: readonly string[];
  points?: readonly string[];
  action?: ReactNode;
  tone?: Tone;
  flip?: boolean;
  aspect?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
      <Reveal
        variant="image"
        className={`lg:col-span-6 ${flip ? "lg:order-2 lg:col-start-7" : ""}`}
      >
        <div className={`media-zoom relative ${aspect} w-full overflow-hidden bg-graphite`}>
          <Image
            src={image}
            alt={imageAlt}
            fill
            quality={85}
            sizes="(max-width: 1024px) 100vw, 48vw"
            placeholder="blur"
            className="object-cover"
          />
        </div>
      </Reveal>

      <div className={`lg:col-span-5 ${flip ? "lg:order-1" : "lg:col-start-8"} lg:pt-4`}>
        {eyebrow ? (
          <Reveal>
            <p className={`label-xs ${tone === "dark" ? "text-white/55" : "text-slate"}`}>
              {eyebrow}
            </p>
          </Reveal>
        ) : null}

        <Reveal delay={60}>
          <h2
            className={`display-lg mt-4 max-w-[16ch] ${
              tone === "dark" ? "text-white" : "text-ink"
            }`}
          >
            {heading}
          </h2>
        </Reveal>

        {paragraphs.map((paragraph, i) => (
          <Reveal key={paragraph.slice(0, 24)} delay={120 + i * 60}>
            <p className={`copy-lg mt-7 max-w-[48ch] ${bodyTone[tone]}`}>{paragraph}</p>
          </Reveal>
        ))}

        {points?.length ? (
          <Reveal delay={240} className="mt-10">
            <Rule tone={tone} />
            <ul>
              {points.map((point) => (
                <li
                  key={point}
                  className={`label-xs border-b py-4 ${
                    tone === "dark"
                      ? "border-hairline text-white/50"
                      : "border-hairline-ink text-slate"
                  }`}
                >
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}

        {action ? (
          <Reveal delay={300} className="mt-10">
            {action}
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}

/** Numbered hairline rows — the site's alternative to a grid of cards. */
export function IndexRows({
  rows,
  tone = "dark",
  columns = 1,
}: {
  rows: readonly { title: string; copy: string; index?: string; href?: string }[];
  tone?: Tone;
  columns?: 1 | 2;
}) {
  return (
    <ul className={columns === 2 ? "grid grid-cols-1 gap-x-16 md:grid-cols-2" : ""}>
      {rows.map((row, i) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <h3
                className={`display-sm transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-x-1.5 ${
                  tone === "dark" ? "text-white" : "text-ink"
                }`}
              >
                {row.title}
              </h3>
              {row.index ? (
                <span
                  className={`label-xs shrink-0 ${
                    tone === "dark" ? "text-white/50" : "text-slate/60"
                  }`}
                >
                  {row.index}
                </span>
              ) : null}
            </div>
            <p className={`copy mt-3 max-w-[56ch] ${bodyTone[tone]}`}>{row.copy}</p>
          </>
        );

        return (
          <Reveal
            as="li"
            key={row.title}
            delay={Math.min(i * 50, 250)}
            className={`group border-t last:border-b ${
              tone === "dark" ? "border-hairline" : "border-hairline-ink"
            }`}
          >
            {row.href ? (
              <Link href={row.href as Route} className="block py-7 sm:py-9">
                {inner}
              </Link>
            ) : (
              <div className="py-7 sm:py-9">{inner}</div>
            )}
          </Reveal>
        );
      })}
    </ul>
  );
}

/** Full-bleed photograph with a pull quote — the atmospheric break. */
export function StatementBand({
  image,
  imageAlt,
  eyebrow,
  quote,
  objectPosition = "object-center",
}: {
  image: StaticImageData;
  imageAlt: string;
  eyebrow?: string;
  quote: string;
  objectPosition?: string;
}) {
  return (
    <section className="relative isolate bg-obsidian text-white">
      <Reveal variant="image">
        <div className="relative h-[58svh] min-h-[360px] w-full overflow-hidden lg:h-[72svh]">
          <Image
            src={image}
            alt={imageAlt}
            fill
            quality={85}
            sizes="100vw"
            placeholder="blur"
            className={`object-cover ${objectPosition}`}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,6,7,0.92)_0%,rgba(6,6,7,0.45)_36%,rgba(6,6,7,0.15)_70%,rgba(6,6,7,0.4)_100%)]"
          />
          <div className={`${shell} absolute inset-x-0 bottom-0 pb-10 sm:pb-14`}>
            <Reveal delay={160}>
              {eyebrow ? <p className="label-xs text-silver">{eyebrow}</p> : null}
              <p className="quote-lg mt-5 max-w-[26ch] text-white">{quote}</p>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** A compact vehicle row used on service pages: photo where we have one. */
export function VehicleStrip({
  ids,
  tone = "dark",
  label = "Vehicles typically used",
}: {
  ids: readonly VehicleId[];
  tone?: Tone;
  label?: string;
}) {
  return (
    <div>
      <SectionHead label={label} note="Confirmed on enquiry" tone={tone} />
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {ids.map((id, i) => {
          const vehicle = getVehicle(id);
          return (
            <Reveal key={id} delay={Math.min(i * 70, 210)}>
              <div
                className={`relative aspect-4/3 w-full overflow-hidden ${
                  tone === "dark" ? "bg-graphite" : "bg-ink"
                }`}
              >
                {vehicle.image ? (
                  <Image
                    src={vehicle.image}
                    alt={vehicle.imageAlt ?? vehicle.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 24vw"
                    placeholder="blur"
                    className="object-cover"
                  />
                ) : (
                  <VehiclePlate name={vehicle.name} marque={vehicle.marque} />
                )}
              </div>
              <p
                className={`label-sm mt-5 ${tone === "dark" ? "text-white" : "text-ink"}`}
              >
                {vehicle.name}
              </p>
              <p
                className={`label-xs mt-2 ${
                  tone === "dark" ? "text-white/55" : "text-slate"
                }`}
              >
                {passengersLabel(vehicle)} · {vehicle.rate}
              </p>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Stand-in for vehicles the client has not photographed yet. Deliberately
 * typographic rather than a broken image or a stock photograph.
 */
export function VehiclePlate({
  name,
  marque,
}: {
  name: string;
  marque: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between border border-hairline bg-graphite p-6">
      <span className="label-xs text-white/50">{marque}</span>
      <span className="display-sm text-white/70">{name}</span>
      <span className="label-xs text-white/45">Photography to follow</span>
    </div>
  );
}

/** Closing conversion band. Confident, not desperate. */
export function EnquiryBand({
  heading,
  body,
  tone = "dark",
  primaryHref = routes.quote,
  primaryLabel = "Request a quote",
}: {
  heading: string;
  body?: string;
  tone?: Tone;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  return (
    <section className={surface[tone]}>
      <div className={`${shell} py-20 lg:py-28`}>
        <Rule tone={tone} />
        <div className="grid grid-cols-1 gap-10 pt-12 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <h2
              className={`display-lg max-w-[20ch] ${
                tone === "dark" ? "text-white" : "text-ink"
              }`}
            >
              {heading}
            </h2>
            {body ? (
              <p className={`copy-lg mt-7 max-w-[48ch] ${bodyTone[tone]}`}>{body}</p>
            ) : null}
          </Reveal>

          <Reveal
            delay={120}
            className="flex flex-wrap items-center gap-x-8 gap-y-4 lg:col-span-5 lg:justify-end"
          >
            <GhostLink href={primaryHref} tone={tone}>
              {primaryLabel}
            </GhostLink>
            <a
              href={whatsappUrl(WHATSAPP_INTRO)}
              target="_blank"
              rel="noreferrer"
              className={`label-xs link-quiet ${
                tone === "dark" ? "text-white/70 hover:text-white" : "text-ink"
              }`}
            >
              Or message us on WhatsApp
            </a>
          </Reveal>
        </div>

        <Reveal delay={200} className="mt-10 flex flex-wrap gap-x-10 gap-y-3">
          <a
            href={contact.phoneHref}
            className={`label-xs link-quiet ${
              tone === "dark" ? "text-white/50 hover:text-white" : "text-slate"
            }`}
          >
            {contact.phoneDisplay}
          </a>
          <a
            href={contact.emailHref}
            className={`label-xs link-quiet ${
              tone === "dark" ? "text-white/50 hover:text-white" : "text-slate"
            }`}
          >
            {contact.email}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
