import { createAuthClient } from "better-auth/react";

/**
 * Sessions.
 *
 * No base URL on purpose. better-auth then resolves its own — `/api/auth` on
 * whatever origin the admin is being served from — and `next.config.ts`
 * forwards that to the API. Naming the API here instead would put the session
 * cookie on another origin, which is the one arrangement Safari refuses.
 *
 * Server-side there is no origin to resolve against, but nothing asks: the
 * session store hands React a static snapshot while rendering and only starts
 * fetching once it is subscribed to in the browser.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession: useAuthSession } = authClient;
