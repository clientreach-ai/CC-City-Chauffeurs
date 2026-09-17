"use client";

import { useRouter } from "next/navigation";
import { Archive, Copy, Eye, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button, ButtonLink } from "@/components/admin/ui/button";
import {
  CheckboxGrid,
  ChoiceCards,
  ErrorSummary,
  Field,
  FieldRow,
  FormSection,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui/form";
import { Hint } from "@/components/admin/ui/hint";
import { ImageField, ImageListField } from "@/components/admin/ui/image";
import { TagInput } from "@/components/admin/ui/list-editors";
import { ErrorState, LoadingBlock, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatRelative, rateLabel, slugify } from "@CC-City-Chauffeurs/core";
import { errorMessage, useCmsQuery } from "@/lib/query";
import {
  createFeature,
  createVehicle,
  emptyVehicle,
  getCategories,
  getFeatures,
  getVehicle,
  getVehicles,
  updateVehicle,
  validateVehicle,
} from "@/lib/api/fleet";
import { getServices } from "@/lib/api/services";
import { availabilityOptions, ownershipOptions } from "@CC-City-Chauffeurs/core";
import type { PublishStatus, Vehicle, VehicleInput } from "@CC-City-Chauffeurs/core";
import { CmsNotFoundError, CmsValidationError, hasErrors, SEO_LIMITS, type FieldErrors } from "@CC-City-Chauffeurs/core";

import { useVehicleActions } from "./use-vehicle-actions";
import { VehiclePreview } from "./vehicle-preview";

const SECTIONS = [
  { id: "basics", label: "Basic information", fields: ["name", "make", "model", "categoryIds", "shortDescription", "description"] },
  { id: "specs", label: "Specifications", fields: ["specs", "availability", "ownership"] },
  { id: "features", label: "Features", fields: ["featureIds"] },
  { id: "services", label: "Services", fields: ["serviceIds", "suitedTags"] },
  { id: "pricing", label: "Pricing", fields: ["pricing"] },
  { id: "images", label: "Images", fields: ["images"] },
  { id: "seo", label: "Address & SEO", fields: ["slug", "seo"] },
];

const LABELS: Record<string, string> = {
  name: "Vehicle name",
  make: "Make",
  slug: "Slug",
  shortDescription: "Short description",
  categoryIds: "Groupings",
  "specs.passengers": "Passengers",
  "specs.year": "Year",
  "pricing.hourlyRate": "Hourly rate",
  "pricing.dayRate": "Day rate",
  "images.main": "Main image",
  "seo.title": "SEO title",
  "seo.description": "SEO description",
};

function toInput(vehicle: Vehicle): VehicleInput {
  const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, ...input } = vehicle;
  return input;
}

const statusNote: Record<PublishStatus, string> = {
  draft: "Not visible on the website.",
  published: "Visible on the fleet page.",
  archived: "Kept for reference. Not visible on the website.",
};

export function VehicleEditor({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();
  const { can } = usePreferences();
  const actions = useVehicleActions();
  const formRef = useRef<HTMLFormElement>(null);

  const record = useCmsQuery(`vehicle:${id ?? "new"}`, async () => (id ? getVehicle(id) : null));
  const reference = useCmsQuery("vehicle-editor:reference", async () => {
    const [categories, features, services, vehicles] = await Promise.all([
      getCategories(),
      getFeatures(),
      getServices(),
      getVehicles(),
    ]);
    return { categories, features, services, vehicles };
  });

  const [form, setForm] = useState<VehicleInput | null>(null);
  const [baseline, setBaseline] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState<SaveIntent | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [previewing, setPreviewing] = useState(false);
  const [newFeature, setNewFeature] = useState({ label: "", note: "" });
  const [addingFeature, setAddingFeature] = useState(false);

  // Take the stored record into the form once per vehicle; later refreshes
  // (after a save elsewhere) must not overwrite what is being typed.
  const key = id ?? "new";
  if (loadedFor !== key && (isNew || record.data)) {
    const initial = record.data ? toInput(record.data) : emptyVehicle();
    setForm(initial);
    setBaseline(JSON.stringify(initial));
    setLoadedFor(key);
  }

  const dirty = form !== null && JSON.stringify(form) !== baseline;
  useUnsavedChanges(dirty);

  if (record.error) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Fleet", href: adminRoutes.fleet }, { label: "Not found" }]} title="Vehicle not found" />
        <ErrorState
          error={record.error}
          title={record.error instanceof CmsNotFoundError ? "This vehicle no longer exists" : "This vehicle could not be loaded"}
          onRetry={record.error instanceof CmsNotFoundError ? undefined : record.reload}
        />
        <ButtonLink href={adminRoutes.fleet} className="mt-6">
          Back to the fleet
        </ButtonLink>
      </PageBody>
    );
  }

  if (!form || !reference.data) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Fleet", href: adminRoutes.fleet }, { label: isNew ? "New vehicle" : "Loading" }]} title={isNew ? "New vehicle" : "Loading…"} />
        <LoadingBlock label="Loading the vehicle" />
      </PageBody>
    );
  }

  const { categories, features, services, vehicles } = reference.data;
  const others = vehicles.filter((vehicle) => vehicle.id !== id);
  const stored = record.data;
  const status = stored?.status ?? "draft";

  const update = (patch: Partial<VehicleInput>) => {
    const next = { ...form, ...patch };
    if (!slugTouched && patch.name !== undefined) next.slug = slugify(patch.name);
    setForm(next);
    if (attempted) setErrors(validateVehicle(next, others));
  };
  const specs = (patch: Partial<VehicleInput["specs"]>) => update({ specs: { ...form.specs, ...patch } });
  const pricing = (patch: Partial<VehicleInput["pricing"]>) => update({ pricing: { ...form.pricing, ...patch } });
  const seo = (patch: Partial<VehicleInput["seo"]>) => update({ seo: { ...form.seo, ...patch } });

  const save = async (nextStatus: PublishStatus, intent: SaveIntent) => {
    const candidate = { ...form, status: nextStatus };
    const found = validateVehicle(candidate, others);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      notify.error(
        intent === "publish" ? "Not published yet" : "Not saved yet",
        "Some fields need attention — they are marked below.",
      );
      focusFirstError(formRef.current);
      return;
    }
    setSaving(intent);
    try {
      const saved = isNew ? await createVehicle(candidate) : await updateVehicle(id!, candidate);
      const input = toInput(saved);
      setForm(input);
      setBaseline(JSON.stringify(input));
      setErrors({});
      setAttempted(false);
      const messages: Record<SaveIntent, [string, string]> = {
        draft: ["Draft saved", "Not visible on the website until it is published."],
        publish: [`${saved.name} published`, "It is now part of the published fleet."],
        save: ["Changes saved", nextStatus === "published" ? "The published vehicle is up to date." : ""],
        restore: [`${saved.name} restored`, "Saved as a draft."],
      };
      notify.success(...messages[intent]);
      if (isNew) router.replace(adminRoutes.vehicle(saved.id));
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

  const addFeature = async () => {
    setAddingFeature(true);
    try {
      const feature = await createFeature(newFeature.label, newFeature.note);
      update({ featureIds: [...form.featureIds, feature.id] });
      setNewFeature({ label: "", note: "" });
      notify.success(`“${feature.label}” added to the feature list`, "It is now available to every vehicle.");
    } catch (error) {
      notify.error("Feature not added", error instanceof CmsValidationError ? Object.values(error.fields)[0] : errorMessage(error));
    } finally {
      setAddingFeature(false);
    }
  };

  const canPublish = can("content.publish");
  const suggestions = Array.from(new Set(vehicles.flatMap((vehicle) => vehicle.suitedTags))).sort();
  const seoTitleDefault = `${form.name || "Vehicle"} | Chauffeur-Driven | CC City Chauffeurs`;

  const primaryActions = (layout: "rail" | "bar") => (
    <PublishControls
      layout={layout}
      status={status}
      isNew={isNew}
      dirty={dirty}
      saving={saving}
      canPublish={canPublish}
      publishReason={actions.publishReason}
      onSave={(nextStatus, intent) => void save(nextStatus, intent)}
      onPreview={() => setPreviewing(true)}
    />
  );

  const title = form.name.trim() || (isNew ? "New vehicle" : "Untitled vehicle");

  return (
    <PageBody className="pb-32 lg:pb-24">
      <PageHeader
        crumbs={[{ label: "Fleet", href: adminRoutes.fleet }, { label: isNew ? "New vehicle" : stored?.name ?? title }]}
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
              {status === "published" && dirty ? (
                <p className="mt-3 text-[0.8125rem] text-white">You have unsaved changes to a published vehicle.</p>
              ) : null}
              {!canPublish ? (
                <p className="mt-3 text-[0.8125rem] leading-snug text-white/60">
                  Previewing as an editor: you can save drafts; a manager or admin publishes.
                </p>
              ) : null}
              <div className="mt-5 hidden flex-col gap-2 lg:flex">{primaryActions("rail")}</div>
              <div className="mt-5">
                <RecordMeta createdAt={stored?.createdAt} updatedAt={stored?.updatedAt} publishedAt={stored?.publishedAt} />
              </div>
            </Panel>

            <SectionIndex sections={SECTIONS} errors={errors} />

            {stored ? (
              <Panel title="More" bodyClassName="flex flex-col items-start gap-1 p-2">
                <Button variant="ghost" size="sm" onClick={() => void actions.duplicate(stored)}>
                  <Copy aria-hidden />
                  Duplicate
                </Button>
                {status === "published" ? (
                  <Hint content={actions.publishReason} disabled={canPublish}>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canPublish || dirty}
                        title={dirty ? "Save or discard your changes first" : undefined}
                        onClick={async () => {
                          if (await actions.unpublish(stored)) record.reload();
                        }}
                      >
                        <RotateCcw aria-hidden />
                        Unpublish
                      </Button>
                    </span>
                  </Hint>
                ) : null}
                {status !== "archived" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canPublish || dirty}
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
                        if (await actions.remove(stored)) router.push(adminRoutes.fleet);
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

            <FormSection id="basics" index="01" title="Basic information">
              <Field label="Vehicle name" required error={errors.name} description="As the client lists it, e.g. “Rolls-Royce Cullinan”.">
                {(control) => (
                  <TextInput {...control} value={form.name} onChange={(event) => update({ name: event.target.value })} maxLength={80} />
                )}
              </Field>
              <FieldRow>
                <Field label="Make" error={errors.make} description="Shown above the name, e.g. “Rolls-Royce”.">
                  {(control) => <TextInput {...control} value={form.make} onChange={(event) => update({ make: event.target.value })} />}
                </Field>
                <Field label="Model">
                  {(control) => <TextInput {...control} value={form.model} onChange={(event) => update({ model: event.target.value })} />}
                </Field>
              </FieldRow>
              <CheckboxGrid
                legend="Fleet groupings"
                description="A vehicle can sit in more than one grouping — the Cullinan is both a chauffeur car and a high-profile SUV. Required before publishing."
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.title,
                  note: category.status === "draft" ? "Hidden grouping" : undefined,
                }))}
                value={form.categoryIds}
                onChange={(categoryIds) => update({ categoryIds })}
                error={errors.categoryIds}
              />
              <Field
                label="Short description"
                error={errors.shortDescription}
                counter={{ value: form.shortDescription, max: 220 }}
                description="One editorial line under the name. Describe the experience — never a specification the client has not confirmed."
              >
                {(control) => (
                  <TextArea {...control} rows={2} value={form.shortDescription} onChange={(event) => update({ shortDescription: event.target.value })} />
                )}
              </Field>
              <Field label="Full description" description="For the vehicle’s own page, when vehicle pages are added. Optional.">
                {(control) => (
                  <TextArea {...control} rows={5} value={form.description} onChange={(event) => update({ description: event.target.value })} />
                )}
              </Field>
            </FormSection>

            <FormSection
              id="specs"
              index="02"
              title="Specifications"
              description="Capacities are shown only where the client has confirmed them. Leave a field blank and the website prints “On enquiry” — never an estimate."
            >
              <FieldRow>
                <Field label="Passengers" error={errors["specs.passengers"]} description="Blank shows “On enquiry”.">
                  {(control) => (
                    <NumberInput {...control} min={1} max={60} step={1} value={form.specs.passengers} onValueChange={(passengers) => specs({ passengers })} />
                  )}
                </Field>
                <Field label="Luggage" description="As confirmed, e.g. “2 large cases”. Blank shows “On enquiry”.">
                  {(control) => (
                    <TextInput {...control} value={form.specs.luggage} onChange={(event) => specs({ luggage: event.target.value })} placeholder="Not confirmed" />
                  )}
                </Field>
              </FieldRow>
              <FieldRow columns={3}>
                <Field label="Year" error={errors["specs.year"]}>
                  {(control) => (
                    <NumberInput {...control} min={1950} step={1} value={form.specs.year} onValueChange={(year) => specs({ year })} placeholder="Not stated" />
                  )}
                </Field>
                <Field label="Transmission">
                  {(control) => (
                    <Select {...control} value={form.specs.transmission} onChange={(event) => specs({ transmission: event.target.value })}>
                      <option value="">Not stated</option>
                      <option>Automatic</option>
                      <option>Manual</option>
                    </Select>
                  )}
                </Field>
                <Field label="Body type">
                  {(control) => (
                    <Select {...control} value={form.specs.bodyType} onChange={(event) => specs({ bodyType: event.target.value })}>
                      <option value="">Not stated</option>
                      {["Saloon", "SUV", "MPV", "Coupé", "Convertible", "Estate"].map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </FieldRow>
              <ChoiceCards
                legend="Availability"
                columns={2}
                options={availabilityOptions}
                value={form.availability}
                onChange={(availability) => update({ availability })}
              />
              <Field label="Ownership" description="Internal only — never shown on the website (PRD §10.7).">
                {(control) => (
                  <Select {...control} value={form.ownership} onChange={(event) => update({ ownership: event.target.value as VehicleInput["ownership"] })}>
                    {ownershipOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </FormSection>

            <FormSection
              id="features"
              index="03"
              title="Features"
              description="Chosen from one shared list, so every vehicle describes the same thing the same way. The client’s intake lists these as standard in every car."
            >
              <CheckboxGrid
                legend="Included with this vehicle"
                options={features.map((feature) => ({ value: feature.id, label: feature.label, note: feature.note || undefined }))}
                value={form.featureIds}
                onChange={(featureIds) => update({ featureIds })}
              />
              <div className="border border-dashed border-white/15 p-4">
                <p className="label-xs text-white/60">Add a feature to the shared list</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem_auto]">
                  <TextInput
                    aria-label="New feature name"
                    placeholder="e.g. Wi-Fi"
                    value={newFeature.label}
                    onChange={(event) => setNewFeature({ ...newFeature, label: event.target.value })}
                  />
                  <TextInput
                    aria-label="Qualifier (optional)"
                    placeholder="Qualifier, e.g. On request"
                    value={newFeature.note}
                    onChange={(event) => setNewFeature({ ...newFeature, note: event.target.value })}
                  />
                  <Button disabled={!newFeature.label.trim()} busy={addingFeature} onClick={addFeature}>
                    <Plus aria-hidden />
                    Add
                  </Button>
                </div>
              </div>
            </FormSection>

            <FormSection
              id="services"
              index="04"
              title="Services"
              description="Where this vehicle is offered. Ticking a service lists the vehicle under “Vehicles typically used” on that service page."
            >
              <CheckboxGrid
                legend="Offered for"
                columns={3}
                options={services.map((service) => ({
                  value: service.id,
                  label: service.name,
                  note: service.status !== "published" ? "Service not published" : undefined,
                }))}
                value={form.serviceIds}
                onChange={(serviceIds) => update({ serviceIds })}
              />
              <TagInput
                legend="“Suited to” labels"
                description="The short labels printed under the vehicle on the fleet page."
                value={form.suitedTags}
                onChange={(suitedTags) => update({ suitedTags })}
                suggestions={suggestions}
              />
            </FormSection>

            <FormSection
              id="pricing"
              index="05"
              title="Pricing"
              description="Indicative only — every price is confirmed on enquiry. Leave the hourly rate blank and the website shows “On request”; weddings and bespoke work are always quoted."
            >
              <FieldRow>
                <Field label="Hourly rate" error={errors["pricing.hourlyRate"]} description={`Shown as “${rateLabel(form)}”.`}>
                  {(control) => (
                    <NumberInput {...control} prefix="£" min={0} step={5} value={form.pricing.hourlyRate} onValueChange={(hourlyRate) => pricing({ hourlyRate })} placeholder="On request" />
                  )}
                </Field>
                <Field label="Day rate" error={errors["pricing.dayRate"]} description="Optional. The business-wide “day rates from £500” lives in settings.">
                  {(control) => (
                    <NumberInput {...control} prefix="£" min={0} step={10} value={form.pricing.dayRate} onValueChange={(dayRate) => pricing({ dayRate })} placeholder="Not set" />
                  )}
                </Field>
              </FieldRow>
              <Field label="Airport pricing note" description="e.g. how airport transfers in this vehicle are priced. Optional.">
                {(control) => (
                  <TextInput {...control} value={form.pricing.airportNote} onChange={(event) => pricing({ airportNote: event.target.value })} />
                )}
              </Field>
              <Field label="Additional pricing information" description="Internal notes on pricing. Optional.">
                {(control) => (
                  <TextArea {...control} rows={3} value={form.pricing.notes} onChange={(event) => pricing({ notes: event.target.value })} />
                )}
              </Field>
            </FormSection>

            <FormSection
              id="images"
              index="06"
              title="Images"
              description="Only the client’s own photographs of this vehicle. Without a main image the website shows a typographic plate — “Photography to follow” — rather than a stock photograph."
            >
              <ImageField
                label="Main image"
                value={form.images.main}
                onChange={(main) => update({ images: { ...form.images, main } })}
                altError={errors["images.main"]}
              />
              <ImageListField
                label="Gallery"
                description="Further photographs for the vehicle’s own page, in display order."
                value={form.images.gallery}
                onChange={(gallery) => update({ images: { ...form.images, gallery } })}
              />
              <Notice>
                An image you add here is uploaded straight away and is available to every editor. Uploads sit on the API’s own disk for now; object storage (e.g. Cloudflare R2) connects behind it without changing this screen.
              </Notice>
            </FormSection>

            <FormSection id="seo" index="07" title="Address & SEO" description="How the vehicle is addressed and described to search engines.">
              <Field
                label="Slug"
                required
                error={errors.slug}
                description={
                  <>
                    Web address: <span className="text-white/80">/fleet/{form.slug || "…"}</span>. Vehicle pages are planned (PRD §10.7); today every vehicle is listed on /fleet.
                  </>
                }
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSlugTouched(false);
                      update({ slug: slugify(form.name) });
                    }}
                    className="text-[0.75rem] text-white/60 underline-offset-4 hover:text-white hover:underline"
                  >
                    Generate from name
                  </button>
                }
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
              <Field
                label="SEO title"
                error={errors["seo.title"]}
                counter={{ value: form.seo.title, max: SEO_LIMITS.title }}
                description="Leave blank to use the default shown in the preview."
              >
                {(control) => <TextInput {...control} value={form.seo.title} placeholder={seoTitleDefault} onChange={(event) => seo({ title: event.target.value })} />}
              </Field>
              <Field
                label="SEO description"
                error={errors["seo.description"]}
                counter={{ value: form.seo.description, max: SEO_LIMITS.description }}
              >
                {(control) => (
                  <TextArea
                    {...control}
                    rows={3}
                    value={form.seo.description}
                    placeholder={form.shortDescription}
                    onChange={(event) => seo({ description: event.target.value })}
                  />
                )}
              </Field>
              <SearchPreview
                title={form.seo.title || seoTitleDefault}
                description={form.seo.description || form.shortDescription || "Add a description."}
                path={`/fleet/${form.slug}`}
              />
              <ImageField
                label="Social share image"
                description="Shown when the vehicle’s page is shared on WhatsApp or social media. Blank uses the site’s default share card."
                value={form.seo.shareImage}
                onChange={(shareImage) => seo({ shareImage })}
                aspect="aspect-[1200/630]"
              />
            </FormSection>
          </form>
        }
      />

      <MobileActionBar dirty={dirty}>{primaryActions("bar")}</MobileActionBar>

      <VehiclePreview open={previewing} onClose={() => setPreviewing(false)} vehicle={form} categories={categories} />
    </PageBody>
  );
}
