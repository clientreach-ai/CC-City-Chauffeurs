import type { Metadata } from "next";

import { EnquiryForm } from "@/components/site/enquiry-form";
import { PageHero } from "@/components/site/page-hero";
import { QuietLink, SectionHead, shell } from "@/components/site/primitives";
import { Reveal } from "@/components/site/reveal";
import { fleetVehicles } from "@/content/fleet";
import { media } from "@/content/media";
import { pageMetadata } from "@/content/seo";
import {
  contact,
  routes,
  WHATSAPP_INTRO,
  whatsappUrl,
} from "@/content/site";

export const metadata = pageMetadata({
  title: "Request a Quote | CC City Chauffeurs",
  description:
    "Request a chauffeur quote from CC City Chauffeurs. Send the journey — date, route, passengers and vehicle — and we will confirm availability and cost.",
  path: "/request-a-quote",
});

/** Names only reach the client form — never the fleet model or its images. */
const vehicleNames = fleetVehicles.map((vehicle) => vehicle.name);

const steps = [
  {
    index: "01",
    title: "Set out the journey",
    copy: "Date, route, passengers and luggage. The more we know up front, the closer the first answer is to the final one — and the fewer questions come back.",
  },
  {
    index: "02",
    title: "Send it your way",
    copy: "The form writes your details out as a message and opens WhatsApp, or email if you prefer. You press send; nothing leaves this page on its own.",
  },
  {
    index: "03",
    title: "We come back with a price",
    copy: "We check the vehicle and chauffeur against the date, then reply with availability and cost — by WhatsApp, phone or email, whichever you chose.",
  },
];

export default function RequestAQuotePage() {
  return (
    <>
      <PageHero
        height="short"
        eyebrow="Request a quote"
        display={["Tell us", "the journey"]}
        standfirst="Set out the booking below and we will come back with availability and a price. There is no obligation."
        image={media.cullinanO2Front}
        imageAlt="Rolls-Royce Cullinan photographed in London at night"
        facts={[
          { label: "Reply by", value: "WhatsApp, phone or email" },
          { label: "Covers", value: "London, UK and Europe" },
          { label: "Confidential", value: "Every enquiry" },
        ]}
      />

      <section className="bg-ink text-white">
        <div className={`${shell} pt-16 pb-24 lg:pt-24 lg:pb-32`}>
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-16">
            {/* How it works, plus the direct routes in */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <Reveal>
                  <h2 className="display-lg max-w-[12ch] text-white">How this works</h2>
                </Reveal>

                <Reveal delay={80} className="mt-10">
                  {steps.map((step) => (
                    <div key={step.index} className="border-t border-hairline py-6">
                      <div className="flex items-baseline gap-4">
                        <span className="label-xs text-silver">{step.index}</span>
                        <span className="label-sm text-white">{step.title}</span>
                      </div>
                      <p className="copy mt-3 text-white/55">{step.copy}</p>
                    </div>
                  ))}
                </Reveal>

                <Reveal delay={160} className="mt-10">
                  <p className="label-xs text-white/55">Would rather just message?</p>
                  <div className="mt-5 flex flex-col gap-3">
                    <a
                      href={whatsappUrl(WHATSAPP_INTRO)}
                      target="_blank"
                      rel="noreferrer"
                      className="label-sm link-quiet text-white"
                    >
                      WhatsApp {contact.mobileDisplay}
                    </a>
                    <a href={contact.phoneHref} className="label-sm link-quiet text-white/70">
                      {contact.phoneDisplay}
                    </a>
                    <a href={contact.emailHref} className="label-sm link-quiet break-all text-white/70">
                      {contact.email}
                    </a>
                  </div>
                </Reveal>
              </div>
            </div>

            {/* The form */}
            <div className="lg:col-span-7 lg:col-start-6">
              <SectionHead label="Your booking" note="Three short sections" />
              <Reveal>
                <EnquiryForm variant="full" vehicles={vehicleNames} />
              </Reveal>

              <Reveal delay={120} className="mt-14">
                <p className="label-xs max-w-[60ch] text-white/55">
                  Quotes depend on date, duration, route and vehicle. Indicative hourly
                  rates are published on the{" "}
                  <QuietLink href={routes.fleet} className="!text-white/70">
                    fleet page
                  </QuietLink>{" "}
                  so you can size a booking before you ask.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
