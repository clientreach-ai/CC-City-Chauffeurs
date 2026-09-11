/**
 * Client testimonials.
 *
 * DELIBERATELY EMPTY. The previous site carried six invented testimonials;
 * fake reviews became directly enforceable against businesses under the
 * Digital Markets, Competition and Consumers Act 2024, and PRD §4.3 requires
 * them removed and replaced with real, attributed quotes.
 *
 * The section renders nothing at all while this array is empty — so the site
 * launches with no testimonials rather than with placeholders.
 *
 * To publish real ones, add entries here. The level of attribution the client
 * confirmed they can obtain is first name, role and district (§10.11):
 *
 *   { quote: "…", name: "Sarah", role: "Bride", district: "Kensington" }
 *
 * Six real ones beat sixty anonymous ones. Do not add a quote that cannot be
 * attributed, and do not invent one to fill the grid.
 */

export type Testimonial = {
  quote: string;
  /** First name only — surnames are not published. */
  name: string;
  /** e.g. "Bride", "Executive assistant", "Corporate booker". */
  role: string;
  /** London district, e.g. "Mayfair". */
  district: string;
};

export const testimonials: readonly Testimonial[] = [];
