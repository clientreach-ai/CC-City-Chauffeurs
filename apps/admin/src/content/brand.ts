/**
 * The logo. A local asset of this application, not CMS content — the admin's
 * own chrome does not change when the website's settings do.
 */
import logoLockup from "@/media/logo-lockup.png";

export const brand = {
  /** Client's logo lockup, keyed off its black background — use on dark. */
  logo: logoLockup,
} as const;
