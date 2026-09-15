"use client";

import { create } from "zustand";

/**
 * Whether an editor has changes that have not been saved.
 *
 * One flag for the whole admin, because only one editor is ever open. The
 * navigation reads it to ask before leaving, and the browser reads it through
 * `beforeunload` to ask before closing the tab.
 */

type UnsavedState = {
  dirty: boolean;
  /** Where a guarded link wanted to go, while the question is on screen. */
  pending: string | null;
  setDirty: (dirty: boolean) => void;
  setPending: (href: string | null) => void;
};

export const useUnsavedStore = create<UnsavedState>((set) => ({
  dirty: false,
  pending: null,
  setDirty: (dirty) => set({ dirty, ...(dirty ? {} : { pending: null }) }),
  setPending: (pending) => set({ pending }),
}));
