"use client";

import { can, type Capability, type Role } from "@CC-City-Chauffeurs/core";
import { create } from "zustand";

/**
 * Who is signed in.
 *
 * The role is the real one, read off the session by the API. The admin uses
 * it to hide what a role cannot do; the API enforces the identical rule on
 * every write, so hiding is a courtesy rather than the protection.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
};

type SessionState = {
  user: SessionUser | null;
  /** False until the first check of the session has come back. */
  ready: boolean;
  setUser: (user: SessionUser | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
}));

export function useSession() {
  return useSessionStore((state) => state.user);
}

/** What the signed-in user may do. Unknown user, nothing allowed. */
export function useCan() {
  const user = useSession();
  return (capability: Capability) => (user ? can(user.role, capability) : false);
}
