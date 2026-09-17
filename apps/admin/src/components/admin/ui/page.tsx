"use client";

import type { Route } from "next";
import { CircleAlert, Info, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { Button } from "./button";
import { GuardedLink } from "./unsaved";

/** Page frame: consistent gutters and a readable maximum width. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 pb-24 sm:px-6 lg:px-10", className)}>{children}</div>;
}

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  crumbs,
  meta,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  /** Small facts under the title, e.g. status and last updated. */
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 pt-6 pb-8 sm:pt-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {crumbs?.length ? (
          <nav aria-label="Breadcrumb" className="label-xs flex flex-wrap items-center gap-x-2.5 gap-y-1 text-white/55">
            {crumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-2.5">
                {crumb.href ? (
                  <GuardedLink href={crumb.href as Route} className="transition-colors hover:text-white">
                    {crumb.label}
                  </GuardedLink>
                ) : (
                  <span className="text-silver" aria-current="page">
                    {crumb.label}
                  </span>
                )}
                {i < crumbs.length - 1 ? <span aria-hidden>/</span> : null}
              </span>
            ))}
          </nav>
        ) : eyebrow ? (
          <p className="label-xs text-silver">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 font-display text-[2rem] leading-[0.95] font-light tracking-[-0.025em] break-words text-white uppercase sm:text-[2.625rem]">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-[68ch] text-[0.875rem] leading-relaxed text-white/60">{description}</p> : null}
        {meta ? <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

/** A hairline-framed panel with a small uppercase header. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-label={typeof title === "string" ? title : undefined} className={cn("border border-hairline", className)}>
      {title || action ? (
        <header className="flex min-h-12 items-center justify-between gap-4 border-b border-hairline px-4 sm:px-5">
          {typeof title === "string" ? <h2 className="label-xs text-white/70">{title}</h2> : title}
          {action}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start border border-dashed border-white/15 px-6 py-10 sm:px-10 sm:py-14", className)}>
      {icon ? <div className="mb-5 text-white/40 [&_svg]:size-6">{icon}</div> : null}
      <p className="display-sm text-white">{title}</p>
      {body ? <div className="mt-3 max-w-[56ch] text-[0.875rem] leading-relaxed text-white/60">{body}</div> : null}
      {action ? <div className="mt-6 flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse bg-white/6 motion-reduce:animate-none", className)} />;
}

/** Placeholder rows while a list loads. Announced once, politely. */
export function LoadingRows({ rows = 6, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="border-t border-hairline">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-hairline py-4">
          <Skeleton className="h-10 w-14 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="hidden h-5 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col gap-4", className)}>
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-8 w-2/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "This could not be loaded" }: { error: Error; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start border border-alert/40 px-6 py-8">
      <CircleAlert className="size-5 text-alert" aria-hidden />
      <p className="display-sm mt-4 text-white">{title}</p>
      <p className="mt-2 max-w-[56ch] text-[0.875rem] text-white/65">{error.message}</p>
      {onRetry ? (
        <Button className="mt-5" size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** A quiet informational note with a hairline rule on the left. */
export function Notice({
  title,
  children,
  tone = "info",
  className,
}: {
  title?: string;
  children?: ReactNode;
  tone?: "info" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 border-l-2 px-4 py-3",
        tone === "warning" ? "border-alert/70 bg-alert/5" : "border-silver/60 bg-white/2.5",
        className,
      )}
    >
      {tone === "warning" ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-alert" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-silver" aria-hidden />
      )}
      <div className="min-w-0 text-[0.8125rem] leading-relaxed text-white/70">
        {title ? <p className="font-medium text-white">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Label/value pairs in a hairline list — detail screens. */
export function DefinitionList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("border-t border-hairline", className)}>
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr] gap-4 border-b border-hairline py-3">
          <dt className="label-xs pt-0.5 text-white/55">{item.label}</dt>
          <dd className="min-w-0 text-[0.875rem] break-words text-white">{item.value || <span className="text-white/45">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
