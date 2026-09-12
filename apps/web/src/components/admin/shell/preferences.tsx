"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { can, type Capability, type Role } from "@/lib/cms/permissions";

/**
 * Per-browser admin preferences: the previewed role and the sidebar state.
 * The role is a preview setting only — see `lib/cms/permissions.ts`.
 */

type Preferences = {
  role: Role;
  setRole: (role: Role) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  can: (capability: Capability) => boolean;
  /** Name recorded against notes and activity. */
  author: string;
};

const PreferencesContext = createContext<Preferences | null>(null);

const KEY = "cc-admin:preferences";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("admin");
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Read once after mount: the server render cannot know this browser's
  // preferences, so the first paint uses the defaults.
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<{ role: Role; collapsed: boolean }>;
      if (stored.role === "admin" || stored.role === "manager" || stored.role === "editor") setRole(stored.role);
      if (typeof stored.collapsed === "boolean") setCollapsed(stored.collapsed);
    } catch {
      // Unreadable preferences fall back to the defaults.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ role, collapsed }));
    } catch {
      // Preferences are a convenience; failing to store them is harmless.
    }
  }, [role, collapsed, loaded]);

  const value: Preferences = {
    role,
    setRole,
    collapsed,
    setCollapsed,
    can: (capability) => can(role, capability),
    author: role === "admin" ? "Admin" : role === "manager" ? "Manager" : "Editor",
  };

  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider.");
  return value;
}
