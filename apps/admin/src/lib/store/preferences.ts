"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Per-browser admin preferences.
 *
 * Only things that belong to this device live here — the sidebar's width,
 * the density of a list. Who you are and what you may do is not a
 * preference: it comes from the session (see `store/session.ts`).
 */

type PreferencesState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
    }),
    {
      name: "cc-admin:preferences",
      storage: createJSONStorage(() => localStorage),
      // The server render cannot know this browser's preferences, so the
      // first paint uses the defaults and this rehydrates over it.
      skipHydration: false,
    },
  ),
);
