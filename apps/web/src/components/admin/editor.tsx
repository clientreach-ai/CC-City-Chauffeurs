"use client";

import { Eye, RotateCcw } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { Button } from "@/components/admin/ui/button";
import { Hint } from "@/components/admin/ui/hint";
import { formatDateTime } from "@/lib/cms/format";
import type { PublishStatus } from "@/lib/cms/types";

export type SaveIntent = "draft" | "publish" | "save" | "restore";

/**
 * The publishing buttons for a content record, by state:
 *   new / draft — Publish · Save draft · Preview
 *   published   — Save changes · Preview   (unpublish lives under "More")
 *   archived    — Save changes · Restore as draft
 */
export function PublishControls({
  status,
  isNew,
  dirty,
  saving,
  canPublish,
  publishReason,
  onSave,
  onPreview,
  layout,
}: {
  status: PublishStatus;
  isNew: boolean;
  dirty: boolean;
  saving: SaveIntent | null;
  canPublish: boolean;
  publishReason: string;
  onSave: (status: PublishStatus, intent: SaveIntent) => void;
  onPreview: () => void;
  layout: "rail" | "bar";
}) {
  const wide = layout === "rail" ? "w-full" : "";
  const busy = saving !== null;
  const preview =
    layout === "rail" ? (
      <Button className={wide} variant={status === "published" ? "secondary" : "ghost"} onClick={onPreview}>
        <Eye aria-hidden />
        Preview
      </Button>
    ) : null;

  if (status === "published" && !isNew) {
    // Saving a published record changes the website: a publishing action.
    return (
      <>
        <Hint content={publishReason} disabled={canPublish}>
          <span className={wide}>
            <Button
              variant="primary"
              className={wide}
              disabled={!canPublish || !dirty || busy}
              busy={saving === "save"}
              onClick={() => onSave("published", "save")}
            >
              Save changes
            </Button>
          </span>
        </Hint>
        {preview}
      </>
    );
  }

  if (status === "archived" && !isNew) {
    return (
      <>
        <Button variant="primary" className={wide} disabled={!dirty || busy} busy={saving === "save"} onClick={() => onSave("archived", "save")}>
          Save changes
        </Button>
        <Button className={wide} disabled={busy} busy={saving === "restore"} onClick={() => onSave("draft", "restore")}>
          <RotateCcw aria-hidden />
          Restore as draft
        </Button>
      </>
    );
  }

  return (
    <>
      <Hint content={publishReason} disabled={canPublish}>
        <span className={wide}>
          <Button variant="primary" className={wide} disabled={!canPublish || busy} busy={saving === "publish"} onClick={() => onSave("published", "publish")}>
            Publish
          </Button>
        </span>
      </Hint>
      <Button className={wide} disabled={busy} busy={saving === "draft"} onClick={() => onSave("draft", "draft")}>
        Save draft
      </Button>
      {preview}
    </>
  );
}

/**
 * Shared layout pieces for the content editors (vehicles, services): a main
 * column of sections, a sticky publishing rail, a section index, and a
 * phone-width action bar.
 */

export function EditorLayout({ main, rail }: { main: ReactNode; rail: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
      <div className="order-2 min-w-0 lg:order-1">{main}</div>
      <aside className="order-1 lg:order-2" aria-label="Publishing">
        <div className="flex flex-col gap-5 lg:sticky lg:top-18">{rail}</div>
      </aside>
    </div>
  );
}

export function SectionIndex({
  sections,
  errors,
}: {
  sections: { id: string; label: string; fields: string[] }[];
  errors: Record<string, string>;
}) {
  const keys = Object.keys(errors);
  return (
    <nav aria-label="Sections" className="hidden border border-hairline lg:block">
      <p className="label-xs border-b border-hairline px-4 py-3 text-white/55">On this page</p>
      <ol className="py-1.5">
        {sections.map((section, i) => {
          const broken = keys.some((key) => section.fields.some((field) => key === field || key.startsWith(`${field}.`)));
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-center gap-3 px-4 py-1.5 text-[0.8125rem] text-white/65 transition-colors hover:text-white"
              >
                <span className="label-xs w-5 text-white/40 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{section.label}</span>
                {broken ? (
                  <span className="text-[0.6875rem] text-alert">
                    <span aria-hidden>●</span>
                    <span className="sr-only">has errors</span>
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function RecordMeta({
  createdAt,
  updatedAt,
  publishedAt,
}: {
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}) {
  const rows = [
    ["Created", createdAt],
    ["Last saved", updatedAt],
    ["First published", publishedAt],
  ].filter((row): row is [string, string] => !!row[1]);
  if (!rows.length) return null;
  return (
    <dl className="flex flex-col gap-1.5 border-t border-hairline pt-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 text-[0.75rem]">
          <dt className="text-white/50">{label}</dt>
          <dd className="text-white/75 tabular-nums">{formatDateTime(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Save bar pinned to the bottom of the screen below `lg`. */
export function MobileActionBar({ children, dirty }: { children: ReactNode; dirty: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline-strong bg-obsidian/95 px-4 py-3 backdrop-blur-[6px] lg:hidden">
      <div className="flex items-center gap-2">
        <p className={cn("mr-auto text-[0.75rem]", dirty ? "text-white" : "text-white/50")} aria-live="polite">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        {children}
      </div>
    </div>
  );
}

/** Moves focus to the first invalid control after a failed save. */
export function focusFirstError(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    const target = root?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error-anchor]');
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    }
  });
}

/** Search-result preview for SEO fields. */
export function SearchPreview({ title, description, path }: { title: string; description: string; path: string }) {
  return (
    <div className="border border-white/12 bg-obsidian p-4" aria-label="Search result preview">
      <p className="label-xs mb-3 text-white/45">Search preview</p>
      <p className="truncate text-[0.75rem] text-white/55">www.city-chauffeurs.com{path}</p>
      <p className="mt-1 line-clamp-1 text-[1.0625rem] leading-snug text-white">{title}</p>
      <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-white/60">{description}</p>
    </div>
  );
}
