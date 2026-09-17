import { notFound } from "next/navigation";

import { EnquiryForm } from "@/components/site/enquiry-form";
import { PageHero } from "@CC-City-Chauffeurs/ui/site/page-hero";
import { QuietLink, SectionHead, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";
import { media } from "@/content/media";
import { pageMetadata } from "@/content/seo";
import { routes } from "@/content/site";
import { contactDetails, mailLink, telLink, whatsappLink } from "@/lib/contact";
import { getFleet, getSite } from "@/lib/site-data";

export const metadata = pageMetadata({
  title: "Request a Chauffeur | CC City Chauffeurs, London",
  description:
    "Request a chauffeur from CC City Chauffeurs. Send the journey — date, route, passengers and vehicle — and the office replies with availability and a price.",
  path: "/request-a-chauffeur",
});

/**
 * The one way in.
 *
 * There were two pages here: a quote request and a booking request. A visitor
 * standing in front of them had to work out which of the two they were doing
 * before they could ask us anything, and the honest answer was that both did
 * the same thing — asked us, and waited for a person to reply. The difference
 * was ours, not theirs, so it has gone back to being ours: everything sent
 * here is an enquiry, and the office turns one into a booking once it is
 * agreed.
 *
 * Nothing here confirms a journey. The date is a date somebody would like,
 * not one they have been given, and the copy has to keep saying so — a page
 * that reads like a checkout will be treated as one.
 */

const steps = [
  {
    index: "01",
    title: "Set out the journey",
    copy: "Date, route, passengers and luggage, and the car if you have a preference. A date you have not settled on is fine — say roughly when and we will work with it.",
  },
  {
    index: "02",
    title: "Send it to us",
    copy: "Sending records the request with the office and hands you a reference straight away. You can send the same details on WhatsApp afterwards if you would like them in front of us sooner.",
  },
  {
    index: "03",
    title: "We come back to you",
    copy: "The office checks the vehicle and the chauffeur against your date, then replies with availability and a price. Nothing is held and nothing is charged until you have agreed it.",
  },
];

export default async function RequestAChauffeurPage() {
  const [site, fleet] = await Promise.all([getSite(), getFleet()]);
  if (!site) notFound();
  const { settings } = site;
  /** Id and name only — the form is a client component, and the id is what
   *  the enquiry is recorded against. */
  const vehicleOptions = (fleet?.vehicles ?? []).map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
  }));

  return (
    <>
      <PageHero
        height="short"
        eyebrow="Request a chauffeur"
        display={["Tell us", "the journey"]}
        standfirst="Set out the journey below and the office replies with availability and a price. It is a request until they do — nothing is held and nothing is charged here."
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
                      href={whatsappLink(settings)}
                      target="_blank"
                      rel="noreferrer"
                      className="label-sm link-quiet text-white"
                    >
                      WhatsApp {settings.contact.whatsappDisplay}
                    </a>
                    <a href={telLink(settings)} className="label-sm link-quiet text-white/70">
                      {settings.contact.phoneDisplay}
                    </a>
                    <a href={mailLink(settings)} className="label-sm link-quiet break-all text-white/70">
                      {settings.contact.email}
                    </a>
                  </div>
                </Reveal>
              </div>
            </div>

            {/* The form */}
            <div className="lg:col-span-7 lg:col-start-6">
              <SectionHead label="Your journey" note="Three short sections" />
              <Reveal>
                <EnquiryForm
                  variant="full"
                  vehicles={vehicleOptions}
                  contact={contactDetails(settings)}
                  services={site.enquiryServices}
                />
              </Reveal>

              <Reveal delay={120} className="mt-14">
                <p className="label-xs max-w-[60ch] text-white/55">
                  What you pay depends on the date, the duration, the route and the
                  vehicle. Indicative hourly rates are published on the{" "}
                  <QuietLink href={routes.fleet} className="!text-white/70">
                    fleet page
                  </QuietLink>{" "}
                  so you can size a journey before you ask.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
