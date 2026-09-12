"use client";

import { ExternalLink, Pin } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { focusFirstError } from "@/components/admin/editor";
import { usePreferences } from "@/components/admin/shell/preferences";
import { Button } from "@/components/admin/ui/button";
import { ErrorSummary, Switch } from "@/components/admin/ui/form";
import { move, ReorderButtons } from "@/components/admin/ui/list-editors";
import { ErrorState, LoadingBlock, Notice, PageBody, PageHeader } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useLeaveGuard, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatRelative } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { deniedReason } from "@/lib/cms/permissions";
import { getHomepage, reorderSections, setSectionVisibility, updateSection, validateSection } from "@/lib/cms/repositories/content";
import { getVehicles } from "@/lib/cms/repositories/fleet";
import { getServices } from "@/lib/cms/repositories/services";
import { getTestimonials } from "@/lib/cms/repositories/testimonials";
import type { HomepageSection } from "@/lib/cms/types";
import { CmsValidationError, hasErrors, type FieldErrors } from "@/lib/cms/validation";

import { SectionFields } from "./section-fields";

export function ContentManager() {
  const { can } = usePreferences();
  const guard = useLeaveGuard();
  const { data, loading, error, reload } = useCmsQuery("content:homepage", async () => {
    const [sections, services, vehicles, testimonials] = await Promise.all([getHomepage(), getServices(), getVehicles(), getTestimonials()]);
    return { sections, services, vehicles, published: testimonials.filter((t) => t.status === "published").length };
  });
  const [selectedId, setSelectedId] = useState("hero");

  const sections = data?.sections ?? [];
  const canPublish = can("content.publish");
  const selected = sections.find((section) => section.id === selectedId) ?? sections[0];

  // Bands after the hero take numbers in order, as on the homepage itself.
  const numbered = sections.filter((section) => section.kind !== "hero" && section.visible);
  const bandNumber = (section: HomepageSection) => {
    const index = numbered.indexOf(section);
    return index >= 0 ? String(index + 1).padStart(2, "0") : null;
  };

  const choose = async (id: string) => {
    if (id === selectedId) return;
    if (await guard.confirmLeave()) setSelectedId(id);
  };

  const reorder = async (from: number, to: number) => {
    // Position 0 is the hero; it never moves.
    if (from === 0 || to === 0) return;
    try {
      await reorderSections(move(sections, from, to).map((section) => section.id));
      notify.success("Order saved");
    } catch (err) {
      notify.error("Order not saved", errorMessage(err));
    }
  };

  const toggle = async (section: HomepageSection, visible: boolean) => {
    try {
      await setSectionVisibility(section.id, visible);
      notify.success(visible ? `${section.name} shown` : `${section.name} hidden`, visible ? undefined : "The bands after it renumber themselves.");
    } catch (err) {
      notify.error("Not changed", errorMessage(err));
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Homepage"
        description="The words, photographs and links in each homepage band, which bands show, and their order. Layout and styling stay with the design — this is the content inside it."
        actions={
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 border border-white/30 px-4 text-[0.6875rem] font-medium tracking-[0.12em] text-white uppercase transition-colors hover:border-white"
          >
            View the homepage
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !selected ? (
        <LoadingBlock label="Loading the homepage" />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] xl:gap-12">
          <nav aria-label="Homepage bands" className="lg:sticky lg:top-18 lg:self-start">
            <p className="label-xs mb-3 text-white/55">Bands, top to bottom</p>
            <ol className="border-t border-hairline">
              {sections.map((section, i) => {
                const active = section.id === selected.id;
                const number = bandNumber(section);
                return (
                  <li key={section.id} className={cn("flex items-center gap-2 border-b border-hairline", active ? "bg-white/5" : "")}>
                    <button
                      type="button"
                      onClick={() => void choose(section.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "relative flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
                        active ? "text-white" : "text-white/70 hover:text-white",
                      )}
                    >
                      <span aria-hidden className={cn("absolute inset-y-2 left-0 w-px bg-white", active ? "opacity-100" : "opacity-0")} />
                      <span className="label-xs w-6 shrink-0 text-white/45 tabular-nums">
                        {section.kind === "hero" ? <Pin className="size-3" aria-label="Pinned first" /> : number ?? "—"}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block truncate text-[0.875rem]", section.visible ? "" : "text-white/45 line-through decoration-white/30")}>
                          {section.name}
                        </span>
                        <span className="block text-[0.6875rem] text-white/45">
                          {section.visible ? `Edited ${formatRelative(section.updatedAt)}` : "Hidden"}
                        </span>
                      </span>
                    </button>
                    {section.kind === "hero" ? (
                      <span className="w-17 shrink-0" aria-hidden />
                    ) : (
                      <div className="flex shrink-0 items-center">
                        <ReorderButtons
                          index={i}
                          count={sections.length}
                          itemLabel={section.name}
                          onMove={(from, to) => void reorder(from, to)}
                        />
                      </div>
                    )}
                    <div className="shrink-0 pr-3">
                      <Switch
                        label={`Show ${section.name} on the homepage`}
                        checked={section.visible}
                        disabled={section.kind === "hero" || !canPublish}
                        onChange={(on) => void toggle(section, on)}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[0.75rem] leading-snug text-white/50">
              The hero always opens the page. {canPublish ? "" : deniedReason("content.publish")}
            </p>
          </nav>

          <SectionEditor
            key={selected.id}
            section={selected}
            number={bandNumber(selected)}
            services={data!.services}
            vehicles={data!.vehicles}
            publishedTestimonials={data!.published}
            canPublish={canPublish}
          />
        </div>
      )}
    </PageBody>
  );
}

function SectionEditor({
  section,
  number,
  services,
  vehicles,
  publishedTestimonials,
  canPublish,
}: {
  section: HomepageSection;
  number: string | null;
  services: Parameters<typeof SectionFields>[0]["services"];
  vehicles: Parameters<typeof SectionFields>[0]["vehicles"];
  publishedTestimonials: number;
  canPublish: boolean;
}) {
  const [form, setForm] = useState(section);
  const [baseline, setBaseline] = useState(JSON.stringify(section));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(form) !== baseline;
  useUnsavedChanges(dirty);

  const change = (next: HomepageSection) => {
    setForm(next);
    if (attempted) setErrors(validateSection(next));
  };

  const save = async () => {
    const found = validateSection(form);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(ref.current);
      return;
    }
    setSaving(true);
    try {
      const saved = await updateSection(form);
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      setAttempted(false);
      notify.success(`${saved.name} saved`);
    } catch (err) {
      if (err instanceof CmsValidationError) setErrors(err.fields);
      else notify.error("Not saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      ref={ref}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      aria-labelledby="section-editor-title"
      className="min-w-0"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-t border-hairline pt-6 pb-6">
        <div>
          <p className="label-xs text-silver">{section.kind === "hero" ? "Opens the page" : number ? `Band ${number}` : "Hidden band"}</p>
          <h2 id="section-editor-title" className="display-sm mt-2 text-white">
            {section.name}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-[0.8125rem] text-white">Unsaved changes</span> : null}
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => {
            setForm(section);
            setErrors({});
            setAttempted(false);
          }}>
            Discard
          </Button>
          <Button type="submit" variant="primary" busy={saving} disabled={!dirty || !canPublish}>
            Save band
          </Button>
        </div>
      </header>

      {!canPublish ? (
        <Notice className="mb-6">The homepage is live content: editors can make changes here, but a manager or admin saves them.</Notice>
      ) : null}

      {attempted && hasErrors(errors) ? (
        <div className="mb-6">
          <ErrorSummary errors={errors} />
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <SectionFields
          section={form}
          onChange={change}
          errors={errors}
          services={services}
          vehicles={vehicles}
          publishedTestimonials={publishedTestimonials}
        />
      </div>
    </form>
  );
}
