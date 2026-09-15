import type { EnquireSection, SiteSettings } from "@CC-City-Chauffeurs/core";
import { Rule, SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

import { EnquiryForm } from "./enquiry-form";

export function Enquire({
  index,
  section,
  settings,
  services,
}: {
  index: string;
  section: EnquireSection;
  settings: SiteSettings;
  services: { value: string; label: string }[];
}) {
  const { contact } = settings;
  const channels = [
    {
      label: "WhatsApp",
      value: contact.whatsappDisplay,
      note: "The fastest way to reach us",
      href: `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(contact.whatsappIntro)}`,
      external: true,
    },
    {
      label: "Telephone",
      value: contact.phoneDisplay,
      note: "Speak to the office",
      href: `tel:${contact.phoneE164}`,
    },
    {
      label: "Email",
      value: contact.email,
      note: "For detailed or corporate enquiries",
      href: `mailto:${contact.email}`,
    },
  ].filter((channel) => channel.value);

  return (
    <section id="enquire" className="bg-ink text-white">
      <div className={`${shell} pt-16 pb-24 lg:pt-24 lg:pb-32`}>
        <Rule />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index}>{section.label}</SectionLabel>
          <p className="label-xs text-white/55">{settings.business.coverage}</p>
        </div>

        <Reveal className="pb-14 lg:pb-20">
          <h2 className="display-xl max-w-[18ch] text-white">{section.heading}</h2>
          <p className="copy-lg mt-8 max-w-[52ch] text-white/60">{section.body}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          {/* Direct channels first: the client should never hunt for a way in */}
          <div className="lg:col-span-5">
            <Reveal>
              {channels.map((channel) => (
                <a
                  key={channel.label}
                  href={channel.href}
                  {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex items-baseline justify-between gap-6 border-t border-hairline py-6 last:border-b"
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
                    <span className="label-xs mt-3 block text-white/50">{channel.note}</span>
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

            {contact.responseNote ? (
              <Reveal delay={120} className="mt-10">
                <p className="label-xs text-white/55">{contact.responseNote}</p>
              </Reveal>
            ) : null}
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={80}>
              <p className="label-xs pb-8 text-white/55">Or set out the details here</p>
              <EnquiryForm contact={contact} services={services} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
