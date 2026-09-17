import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Send anyone without a session to sign in, before a screen renders.
 *
 * This is the file Next 15 called `middleware.ts`; Next 16 renamed the
 * convention to `proxy.ts` and deprecated the old name.
 *
 * It is defence in depth, not the gate. The API is the gate: every
 * `/api/admin/*` route needs a session and answers 401 without one, and the
 * role check on a write happens there too. All this saves is the flash of an
 * empty screen that `SessionGate` would otherwise clear a moment later.
 *
 * It tests only that the session cookie is *present*, because verifying it
 * means asking the API — a round trip on every navigation, and a second place
 * that could get the answer wrong. A stale or forged cookie gets past here
 * and is then refused by `SessionGate` and by the API, which is why presence
 * is enough: the check can only ever redirect more people, never admit one
 * the API would turn away.
 *
 * `getSessionCookie` is better-auth's own reader, so it knows the cookie's
 * real name in every configuration — including the `__Secure-` prefix that
 * production adds and localhost does not.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Everything except:
   *
   * - `/api/*` — rewritten to the API on this origin so the session cookie
   *   stays first-party (see `next.config.ts`). Redirecting a 401 to an HTML
   *   page here would break the sign-in call itself and hide every real error
   *   the admin's client knows how to show.
   * - `/sign-in` — the one screen that runs without a session.
   * - `/_next/*` and anything with a file extension — assets, which a
   *   redirect would simply stop from loading.
   */
  matcher: ["/((?!api/|_next/|sign-in|.*\\.).*)"],
};
