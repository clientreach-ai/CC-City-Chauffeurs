"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";

import { useConfirm } from "./dialog";

/**
 * Unsaved-changes protection.
 *
 * Editors call `useUnsavedChanges(isDirty)`. While any editor is dirty:
 *   · reloading or closing the tab raises the browser's own warning
 *   · every admin link (`GuardedLink`) asks before navigating away
 */

type Guard = {
  mark: (key: string, dirty: boolean) => void;
  isDirty: () => boolean;
  /** Resolves true when it is safe to leave (nothing dirty, or confirmed). */
  confirmLeave: () => Promise<boolean>;
};

const GuardContext = createContext<Guard | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const dirty = useRef(new Set<string>());

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current.size === 0) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const mark = useCallback((key: string, isDirty: boolean) => {
    if (isDirty) dirty.current.add(key);
    else dirty.current.delete(key);
  }, []);

  const confirmLeave = useCallback(async () => {
    if (dirty.current.size === 0) return true;
    const ok = await confirm({
      title: "Leave without saving?",
      body: "You have changes on this page that have not been saved. Leaving now discards them.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      tone: "danger",
    });
    if (ok) dirty.current.clear();
    return ok;
  }, [confirm]);

  const isDirty = useCallback(() => dirty.current.size > 0, []);

  const guard = useMemo(() => ({ mark, isDirty, confirmLeave }), [mark, isDirty, confirmLeave]);
  return <GuardContext value={guard}>{children}</GuardContext>;
}

export function useLeaveGuard() {
  const guard = useContext(GuardContext);
  if (!guard) throw new Error("useLeaveGuard must be used inside UnsavedChangesProvider.");
  return guard;
}

export function useUnsavedChanges(isDirty: boolean) {
  const { mark } = useLeaveGuard();
  const key = useId();
  useEffect(() => {
    mark(key, isDirty);
    return () => mark(key, false);
  }, [mark, key, isDirty]);
}

/** A Next link that checks for unsaved changes before leaving the page. */
export function GuardedLink({
  href,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: Route; prefetch?: boolean }) {
  const guard = useContext(GuardContext);
  const router = useRouter();
  return (
    <Link
      href={href}
      onNavigate={(event) => {
        if (!guard?.isDirty()) return;
        event.preventDefault();
        void guard.confirmLeave().then((ok) => {
          if (ok) router.push(href);
        });
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
