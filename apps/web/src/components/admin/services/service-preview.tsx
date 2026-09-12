"use client";

import { Dialog } from "@/components/admin/ui/dialog";
import { IndexRows } from "@/components/site/index-rows";
import { PageHero } from "@/components/site/page-hero";
import { GhostLink, QuietLink, SectionHead, shell } from "@/components/site/primitives";
import type { PublishStatus, ServiceInput, Vehicle } from "@/lib/cms/types";

const statusLine: Record<PublishStatus, string> = {
  draft: "Draft — this page is not on the website until it is published.",
  published: "Published — this is the page as it will read.",
  archived: "Archived — this page is not on the website.",
};

/**
 * A preview of a service page from unsaved content. The hero and the
 * benefits are the live site's own components; the rest follows the page's
 * structure at a glance. The live page itself also includes the site
 * navigation, other services and the enquiry band.
 */
export function ServicePreview({
  open,
  onClose,
  service,
  vehicles,
}: {
  open: boolean;
  onClose: () => void;
  service: ServiceInput;
  vehicles: Vehicle[];
}) {
  const hero = service.heroImage;
  // Unfinished rows in the editor are not content yet, and would collide as keys.
  const benefits = service.benefits.filter(
    (item, i, all) => item.title.trim() && all.findIndex((other) => other.title === item.title) === i,
  );
  const lines = service.headline.filter((line, i, all) => line.trim() && all.indexOf(line) === i);
  const headline = lines.length ? lines : [service.name || "Headline"];
  const chosen = service.vehicleIds
    .map((id) => vehicles.find((vehicle) => vehicle.id === id))
    .filter((vehicle): vehicle is Vehicle => !!vehicle);

  return (
    <Dialog open={open} onClose={onClose} title={`Preview — ${service.name || "Untitled service"}`} variant="fullscreen" hideHeader bodyClassName="p-0" className="bg-ink">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-obsidian/95 px-4 py-3 backdrop-blur-[6px] sm:px-6">
        <div className="min-w-0">
          <p className="label-xs text-silver">Preview · /chauffeur-services/{service.slug || "…"}</p>
          <p className="mt-1 text-[0.8125rem] text-white/65">{statusLine[service.status]}</p>
        </div>
        <button type="button" onClick={onClose} data-autofocus className="btn-ghost btn-on-dark min-h-10! px-5! py-2.5!">
          Close preview
        </button>
      </div>

      <div data-site inert className="bg-ink font-ui text-white">
        {hero ? (
          <PageHero
            crumbs={[{ label: "Chauffeur services", href: "/chauffeur-services" }, { label: service.name || "Service" }]}
            display={headline}
            standfirst={service.standfirst}
            image={hero}
            imageAlt={hero.alt}
            facts={service.facts}
            actions={
              <>
                <GhostLink href="#">{service.enquiry.ctaLabel || "Request a quote"}</GhostLink>
                <QuietLink href="#">See the fleet</QuietLink>
              </>
            }
          />
        ) : (
          <div className={`${shell} pt-28 pb-12`}>
            <p className="label-xs text-white/55">No hero image chosen — the page needs one before it can be published.</p>
            <h1 className="display-hero mt-6 text-white">
              {headline.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h1>
          </div>
        )}

        <section className={`${shell} pt-16 pb-20 lg:pt-24`}>
          <SectionHead label="What the service involves" note={service.summary} />
          {benefits.length ? (
            <IndexRows rows={benefits.map((item, i) => ({ ...item, index: String(i + 1).padStart(2, "0") }))} />
          ) : (
            <p className="copy text-white/55">No key benefits yet.</p>
          )}
        </section>

        {service.detail.heading || service.detail.paragraphs.length ? (
          <section className={`${shell} pb-20`}>
            <SectionHead label={service.name || "Service"} />
            <h2 className="display-lg max-w-[16ch] text-white">{service.detail.heading}</h2>
            {service.detail.paragraphs.map((paragraph, i) => (
              <p key={i} className="copy-lg mt-7 max-w-[48ch] text-white/65">
                {paragraph}
              </p>
            ))}
          </section>
        ) : null}

        <section className={`${shell} pb-20`}>
          <SectionHead label="Vehicles typically used" note="Confirmed on enquiry" />
          {chosen.length ? (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {chosen.map((vehicle) => (
                <li key={vehicle.id} className="label-sm border-t border-hairline pt-4 text-white">
                  {vehicle.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="copy text-white/55">No vehicles chosen.</p>
          )}
        </section>

        <section className={`${shell} pb-24`}>
          <SectionHead label="To quote, we need" note="Send it in one message" />
          <ol>
            {service.booking.needs.map((need, i) => (
              <li key={need + i} className="flex items-baseline gap-5 border-t border-hairline py-5 last:border-b">
                <span className="label-xs w-6 shrink-0 text-silver">{String(i + 1).padStart(2, "0")}</span>
                <span className="label-sm text-white">{need}</span>
              </li>
            ))}
          </ol>
          {service.booking.note ? <p className="copy-lg mt-8 max-w-[44ch] text-white/80">{service.booking.note}</p> : null}
          {service.enquiry.heading ? <h2 className="display-lg mt-16 max-w-[20ch] text-white">{service.enquiry.heading}</h2> : null}
        </section>
      </div>
    </Dialog>
  );
}
