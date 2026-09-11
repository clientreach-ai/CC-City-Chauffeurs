import Image from "next/image";
import Link from "next/link";

import { brand } from "@/content/brand";
import { services } from "@/content/services";
import {
  contact,
  routes,
  serviceAreas,
  site,
  WHATSAPP_INTRO,
  whatsappUrl,
} from "@/content/site";
import { Rule, shell } from "./primitives";

const columns = [
  {
    title: "Chauffeur services",
    items: services
      .slice(0, 6)
      .map((service) => ({ label: service.label, href: routes.service(service.slug) })),
  },
  {
    title: "More",
    items: [
      ...services
        .slice(6)
        .map((service) => ({ label: service.label, href: routes.service(service.slug) })),
      { label: "Supercar Hire", href: routes.supercarHire },
      { label: "Supercar Experiences", href: routes.supercarExperiences },
      { label: "Fleet", href: routes.fleet },
      { label: "Gallery", href: routes.gallery },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-obsidian text-white">
      <div className={shell}>
        <Rule />

        <div className="flex flex-wrap items-end justify-between gap-8 pt-14 lg:pt-16">
          <Link href={routes.home} aria-label={`${site.legalName} — home`}>
            <Image
              src={brand.logo}
              alt={site.legalName}
              sizes="320px"
              className="h-9 w-auto lg:h-10"
            />
          </Link>
          <p className="label-xs max-w-[36ch] text-white/55">{site.positioning}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-12 py-14 lg:grid-cols-4 lg:py-16">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="label-xs text-white/50">{column.title}</p>
              <ul className="mt-6 flex flex-col gap-3.5">
                {column.items.map((item) => (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      className="label-xs link-quiet text-white/70 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="label-xs text-white/50">Where we work</p>
            <ul className="mt-6 flex flex-col gap-3.5">
              {serviceAreas.map((area) => (
                <li key={area} className="label-xs text-white/70">
                  {area}
                </li>
              ))}
              <li className="label-xs text-white/70">Gatwick & all London airports</li>
            </ul>
          </div>

          <div>
            <p className="label-xs text-white/50">Contact</p>
            <ul className="mt-6 flex flex-col gap-3.5">
              <li>
                <a
                  href={contact.phoneHref}
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  {contact.phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  href={whatsappUrl(WHATSAPP_INTRO)}
                  target="_blank"
                  rel="noreferrer"
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  WhatsApp {contact.mobileDisplay}
                </a>
              </li>
              <li>
                <a
                  href={contact.emailHref}
                  className="label-xs link-quiet break-all text-white/70 hover:text-white"
                >
                  {contact.email}
                </a>
              </li>
              <li>
                <Link
                  href={routes.quote}
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  Request a quote
                </Link>
              </li>
              <li>
                <Link
                  href={routes.about}
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  About
                </Link>
              </li>
              <li className="label-xs text-white/50">{site.base}</li>
            </ul>
          </div>
        </div>

        <Rule />

        {/* Extra room on small screens for the fixed contact bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-8 pb-20 sm:pb-8">
          <p className="label-xs text-white/50">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p className="label-xs text-white/50">{site.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
