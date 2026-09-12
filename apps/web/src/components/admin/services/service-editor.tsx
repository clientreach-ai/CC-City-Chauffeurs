"use client";

import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Eye, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  EditorLayout,
  focusFirstError,
  MobileActionBar,
  PublishControls,
  RecordMeta,
  SearchPreview,
  SectionIndex,
  type SaveIntent,
} from "@/components/admin/editor";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button, ButtonLink } from "@/components/admin/ui/button";
import { ChoiceCards, ErrorSummary, Field, FieldRow, FormSection, TextArea, TextInput } from "@/components/admin/ui/form";
import { Hint } from "@/components/admin/ui/hint";
import { ImageField, ImageListField } from "@/components/admin/ui/image";
import { PairListEditor, StringListEditor } from "@/components/admin/ui/list-editors";
import { OrderedPicker } from "@/components/admin/ui/ordered-picker";
import { ErrorState, LoadingBlock, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatRelative, slugify } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { getVehicles } from "@/lib/cms/repositories/fleet";
import {
  createService,
  emptyService,
  getService,
  getServices,
  updateService,
  validateService,
} from "@/lib/cms/repositories/services";
import type { PublishStatus, Service, ServiceInput } from "@/lib/cms/types";
import { CmsNotFoundError, CmsValidationError, hasErrors, SEO_LIMITS, type FieldErrors } from "@/lib/cms/validation";

import { ServicePreview } from "./service-preview";
import { livePath, useServiceActions } from "./use-service-actions";

const SECTIONS = [
  { id: "basics", label: "Basics", fields: ["name", "slug", "summary", "template"] },
  { id: "content", label: "Page content", fields: ["headline", "standfirst", "facts", "detail"] },
  { id: "benefits", label: "Key benefits", fields: ["benefits"] },
  { id: "images", label: "Images", fields: ["heroImage", "gallery"] },
  { id: "vehicles", label: "Suitable vehicles", fields: ["vehicleIds"] },
  { id: "enquiry", label: "Enquiry", fields: ["booking", "enquiry"] },
  { id: "seo", label: "SEO", fields: ["seo"] },
];

const LABELS: Record<string, string> = {
  name: "Service name",
  slug: "Slug",
  summary: "Short description",
  headline: "Headline",
  standfirst: "Opening paragraph",
  heroImage: "Hero image",
  benefits: "Key benefits",
  "seo.title": "SEO title",
  "seo.description": "SEO description",
};

const templates = [
  { value: "index", label: "Index", note: "Benefits as numbered rows, then a full-width photograph." },
  { value: "columns", label: "Columns", note: "Benefits in two columns, then photograph and story side by side." },
  { value: "stack", label: "Stack", note: "Opens on the story and photograph, then the benefits." },
] as const;

const statusNote: Record<PublishStatus, string> = {
  draft: "No page on the website yet.",
  published: "Page is on the website.",
  archived: "Kept for reference. No page on the website.",
};

function toInput(service: Service): ServiceInput {
  const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, position: _pos, ...input } = service;
  return input;
}

export function ServiceEditor({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const actions = useServiceActions();
  const formRef = useRef<HTMLFormElement>(null);

  const record = useCmsQuery(`service:${id ?? "new"}`, async () => (id ? getService(id) : null));
  const reference = useCmsQuery("service-editor:reference", async () => {
    const [services, vehicles] = await Promise.all([getServices(), getVehicles()]);
    return { services, vehicles };
  });

  const [form, setForm] = useState<ServiceInput | null>(null);
  const [baseline, setBaseline] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState<SaveIntent | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [previewing, setPreviewing] = useState(false);

  const key = id ?? "new";
  if (loadedFor !== key && (isNew || record.data)) {
    const initial = record.data ? toInput(record.data) : emptyService();
    setForm(initial);
    setBaseline(JSON.stringify(initial));
    setLoadedFor(key);
  }

  const dirty = form !== null && JSON.stringify(form) !== baseline;
  useUnsavedChanges(dirty);

  if (record.error) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Services", href: adminRoutes.services }, { label: "Not found" }]} title="Service not found" />
        <ErrorState
          error={record.error}
          title={record.error instanceof CmsNotFoundError ? "This service no longer exists" : "This service could not be loaded"}
          onRetry={record.error instanceof CmsNotFoundError ? undefined : record.reload}
        />
        <ButtonLink href={adminRoutes.services} className="mt-6">
          Back to services
        </ButtonLink>
      </PageBody>
    );
  }

  if (!form || !reference.data) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Services", href: adminRoutes.services }, { label: isNew ? "New service" : "Loading" }]} title={isNew ? "New service" : "Loading…"} />
        <LoadingBlock label="Loading the service" />
      </PageBody>
    );
  }

  const { services, vehicles } = reference.data;
  const others = services.filter((service) => service.id !== id);
  const stored = record.data;
  const status = stored?.status ?? "draft";
  const live = stored ? livePath(stored) : null;

  const update = (patch: Partial<ServiceInput>) => {
    const next = { ...form, ...patch };
    if (!slugTouched && patch.name !== undefined) next.slug = slugify(patch.name);
    setForm(next);
    if (attempted) setErrors(validateService(next, others));
  };

  const save = async (nextStatus: PublishStatus, intent: SaveIntent) => {
    // Blank lines in lists are editing leftovers, not content.
    const candidate: ServiceInput = {
      ...form,
      status: nextStatus,
      headline: form.headline.map((line) => line.trim()).filter(Boolean),
      facts: form.facts.filter((fact) => fact.label.trim() || fact.value.trim()),
      benefits: form.benefits.filter((item) => item.title.trim() || item.copy.trim()),
      detail: { ...form.detail, paragraphs: form.detail.paragraphs.filter((p) => p.trim()) },
      booking: { ...form.booking, needs: form.booking.needs.filter((need) => need.trim()) },
    };
    const found = validateService(candidate, others);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      notify.error(intent === "publish" ? "Not published yet" : "Not saved yet", "Some fields need attention — they are marked below.");
      focusFirstError(formRef.current);
      return;
    }
    setSaving(intent);
    try {
      const saved = isNew ? await createService(candidate) : await updateService(id!, candidate);
      const input = toInput(saved);
      setForm(input);
      setBaseline(JSON.stringify(input));
      setErrors({});
      setAttempted(false);
      const messages: Record<SaveIntent, [string, string]> = {
        draft: ["Draft saved", "No page on the website until it is published."],
        publish: [`${saved.name} published`, "Its page is part of the published site."],
        save: ["Changes saved", nextStatus === "published" ? "The published page is up to date." : ""],
        restore: [`${saved.name} restored`, "Saved as a draft."],
      };
      notify.success(...messages[intent]);
      if (isNew) router.replace(adminRoutes.service(saved.id));
    } catch (error) {
      if (error instanceof CmsValidationError) {
        setErrors(error.fields);
        focusFirstError(formRef.current);
        notify.error("Not saved", "Some fields need attention — they are marked below.");
      } else {
        notify.error("Not saved", errorMessage(error));
      }
    } finally {
      setSaving(null);
    }
  };

  const primaryActions = (layout: "rail" | "bar") => (
    <PublishControls
      layout={layout}
      status={status}
      isNew={isNew}
      dirty={dirty}
      saving={saving}
      canPublish={actions.canPublish}
      publishReason={actions.publishReason}
      onSave={(nextStatus, intent) => void save(nextStatus, intent)}
      onPreview={() => setPreviewing(true)}
    />
  );

  const title = form.name.trim() || (isNew ? "New service" : "Untitled service");
  const itemErrors = (prefix: string) =>
    Object.fromEntries(
      Object.entries(errors)
        .filter(([keyName]) => keyName.startsWith(`${prefix}.`))
        .map(([keyName, message]) => [keyName.slice(prefix.length + 1), message]),
    );

  return (
    <PageBody className="pb-32 lg:pb-24">
      <PageHeader
        crumbs={[{ label: "Services", href: adminRoutes.services }, { label: isNew ? "New service" : stored?.name ?? title }]}
        title={title}
        meta={
          <>
            <StatusBadge kind="publish" value={status} />
            {stored ? <span className="text-[0.8125rem] text-white/55">Saved {formatRelative(stored.updatedAt)}</span> : null}
            {dirty ? <span className="text-[0.8125rem] text-white">Unsaved changes</span> : null}
          </>
        }
        actions={
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setPreviewing(true)}>
            <Eye aria-hidden />
            Preview
          </Button>
        }
      />

      <EditorLayout
        rail={
          <>
            <Panel title="Publishing">
              <div className="flex items-center gap-3">
                <StatusBadge kind="publish" value={status} />
                <span className="text-[0.8125rem] text-white/60">{statusNote[status]}</span>
              </div>
              {!actions.canPublish ? (
                <p className="mt-3 text-[0.8125rem] leading-snug text-white/60">
                  Previewing as an editor: you can save drafts; a manager or admin publishes.
                </p>
              ) : null}
              <div className="mt-5 hidden flex-col gap-2 lg:flex">{primaryActions("rail")}</div>
              {live && status === "published" ? (
                <a
                  href={live}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center gap-2 text-[0.8125rem] text-white/65 hover:text-white"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open the live page<span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
              <div className="mt-5">
                <RecordMeta createdAt={stored?.createdAt} updatedAt={stored?.updatedAt} publishedAt={stored?.publishedAt} />
              </div>
            </Panel>

            <SectionIndex sections={SECTIONS} errors={errors} />

            {stored ? (
              <Panel title="More" bodyClassName="flex flex-col items-start gap-1 p-2">
                {status === "published" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!actions.canPublish || dirty}
                    onClick={async () => {
                      if (await actions.unpublish(stored)) record.reload();
                    }}
                  >
                    <RotateCcw aria-hidden />
                    Unpublish
                  </Button>
                ) : null}
                {status !== "archived" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!actions.canPublish || dirty}
                    onClick={async () => {
                      if (await actions.archive(stored)) record.reload();
                    }}
                  >
                    <Archive aria-hidden />
                    Archive
                  </Button>
                ) : null}
                <Hint content={actions.deleteReason} disabled={actions.canDelete}>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-alert hover:text-alert"
                      disabled={!actions.canDelete}
                      onClick={async () => {
                        if (await actions.remove(stored)) router.push(adminRoutes.services);
                      }}
                    >
                      <Trash2 aria-hidden />
                      Delete
                    </Button>
                  </span>
                </Hint>
              </Panel>
            ) : null}
          </>
        }
        main={
          <form
            ref={formRef}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save(status === "published" ? "published" : "draft", status === "published" ? "save" : "draft");
            }}
            className="flex flex-col"
          >
            {attempted && hasErrors(errors) ? (
              <div className="mb-8">
                <ErrorSummary errors={errors} labels={LABELS} />
              </div>
            ) : null}

            <FormSection id="basics" index="01" title="Basics">
              <FieldRow>
                <Field label="Service name" required error={errors.name} description="Used in the navigation and indexes, e.g. “Airport Transfers”.">
                  {(control) => <TextInput {...control} value={form.name} onChange={(event) => update({ name: event.target.value })} />}
                </Field>
                <Field
                  label="Slug"
                  required
                  error={errors.slug}
                  description={<>Page address: /chauffeur-services/{form.slug || "…"}</>}
                >
                  {(control) => (
                    <TextInput
                      {...control}
                      value={form.slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        update({ slug: event.target.value.toLowerCase().replace(/\s+/g, "-") });
                      }}
                    />
                  )}
                </Field>
              </FieldRow>
              {!isNew && stored && form.slug !== stored.slug && stored.status === "published" ? (
                <Notice tone="warning" title="Changing a published address">
                  The old address, /chauffeur-services/{stored.slug}, would stop working. Links from search results and
                  elsewhere need a permanent redirect — ask the developers to add one when this goes live.
                </Notice>
              ) : null}
              <Field
                label="Short description"
                error={errors.summary}
                counter={{ value: form.summary, max: 200 }}
                description="One line for the services page, the navigation and the footer. Required before publishing."
              >
                {(control) => <TextArea {...control} rows={2} value={form.summary} onChange={(event) => update({ summary: event.target.value })} />}
              </Field>
              <ChoiceCards
                legend="Page layout"
                options={templates}
                value={form.template}
                onChange={(template) => update({ template })}
              />
            </FormSection>

            <FormSection
              id="content"
              index="02"
              title="Page content"
              description="Say only what the business actually does. No availability promises, response times, licensing or accreditation claims unless the client has evidenced them."
            >
              <StringListEditor
                legend="Headline"
                description="Set in display type, one line per row — e.g. “Met at” / “arrivals”. Up to four short lines."
                items={form.headline}
                onChange={(headline) => update({ headline })}
                addLabel="Add line"
                itemLabel="Headline line"
                max={4}
                error={errors.headline}
              />
              <Field label="Opening paragraph" error={errors.standfirst} description="The first paragraph on the page, beside the headline. Required before publishing.">
                {(control) => <TextArea {...control} rows={4} value={form.standfirst} onChange={(event) => update({ standfirst: event.target.value })} />}
              </Field>
              <PairListEditor
                legend="Facts"
                description="The three short facts in the line under the hero, e.g. Waiting — 60 minutes complimentary after landing."
                items={form.facts.map((fact) => ({ title: fact.label, copy: fact.value }))}
                onChange={(items) => update({ facts: items.map((item) => ({ label: item.title, value: item.copy })) })}
                make={() => ({ title: "", copy: "" })}
                addLabel="Add fact"
                itemLabel="Fact"
                titleLabel="Label"
                copyLabel="Value"
                max={3}
                compact
              />
              <div className="flex flex-col gap-6 border-l border-hairline pl-4 sm:pl-6">
                <p className="label-xs text-white/60">The longer read</p>
                <Field label="Heading">
                  {(control) => (
                    <TextInput {...control} value={form.detail.heading} onChange={(event) => update({ detail: { ...form.detail, heading: event.target.value } })} />
                  )}
                </Field>
                <StringListEditor
                  legend="Paragraphs"
                  items={form.detail.paragraphs}
                  onChange={(paragraphs) => update({ detail: { ...form.detail, paragraphs } })}
                  addLabel="Add paragraph"
                  itemLabel="Paragraph"
                  multiline
                  max={4}
                />
                <ImageField
                  label="Photograph"
                  value={form.detail.image}
                  onChange={(image) => update({ detail: { ...form.detail, image } })}
                />
              </div>
            </FormSection>

            <FormSection id="benefits" index="03" title="Key benefits" description="“What the service involves” — what the client actually receives. At least one is needed to publish.">
              <PairListEditor
                legend="Benefits"
                items={form.benefits}
                onChange={(benefits) => update({ benefits })}
                make={() => ({ title: "", copy: "" })}
                addLabel="Add benefit"
                itemLabel="Benefit"
                max={8}
                error={errors.benefits}
                itemErrors={itemErrors("benefits")}
              />
            </FormSection>

            <FormSection id="images" index="04" title="Images" description="The client’s own photography only.">
              <ImageField
                label="Hero image"
                required
                value={form.heroImage}
                onChange={(heroImage) => update({ heroImage })}
                error={errors.heroImage}
                aspect="aspect-[16/10]"
              />
              <ImageListField
                label="Gallery"
                description="Optional further photographs for the page."
                value={form.gallery}
                onChange={(gallery) => update({ gallery })}
                max={12}
              />
            </FormSection>

            <FormSection
              id="vehicles"
              index="05"
              title="Suitable vehicles"
              description="Shown as “Vehicles typically used”, in this order. Four sit on one row."
            >
              <OrderedPicker
                legend="Vehicles"
                itemNoun="vehicle"
                options={vehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label: vehicle.name,
                  note: vehicle.status !== "published" ? "not published" : undefined,
                }))}
                value={form.vehicleIds}
                onChange={(vehicleIds) => update({ vehicleIds })}
                max={8}
              />
            </FormSection>

            <FormSection
              id="enquiry"
              index="06"
              title="Enquiry"
              description="What the client needs to quote, and the call to action. The button opens the quote form with this service already chosen."
            >
              <StringListEditor
                legend="To quote, we need"
                description="The questions otherwise asked back — the brief in one message."
                items={form.booking.needs}
                onChange={(needs) => update({ booking: { ...form.booking, needs } })}
                addLabel="Add item"
                itemLabel="Item"
                max={6}
              />
              <Field label="Booking note" description="One practical term, e.g. the four-hour minimum. Only terms the client has confirmed.">
                {(control) => (
                  <TextArea {...control} rows={2} value={form.booking.note} onChange={(event) => update({ booking: { ...form.booking, note: event.target.value } })} />
                )}
              </Field>
              <FieldRow>
                <Field label="Closing line" description="The heading of the enquiry band at the foot of the page.">
                  {(control) => (
                    <TextInput {...control} value={form.enquiry.heading} onChange={(event) => update({ enquiry: { ...form.enquiry, heading: event.target.value } })} />
                  )}
                </Field>
                <Field label="Button text" description={<>Opens /request-a-quote?service={form.slug || "…"}</>}>
                  {(control) => (
                    <TextInput {...control} value={form.enquiry.ctaLabel} onChange={(event) => update({ enquiry: { ...form.enquiry, ctaLabel: event.target.value } })} />
                  )}
                </Field>
              </FieldRow>
            </FormSection>

            <FormSection id="seo" index="07" title="SEO" description="Both are required before publishing.">
              <Field label="SEO title" error={errors["seo.title"]} counter={{ value: form.seo.title, max: SEO_LIMITS.title }}>
                {(control) => <TextInput {...control} value={form.seo.title} onChange={(event) => update({ seo: { ...form.seo, title: event.target.value } })} />}
              </Field>
              <Field label="SEO description" error={errors["seo.description"]} counter={{ value: form.seo.description, max: SEO_LIMITS.description }}>
                {(control) => (
                  <TextArea {...control} rows={3} value={form.seo.description} onChange={(event) => update({ seo: { ...form.seo, description: event.target.value } })} />
                )}
              </Field>
              <SearchPreview
                title={form.seo.title || "Add an SEO title"}
                description={form.seo.description || "Add an SEO description."}
                path={`/chauffeur-services/${form.slug}`}
              />
            </FormSection>
          </form>
        }
      />

      <MobileActionBar dirty={dirty}>{primaryActions("bar")}</MobileActionBar>

      <ServicePreview open={previewing} onClose={() => setPreviewing(false)} service={form} vehicles={vehicles} />
    </PageBody>
  );
}
