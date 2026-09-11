import type { ServiceSlug } from "./services";

/**
 * Options for the enquiry form, kept in a module with no heavy imports: the
 * form is a client component, and importing `services.ts` or `fleet.ts` here
 * would ship every page of service copy and the whole image manifest to the
 * browser just to fill two dropdowns.
 *
 * `value` is the service slug where there is one, so service pages can link
 * to /request-a-quote?service=<slug> and arrive with it selected. The type
 * check below fails the build if a service is added without an option here.
 */
export const serviceOptions = [
  { value: "private-chauffeur", label: "Private chauffeur" },
  { value: "airport-transfers", label: "Airport transfer" },
  { value: "corporate", label: "Corporate travel" },
  { value: "weddings", label: "Wedding" },
  { value: "events", label: "Event or occasion" },
  { value: "city-to-city", label: "City to city" },
  { value: "roadshows", label: "Roadshow" },
  { value: "tours", label: "Tour or sightseeing" },
  { value: "school-family", label: "School or family run" },
  { value: "supercar-experience", label: "Supercar experience (chauffeur-driven)" },
  { value: "supercar-hire", label: "Supercar hire (self-drive)" },
  { value: "other", label: "Something else" },
] as const;

export type ServiceOption = (typeof serviceOptions)[number]["value"];

// Every chauffeur service must be selectable in the form.
type MissingServices = Exclude<ServiceSlug, ServiceOption>;
export const everyServiceListed: MissingServices extends never ? true : MissingServices = true;

export const NO_VEHICLE_PREFERENCE = "No preference — suggest one";

export const replyOptions = ["WhatsApp", "Phone call", "Email"] as const;
