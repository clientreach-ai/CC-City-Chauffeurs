import type { Metadata } from "next";

import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Accept your invitation" };

/**
 * Where an invitation link lands. Outside the admin shell, like sign-in:
 * whoever opens it has no session yet. The token is in the fragment, read
 * in the browser.
 */
export default function AcceptInvitePage() {
  return <AcceptInvite />;
}
