"use client";

import { can, type Capability, type Role } from "@CC-City-Chauffeurs/core";

import { usePreferencesStore } from "@/lib/store/preferences";
import { useSessionStore } from "@/lib/store/session";

/**
 * What this user may do, and how they like the admin arranged.
 *
 * The role is real: it is read off the session by the API, which enforces
 * the same capabilities on every write. `can()` is here so the interface can
 * avoid offering something that would be refused — not to provide the
 * protection itself.
 */
export function usePreferences() {
  const user = useSessionStore((state) => state.user);
  const collapsed = usePreferencesStore((state) => state.collapsed);
  const setCollapsed = usePreferencesStore((state) => state.setCollapsed);

  const role: Role = user?.role ?? "editor";

  return {
    role,
    user,
    collapsed,
    setCollapsed,
    can: (capability: Capability) => (user ? can(role, capability) : false),
    /** Name recorded against notes and activity. */
    author: user?.name || user?.email || "Admin",
  };
}
