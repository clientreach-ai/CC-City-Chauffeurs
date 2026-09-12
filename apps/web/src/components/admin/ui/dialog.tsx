"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { Button } from "./button";

/**
 * Dialogs on the native <dialog> element. `showModal()` gives the browser's
 * own focus containment, Escape handling, inert background and top-layer
 * stacking — nothing to re-implement and nothing to get subtly wrong.
 */

type DialogVariant = "center" | "sheet" | "drawer" | "fullscreen";

const variantClass: Record<DialogVariant, string> = {
  center:
    "m-auto w-[min(calc(100vw-2rem),var(--dialog-width))] max-h-[calc(100dvh-2rem)] border border-hairline-strong",
  // Slides in from the right on larger screens; full width on phones.
  sheet:
    "my-0 mr-0 ml-auto h-dvh max-h-none w-[min(100vw,var(--dialog-width))] border-l border-hairline-strong",
  drawer: "my-0 mr-auto ml-0 h-dvh max-h-none w-[min(86vw,20rem)] border-r border-hairline-strong",
  fullscreen: "m-0 h-dvh max-h-none w-screen max-w-none",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "center",
  width = "34rem",
  hideHeader,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: DialogVariant;
  width?: string;
  /** Keeps the title for assistive technology but draws no header bar. */
  hideHeader?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
      // Chrome makes a scrollable region focusable, so the dialog body can
      // win the initial focus over the control that asked for it.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      if (open) document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Escape: let the owner decide (it may hold unsaved input).
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      style={{ "--dialog-width": width } as React.CSSProperties}
      className={cn(
        "flex-col overflow-hidden bg-graphite p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop:bg-black/70 open:flex",
        variantClass[variant],
        className,
      )}
    >
      {open ? (
        <>
          {hideHeader ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <header className="flex shrink-0 items-start justify-between gap-6 border-b border-hairline px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-[1.5rem] leading-tight font-light tracking-[-0.01em] uppercase">
                  {title}
                </h2>
                {description ? (
                  <div id={descriptionId} className="mt-1.5 text-[0.8125rem] leading-relaxed text-white/60">
                    {description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
          {footer ? (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-hairline px-5 py-4 sm:px-6">
              {footer}
            </footer>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}

// ------------------------------------------------------------------ confirm

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * One confirmation dialog for the whole admin, opened with `await confirm()`.
 * Destructive actions always go through it.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      <Dialog
        open={state !== null}
        onClose={() => settle(false)}
        title={state?.title ?? ""}
        width="30rem"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {state?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={state?.tone === "danger" ? "danger" : "primary"}
              onClick={() => settle(true)}
            >
              {state?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="text-[0.875rem] leading-relaxed text-white/75">{state?.body}</div>
      </Dialog>
    </ConfirmContext>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider.");
  return confirm;
}
