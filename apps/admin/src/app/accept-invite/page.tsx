import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Accept your invitation" };

/**
 * Where an invitation link lands. Outside the admin shell, like sign-in:
 * whoever opens it has no session yet. Suspense because the token is read
 * from the query string, which is only known in the browser.
 */
export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInvite />
    </Suspense>
  );
}
