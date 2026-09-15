"use client";

import type { Route } from "next";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { GuardedLink } from "./unsaved";

/**
 * Admin controls. The public site's grammar at working size: square, 2px
 * corners, hairline outlines, uppercase tracking on labels. White fill is
 * kept for the one primary action in any given view.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[2px] border font-ui font-medium uppercase tracking-[0.12em] whitespace-nowrap transition-colors duration-300 ease-editorial select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "border-white bg-white text-ink hover:border-silver hover:bg-silver",
  secondary: "border-white/30 bg-transparent text-white hover:border-white hover:bg-white/6",
  ghost: "border-transparent bg-transparent text-white/75 hover:bg-white/6 hover:text-white",
  danger: "border-alert/50 bg-transparent text-alert hover:border-alert hover:bg-alert/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.625rem] [&_svg]:size-3.5",
  md: "h-10 px-4 text-[0.6875rem] [&_svg]:size-4",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  busy,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a working state and blocks repeat presses. */
  busy?: boolean;
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      {...props}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  external,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  /** Opens in a new tab — used for "view on the website". */
  external?: boolean;
}) {
  const classes = buttonClass(variant, size, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <GuardedLink href={href as Route} className={classes}>
      {children}
    </GuardedLink>
  );
}

/**
 * A square icon-only button. `label` is required: it becomes the accessible
 * name and the tooltip, so no icon ever goes unexplained.
 */
export function IconButton({
  label,
  children,
  className,
  size = "md",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: ButtonSize }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[2px] border border-transparent text-white/70 transition-colors duration-300 hover:bg-white/7.000000000000001 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-35 [&_svg]:shrink-0",
        size === "sm" ? "size-8 [&_svg]:size-3.5" : "size-10 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none",
        className,
      )}
    />
  );
}
