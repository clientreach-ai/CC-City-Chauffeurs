"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside a modal while it is open.
 *
 * `aria-modal` tells a screen reader the rest of the page is out of reach; it
 * does nothing for a keyboard. Without this, Tab walks off the last control of
 * an open menu or lightbox into the page hidden behind it.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => item.getClientRects().length > 0,
      );
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !ref.current.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !ref.current.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref, active]);
}
