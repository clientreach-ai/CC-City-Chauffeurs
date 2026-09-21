import { env } from "@CC-City-Chauffeurs/env/admin";
import type { NextConfig } from "next";

/** The API, with any trailing slash taken off so paths join cleanly. */
const API = env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, "");


/**
 * Sent with every page. Deliberately no script policy: Next inlines its own
 * bootstrapping, and a CSP that has to be loosened for that protects little
 * while breaking a lot. What these do stop is the page being framed by
 * another site (clickjacking), a response being re-typed by the browser, and
 * the full address leaking to other sites in the Referer.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,

  /**
   * The API, served from this origin.
   *
   * The session is a cookie, and a cookie an admin page receives from another
   * origin is a third-party cookie. Safari has refused those by default since
   * 2020, and every browser on iOS is Safari underneath — so signing in worked
   * on Android and silently failed on an iPhone: the sign-in itself succeeded,
   * the cookie was dropped, and the session check bounced straight back to the
   * sign-in screen.
   *
   * Forwarding the API through the admin's own origin makes the cookie
   * first-party, which every browser accepts. The admin defines no /api routes
   * of its own, and rewrites returned as an array run after the filesystem
   * routes, so nothing here is shadowed.
   */
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },

  images: {
    qualities: [75, 85, 90],
    formats: ["image/avif", "image/webp"],
    /**
     * The admin previews the website's own photography, which the website
     * serves. In development that is another port; in production another
     * subdomain — either way it is a remote host from here.
     */
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
