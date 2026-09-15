import { notFound } from "next/navigation";

import { EnquiryForm } from "@/components/site/enquiry-form";
import { PageHero } from "@CC-City-Chauffeurs/ui/site/page-hero";
import { GhostLink, QuietLink, SectionHead, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";
import { media } from "@/content/media";
import { pageMetadata } from "@/content/seo";
import { routes } from "@/content/site";
import { contactChannels, contactDetails, whatsappLink } from "@/lib/contact";
import { getSite } from "@/lib/site-data";

export const metadata = pageMetadata({
  title: "Contact | CC City Chauffeurs, London",
  description:
    "Contact CC City Chauffeurs by WhatsApp, telephone or email. A London chauffeur company covering the UK and Europe. Enquiries handled in confidence.",
  path: "/contact",
});

export default async function ContactPage() {
  const site = await getSite();
  if (!site) notFound();
  const { settings } = site;

  const channels = contactChannels(settings, {
    whatsapp: "The fastest way to reach us — most enquiries arrive this way.",
    phone: "Speak to the office about a booking or an account.",
    email: "For detailed, corporate or wedding enquiries.",
  });

  return (
    <>
      <PageHero
        height="short"
        eyebrow="Contact"
        display={["Easy to", "reach"]}
        standfirst="Message us, call the office, or set out the booking below. Every enquiry is handled in confidence and answered by a person."
        image={media.cullinanHotelSide}
        imageAlt="Rolls-Royce Cullinan waiting at a London hotel entrance"
        facts={[
          { label: "Based", value: settings.business.base },
          { label: "Covering", value: "United Kingdom and Europe" },
          { label: "Preferred", value: "WhatsApp" },
        ]}
        actions={
          <>
            <GhostLink href={whatsappLink(settings)} external>
              Message on WhatsApp
            </GhostLink>
            <QuietLink href={routes.quote}>Request a full quote</QuietLink>
          </>
        }
      />

      <section className="bg-ink text-white">
        <div className={`${shell} pt-16 pb-24 lg:pt-24 lg:pb-32`}>
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionHead label="Direct" note="No switchboard" />

              <Reveal>
                {channels.map((channel) => (
                  <a
                    key={channel.label}
                    href={channel.href}
                    {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="group flex items-baseline justify-between gap-6 border-t border-hairline py-6 first:border-t-0 last:border-b"
                  >
                    <span className="min-w-0">
                      <span className="label-xs block text-white/55">{channel.label}</span>
                      <span
                      className={`display-sm mt-3 block text-white transition-transform duration-700 ease-editorial group-hover:translate-x-1.5 ${
                        channel.value.includes("@") ? "normal-case [overflow-wrap:anywhere]" : ""
                      }`}
                    >
                        {channel.value}
                      </span>
                      <span className="copy mt-3 block text-white/55">{channel.note}</span>
                    </span>
                    <span
                      aria-hidden
                      className="label-xs shrink-0 text-white opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    >
                      →
                    </span>
                  </a>
                ))}
              </Reveal>

              <Reveal delay={120} className="mt-12">
                <p className="label-xs text-white/55">Where we work</p>
                <ul className="mt-5 grid grid-cols-2">
                  {settings.business.serviceAreas.map((area) => (
                    <li
                      key={area}
                      className="label-xs border-b border-hairline py-3.5 text-white/60 first:border-t even:border-t-0 sm:[&:nth-child(2)]:border-t"
                    >
                      {area}
                    </li>
                  ))}
                </ul>
                <p className="label-xs mt-6 text-white/55">
                  Plus Gatwick and all London airports, UK-wide travel and Europe.
                </p>
              </Reveal>

              <Reveal delay={180} className="mt-10">
                <p className="label-xs max-w-[46ch] text-white/55">
                  Chauffeur bookings are arranged in advance. Send the date and we will
                  confirm what is available — we do not publish availability hours we
                  cannot hold to.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <SectionHead label="Or set out the details" note="Sends via WhatsApp or email" />
              <Reveal>
                <EnquiryForm
                  variant="short"
                  contact={contactDetails(settings)}
                  services={site.enquiryServices}
                />
              </Reveal>

              <Reveal delay={120} className="mt-12">
                <GhostLink href={routes.quote}>
                  Need a full quotation? Use the quote form
                </GhostLink>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
