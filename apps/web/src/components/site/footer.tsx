import Image from "next/image";
import Link from "next/link";

import type { SiteSettings } from "@CC-City-Chauffeurs/core";
import { brand } from "@/content/brand";
import { routes } from "@/content/site";
import { mailLink, telLink, whatsappLink } from "@/lib/contact";
import { Rule, shell } from "@CC-City-Chauffeurs/ui/site/primitives";

type ServiceLink = { slug: string; name: string };

/**
 * The site footer. Which service links it shows, the areas it lists and the
 * contact details it prints all come from the admin — including the switches
 * that turn each block off.
 */
export function Footer({
  settings,
  services,
}: {
  settings: SiteSettings;
  services: ServiceLink[];
}) {
  const { business, contact, footer } = settings;

  const columns = footer.showServiceLinks
    ? [
        {
          title: "Chauffeur services",
          items: services
            .slice(0, 6)
            .map((service) => ({ label: service.name, href: routes.service(service.slug) })),
        },
        {
          title: "More",
          items: [
            ...services
              .slice(6)
              .map((service) => ({ label: service.name, href: routes.service(service.slug) })),
            { label: "Supercar Hire", href: routes.supercarHire },
            { label: "Supercar Experiences", href: routes.supercarExperiences },
            { label: "Fleet", href: routes.fleet },
            { label: "Gallery", href: routes.gallery },
          ],
        },
      ]
    : [];

  return (
    <footer className="bg-obsidian text-white">
      <div className={shell}>
        <Rule />

        <div className="flex flex-wrap items-end justify-between gap-8 pt-14 lg:pt-16">
          <Link href={routes.home} aria-label={`${business.legalName} — home`}>
            <Image
              src={brand.logo}
              alt={business.legalName}
              sizes="320px"
              className="h-9 w-auto lg:h-10"
            />
          </Link>
          <p className="label-xs max-w-[36ch] text-white/55">{footer.text}</p>
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

          {footer.showServiceAreas ? (
          <div>
            <p className="label-xs text-white/50">Where we work</p>
            <ul className="mt-6 flex flex-col gap-3.5">
              {business.serviceAreas.map((area) => (
                <li key={area} className="label-xs text-white/70">
                  {area}
                </li>
              ))}
              <li className="label-xs text-white/70">Gatwick & all London airports</li>
            </ul>
          </div>
          ) : null}

          {footer.showContact ? (
          <div>
            <p className="label-xs text-white/50">Contact</p>
            <ul className="mt-6 flex flex-col gap-3.5">
              <li>
                <a
                  href={telLink(settings)}
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  {contact.phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  href={whatsappLink(settings)}
                  target="_blank"
                  rel="noreferrer"
                  className="label-xs link-quiet text-white/70 hover:text-white"
                >
                  WhatsApp {contact.whatsappDisplay}
                </a>
              </li>
              <li>
                <a
                  href={mailLink(settings)}
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
              <li className="label-xs text-white/50">{business.base}</li>
            </ul>
          </div>
          ) : null}
        </div>

        <Rule />

        {/* Extra room on small screens for the fixed contact bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-8 pb-20 sm:pb-8">
          <p className="label-xs text-white/50">
            © {new Date().getFullYear()} {business.companyName}. All rights reserved.
          </p>
          <p className="label-xs text-white/50">{business.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
