/**
 * The logo, in a module of its own.
 *
 * The navigation is a client component, so whatever it imports ships to the
 * browser on every page. Importing the logo from `media.ts` used to pull the
 * whole photography manifest — every image's metadata and blur placeholder —
 * into that bundle just to draw one wordmark.
 */
import logoLockup from "@/media/logo-lockup.png";

export const brand = {
  /** Client's logo lockup, keyed off its black background — use on dark. */
  logo: logoLockup,
} as const;
