import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

export type Tone = "dark" | "light";
export type ButtonVariant = "solid" | "outline";

/**
 * The site has exactly two button weights on each ground:
 *
 *   solid   — the one action we most want taken in a given band
 *   outline — everything else
 *
 * `tone` is the ground the button sits on, not the button's own colour, so a
 * section can be re-grounded without touching its controls.
 */
export function buttonClass({
  tone = "dark",
  variant = "outline",
  className = "",
}: {
  tone?: Tone;
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  const weight =
    variant === "solid"
      ? tone === "dark"
        ? "btn-solid-invert"
        : "btn-solid"
      : tone === "dark"
        ? "btn-on-dark"
        : "btn-on-light";

  return `btn-ghost ${weight} ${className}`.trim();
}

function isExternal(href: string) {
  return (
    href.startsWith("http") ||
    href.startsWith("tel:") ||
    href.startsWith("mailto:") ||
    href.startsWith("#")
  );
}

/**
 * Renders a `Link` for internal routes and an anchor for everything else,
 * so call sites never have to decide which they need.
 */
export function ButtonLink({
  href,
  tone = "dark",
  variant = "outline",
  external,
  className = "",
  children,
}: {
  href: string;
  tone?: Tone;
  variant?: ButtonVariant;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = buttonClass({ tone, variant, className });

  if (external || isExternal(href)) {
    return (
      <a
        href={href}
        className={classes}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href as Route} className={classes}>
      {children}
    </Link>
  );
}
