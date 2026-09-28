import type { Vehicle } from "@CC-City-Chauffeurs/core";

/**
 * Whether a vehicle's own page is offered to search engines.
 *
 * A page with no photograph and one line of copy is the thin page the PRD
 * warns against (§10.13), so it stays out of the index and the sitemap until
 * the office adds a photograph in the admin. The page itself always exists,
 * so the fleet can link to every car.
 */
export const indexable = (vehicle: Pick<Vehicle, "images">) => Boolean(vehicle.images.main?.src);
