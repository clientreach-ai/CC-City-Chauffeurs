import { services } from "./services";
import { routes, type NavGroup } from "./site";

/**
 * The navigation dropdowns. Built from the service model, so this module is
 * server-only by convention: the site layout builds the groups and hands the
 * navigation just the labels and links it renders. Importing this into a
 * client component would ship every page of service copy to the browser.
 */
export const navGroups: readonly NavGroup[] = [
  {
    label: "Chauffeur",
    href: routes.services,
    items: services.map((service) => ({
      label: service.label,
      href: routes.service(service.slug),
      note: service.summary,
    })),
  },
  {
    label: "Supercar",
    href: routes.supercarHire,
    items: [
      {
        label: "Supercar Hire",
        href: routes.supercarHire,
        note: "Self-drive hire, subject to driver eligibility and insurance.",
      },
      {
        label: "Supercar Experiences",
        href: routes.supercarExperiences,
        note: "Chauffeur-driven statement cars for arrivals and occasions.",
      },
    ],
  },
];
