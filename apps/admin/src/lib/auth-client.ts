import { env } from "@CC-City-Chauffeurs/env/admin";
import { createAuthClient } from "better-auth/react";

/**
 * Sessions. The admin runs on its own origin, so every call carries the
 * cookie cross-site — which is why the API sets it with SameSite=None.
 */
export const authClient = createAuthClient({
  // better-auth derives its route matching from this URL's path, so the
  // client's base must equal where the server mounts it: /api/auth.
  baseURL: new URL("/api/auth", env.NEXT_PUBLIC_SERVER_URL).toString(),
});

export const { signIn, signOut, useSession: useAuthSession } = authClient;
