import Link from "next/link";
import type { Route } from "next";
import { Fragment, type ReactNode } from "react";

/** Page gutter. One shared value so every section aligns to the same column. */
export const shell = "mx-auto w-full max-w-[1560px] px-6 sm:px-10 lg:px-16";

type Tone = "dark" | "light";

/** Small uppercase section marker: "(03) The Fleet". */
export function SectionLabel({
  index,
  children,
  tone = "dark",
  className = "",
}: {
  index?: string;
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <p
      className={`label-xs flex items-center gap-3 ${
        tone === "dark" ? "text-steel" : "text-ink-muted"
      } ${className}`}
    >
      {index ? (
        <span className={tone === "dark" ? "text-silver" : "text-ink"}>({index})</span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}

/** 1px editorial column rule. */
export function Rule({
  tone = "dark",
  className = "",
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    <hr
      className={`h-px w-full border-0 ${
        tone === "dark" ? "bg-hairline" : "bg-hairline-ink"
      } ${className}`}
    />
  );
}

/**
 * Section header: a hairline, then the label on the left and a short note on
 * the right. Used at the top of nearly every section on the site.
 */
export function SectionHead({
  index,
  label,
  note,
  tone = "dark",
}: {
  index?: string;
  label: string;
  note?: string;
  tone?: Tone;
}) {
  return (
    <>
      <Rule tone={tone} />
      <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
        <SectionLabel index={index} tone={tone}>
          {label}
        </SectionLabel>
        {note ? (
          <p className={`label-xs ${tone === "dark" ? "text-white/55" : "text-slate"}`}>
            {note}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Ghost button that resolves to a Link for internal routes. */
export function GhostLink({
  href,
  tone = "dark",
  children,
  external,
  className = "",
}: {
  href: string;
  tone?: Tone;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = `btn-ghost ${tone === "dark" ? "btn-on-dark" : "btn-on-light"} ${className}`;

  if (external || href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:")) {
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

/** Quiet text link with the drawn-in underline. */
export function QuietLink({
  href,
  children,
  tone = "dark",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const classes = `label-xs link-quiet ${
    tone === "dark" ? "text-white/70 hover:text-white" : "text-ink"
  } ${className}`;

  if (href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:")) {
    return (
      <a href={href} className={classes}>
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

/**
 * Keeps hyphenated words whole — "V-Class", "G-Wagon", "Rolls-Royce" — so a
 * vehicle name set in display type never breaks as "V- / CLASS". Spaces
 * still wrap as normal.
 */
export function Unbroken({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 ? " " : null}
          {word.includes("-") ? <span className="whitespace-nowrap">{word}</span> : word}
        </Fragment>
      ))}
    </>
  );
}
