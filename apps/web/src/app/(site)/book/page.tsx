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
  title: "Book a Chauffeur | CC City Chauffeurs, London",
  description:
    "Send a booking request to CC City Chauffeurs. Give the date, the route and the car, and the office confirms the vehicle and chauffeur against it.",
  path: "/book",
});

/**
 * The booking request.
 *
 * It is a request, not a reservation. There is no live availability to check
 * a date against and nothing is taken at the end of it: the request lands as
 * a pending booking and a person in the office confirms it, exactly as one
 * raised from a won enquiry does. Every line of copy on this page has to keep
 * saying so — a page that reads like a checkout is a page that will be
 * treated as one.
 *
 * Someone who has not settled on a date belongs on /request-a-quote instead,
 * which is why both routes exist and each links to the other.
 */

const steps = [
  {
    index: "01",
    title: "Give us the date",
    copy: "A booking needs a day against it. If yours is still moving, ask for a quote instead and we will hold the conversation open until it settles.",
  },
  {
    index: "02",
    title: "Set out the journey",
    copy: "Route, timings, passengers and luggage, and the car if you have a preference. The more we know now, the fewer questions come back.",
  },
  {
    index: "03",
    title: "We confirm it",
    copy: "The office checks the vehicle and the chauffeur against your date and comes back to you. Nothing is held and nothing is charged until they do.",
  },
];

export default async function BookPage() {
  const [site, fleet] = await Promise.all([getSite(), getFleet()]);
  if (!site) notFound();
  const { settings } = site;
  /** Id and name only — the form is a client component, and the id is what
   *  the booking is recorded against. */
  const vehicleOptions = (fleet?.vehicles ?? []).map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
  }));

  return (
    <>
      <PageHero
        height="short"
        eyebrow="Book a chauffeur"
        display={["Give us", "the date"]}
        standfirst="Send the booking below and the office will confirm the car and the chauffeur against it. It is a request until they do — nothing is held and nothing is charged here."
        image={media.cullinanPeninsulaNight}
        imageAlt="Rolls-Royce Cullinan waiting outside a London hotel at night"
        facts={[
          { label: "This is", value: "A request, not a reservation" },
          { label: "Confirmed by", value: "The office, by reply" },
          { label: "Covers", value: "London, UK and Europe" },
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

                {settings.booking.terms.length ? (
                  <Reveal delay={140} className="mt-10">
                    <p className="label-xs text-white/55">Before you send it</p>
                    <ul className="mt-5 flex flex-col gap-3">
                      {settings.booking.terms.map((term) => (
                        <li key={term} className="copy text-white/55">
                          {term}
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                ) : null}

                <Reveal delay={200} className="mt-10">
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
              <SectionHead label="Your booking" note="Confirmed by the office" />
              <Reveal>
                <EnquiryForm
                  variant="booking"
                  vehicles={vehicleOptions}
                  contact={contactDetails(settings)}
                  services={site.enquiryServices}
                />
              </Reveal>

              <Reveal delay={120} className="mt-14">
                <p className="label-xs max-w-[60ch] text-white/55">
                  Not settled on a date yet? Ask for a{" "}
                  <QuietLink href={routes.quote} className="!text-white/70">
                    quote
                  </QuietLink>{" "}
                  instead — it asks the same questions without needing a day against
                  them, and we will come back with availability and a price.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
