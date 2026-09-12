import type { Metadata } from "next";

import { AdminApp } from "@/components/admin/shell/admin-app";
import { buildContentSeed } from "@/lib/cms/seed/content";

export const metadata: Metadata = {
  title: {
    template: "%s · Admin · City Chauffeurs",
    default: "Admin · City Chauffeurs",
  },
  // Internal tool: never indexed, never followed, never previewed.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The admin application. Outside the `(site)` route group, so it shares
 * nothing with the public shell but the root document, fonts and tokens.
 *
 * The CMS seed is built here, on the server, from the public site's own data
 * files, and reaches the browser as plain JSON.
 */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminApp seed={buildContentSeed()}>{children}</AdminApp>;
}
