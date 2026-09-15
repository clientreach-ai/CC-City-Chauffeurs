/**
 * Business rules — what may be saved, and what may be published.
 *
 * Shared deliberately: the admin runs them in the form so an editor sees the
 * problem as they type, and the API runs the identical function on write so
 * the rule holds however the record arrives.
 */
export * from "./fleet";
export * from "./services";
export * from "./gallery";
export * from "./testimonials";
export * from "./content";
