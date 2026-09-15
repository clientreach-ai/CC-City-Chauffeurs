"use client";

import { Field, FieldRow, TextArea, TextInput } from "@/components/admin/ui/form";
import { ImageField } from "@/components/admin/ui/image";
import { PairListEditor, StringListEditor } from "@/components/admin/ui/list-editors";
import { OrderedPicker } from "@/components/admin/ui/ordered-picker";
import { Notice } from "@/components/admin/ui/page";
import type { CtaLink, HomepageSection, Service, Vehicle } from "@CC-City-Chauffeurs/core";
import type { FieldErrors } from "@CC-City-Chauffeurs/core";

/**
 * The fields for each homepage band. Words, photographs, links and which
 * services or vehicles are featured — never layout or styling.
 */

function CtaFields({
  legend,
  value,
  onChange,
  errors,
  prefix,
  required,
}: {
  legend: string;
  value: CtaLink;
  onChange: (value: CtaLink) => void;
  errors: FieldErrors;
  prefix: string;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="label-xs mb-3 text-white/60">{legend}</legend>
      <FieldRow>
        <Field label="Button text" required={required} error={errors[`${prefix}.label`]}>
          {(control) => <TextInput {...control} value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} />}
        </Field>
        <Field label="Goes to" error={errors[`${prefix}.href`]} description="/page, #section or https://">
          {(control) => <TextInput {...control} value={value.href} onChange={(event) => onChange({ ...value, href: event.target.value.trim() })} />}
        </Field>
      </FieldRow>
    </fieldset>
  );
}

function LabelFields({
  label,
  note,
  onChange,
}: {
  label: string;
  note: string;
  onChange: (patch: { label?: string; note?: string }) => void;
}) {
  return (
    <FieldRow>
      <Field label="Band label" description="The small numbered label, e.g. “(03) The Fleet”.">
        {(control) => <TextInput {...control} value={label} onChange={(event) => onChange({ label: event.target.value })} />}
      </Field>
      <Field label="Note" description="The short line opposite the label.">
        {(control) => <TextInput {...control} value={note} onChange={(event) => onChange({ note: event.target.value })} />}
      </Field>
    </FieldRow>
  );
}

function nested(errors: FieldErrors, prefix: string) {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith(`${prefix}.`))
      .map(([key, message]) => [key.slice(prefix.length + 1), message]),
  );
}

export function SectionFields({
  section,
  onChange,
  errors,
  services,
  vehicles,
  publishedTestimonials,
}: {
  section: HomepageSection;
  onChange: (section: HomepageSection) => void;
  errors: FieldErrors;
  services: Service[];
  vehicles: Vehicle[];
  publishedTestimonials: number;
}) {
  switch (section.kind) {
    case "hero": {
      const set = (patch: Partial<typeof section>) => onChange({ ...section, ...patch });
      return (
        <>
          <Field label="Eyebrow" description="The line above the headline — today the tagline.">
            {(control) => <TextInput {...control} value={section.eyebrow} onChange={(event) => set({ eyebrow: event.target.value })} />}
          </Field>
          <StringListEditor
            legend="Headline"
            description="Display type, one line per row. Up to four."
            items={section.headingLines}
            onChange={(headingLines) => set({ headingLines })}
            addLabel="Add line"
            itemLabel="Headline line"
            max={4}
            required
            error={errors.headingLines}
          />
          <Field label="Supporting line" error={errors.body} counter={{ value: section.body, max: 220 }}>
            {(control) => <TextArea {...control} rows={3} value={section.body} onChange={(event) => set({ body: event.target.value })} />}
          </Field>
          <ImageField
            label="Photograph"
            required
            description="The vehicle is the hero: choose a photograph where type can sit clear of the car."
            value={section.image}
            onChange={(image) => set({ image })}
            error={errors.image}
            aspect="aspect-[16/9]"
          />
          <CtaFields legend="Main button" value={section.primaryCta} onChange={(primaryCta) => set({ primaryCta })} errors={errors} prefix="primaryCta" required />
          <CtaFields legend="Secondary link" value={section.secondaryCta} onChange={(secondaryCta) => set({ secondaryCta })} errors={errors} prefix="secondaryCta" />
          <Notice>The fact line under the hero (base, airports, telephone) comes from Settings.</Notice>
        </>
      );
    }

    case "statement": {
      const set = (patch: Partial<typeof section>) => onChange({ ...section, ...patch });
      return (
        <>
          <LabelFields label={section.label} note={section.note} onChange={set} />
          <Field label="Statement" required error={errors.heading}>
            {(control) => <TextArea {...control} rows={2} value={section.heading} onChange={(event) => set({ heading: event.target.value })} />}
          </Field>
          <Field label="Paragraph" error={errors.body} counter={{ value: section.body, max: 420 }}>
            {(control) => <TextArea {...control} rows={4} value={section.body} onChange={(event) => set({ body: event.target.value })} />}
          </Field>
          <FieldRow>
            <Field label="Signed by">
              {(control) => <TextInput {...control} value={section.signatureName} onChange={(event) => set({ signatureName: event.target.value })} />}
            </Field>
            <Field label="Their role">
              {(control) => <TextInput {...control} value={section.signatureRole} onChange={(event) => set({ signatureRole: event.target.value })} />}
            </Field>
          </FieldRow>
          <CtaFields legend="Link" value={section.link} onChange={(link) => set({ link })} errors={errors} prefix="link" />
        </>
      );
    }

    case "services": {
      const set = (patch: Partial<typeof section>) => onChange({ ...section, ...patch });
      return (
        <>
          <LabelFields label={section.label} note={section.note} onChange={set} />
          <Field label="Heading" required error={errors.heading}>
            {(control) => <TextInput {...control} value={section.heading} onChange={(event) => set({ heading: event.target.value })} />}
          </Field>
          <Field label="Paragraph">
            {(control) => <TextArea {...control} rows={3} value={section.body} onChange={(event) => set({ body: event.target.value })} />}
          </Field>
          <OrderedPicker
            legend="Featured services"
            description="Up to six, shown two by two. Every other published service is listed after them as “Also”."
            itemNoun="service"
            options={services.map((service) => ({
              value: service.id,
              label: service.name,
              note: service.status !== "published" ? "not published" : undefined,
            }))}
            value={section.serviceIds}
            onChange={(serviceIds) => set({ serviceIds })}
            max={6}
            error={errors.serviceIds}
          />
          <CtaFields legend="Button" value={section.cta} onChange={(cta) => set({ cta })} errors={errors} prefix="cta" />
        </>
      );
    }

    case "fleet": {
      const set = (patch: Partial<typeof section>) => onChange({ ...section, ...patch });
      const unphotographed = section.vehicleIds.filter((id) => !vehicles.find((vehicle) => vehicle.id === id)?.images.main);
      return (
        <>
          <LabelFields label={section.label} note={section.note} onChange={set} />
          <Field label="Heading" required error={errors.heading}>
            {(control) => <TextInput {...control} value={section.heading} onChange={(event) => set({ heading: event.target.value })} />}
          </Field>
          <Field label="Paragraph">
            {(control) => <TextArea {...control} rows={3} value={section.body} onChange={(event) => set({ body: event.target.value })} />}
          </Field>
          <OrderedPicker
            legend="Featured vehicles"
            description="Up to three, each shown with its main photograph. The moving list of every vehicle name above them is automatic."
            itemNoun="vehicle"
            options={vehicles.map((vehicle) => ({
              value: vehicle.id,
              label: vehicle.name,
              note: !vehicle.images.main ? "no photograph" : vehicle.status !== "published" ? "not published" : undefined,
            }))}
            value={section.vehicleIds}
            onChange={(vehicleIds) => set({ vehicleIds })}
            max={3}
            error={errors.vehicleIds}
          />
          {unphotographed.length ? (
            <Notice tone="warning">
              {unphotographed.length === 1 ? "One featured vehicle has" : `${unphotographed.length} featured vehicles have`} no
              photograph yet. The homepage is a showcase — feature photographed vehicles only.
            </Notice>
          ) : null}
          <CtaFields legend="Button" value={section.cta} onChange={(cta) => set({ cta })} errors={errors} prefix="cta" />
        </>
      );
    }

    case "principles": {
      const set = (patch: Partial<typeof section>) => onChange({ ...section, ...patch });
      return (
        <>
          <Field label="Eyebrow">
            {(control) => <TextInput {...control} value={section.eyebrow} onChange={(event) => set({ eyebrow: event.target.value })} />}
          </Field>
          <Field label="Line over the photograph" required error={errors.quote}>
            {(control) => <TextArea {...control} rows={2} value={section.quote} onChange={(event) => set({ quote: event.target.value })} />}
          </Field>
          <ImageField label="Photograph" value={section.image} onChange={(image) => set({ image })} altError={errors.image} aspect="aspect-[16/9]" />
          <PairListEditor
            legend="Principles"
            description="Professionalism, Comfort and Discretion are the client’s confirmed three (PRD §7.1)."
            items={section.items}
            onChange={(items) => set({ items })}
            make={() => ({ title: "", copy: "" })}
            addLabel="Add principle"
            itemLabel="Principle"
            max={3}
            itemErrors={nested(errors, "items")}
          />
        </>
      );
    }

    case "occasions": {
      const setPanel = (index: number, patch: Partial<(typeof section.panels)[number]>) =>
        onChange({ ...section, panels: section.panels.map((panel, i) => (i === index ? { ...panel, ...patch } : panel)) });
      return (
        <>
          <LabelFields label={section.label} note={section.note} onChange={(patch) => onChange({ ...section, ...patch })} />
          {section.panels.map((panel, i) => {
            const panelErrors = nested(errors, `panels.${i}`);
            return (
              <fieldset key={panel.id} className="flex flex-col gap-6 border-l border-hairline pl-4 sm:pl-6">
                <legend className="label-xs mb-4 text-white/60">Panel {i + 1}</legend>
                <Field label="Eyebrow">
                  {(control) => <TextInput {...control} value={panel.eyebrow} onChange={(event) => setPanel(i, { eyebrow: event.target.value })} />}
                </Field>
                <Field label="Heading" required error={panelErrors.heading}>
                  {(control) => <TextInput {...control} value={panel.heading} onChange={(event) => setPanel(i, { heading: event.target.value })} />}
                </Field>
                <Field label="Paragraph">
                  {(control) => <TextArea {...control} rows={3} value={panel.copy} onChange={(event) => setPanel(i, { copy: event.target.value })} />}
                </Field>
                <ImageField label="Photograph" required value={panel.image} onChange={(image) => setPanel(i, { image })} error={panelErrors.image} />
                <CtaFields legend="Main button" value={panel.primaryCta} onChange={(primaryCta) => setPanel(i, { primaryCta })} errors={panelErrors} prefix="primaryCta" required />
                <CtaFields legend="Secondary link" value={panel.secondaryCta} onChange={(secondaryCta) => setPanel(i, { secondaryCta })} errors={panelErrors} prefix="secondaryCta" />
              </fieldset>
            );
          })}
        </>
      );
    }

    case "testimonials":
      return (
        <>
          <LabelFields label={section.label} note={section.note} onChange={(patch) => onChange({ ...section, ...patch })} />
          <Notice title={publishedTestimonials ? `${publishedTestimonials} published` : "Nothing to show yet"}>
            This band appears on the homepage only when at least one testimonial is published — it is never filled with
            placeholders. Manage the quotes under Testimonials.
          </Notice>
        </>
      );

    case "enquire": {
      const set = (patch: Partial<typeof section>) => onChange({ ...section, ...patch });
      return (
        <>
          <Field label="Band label">
            {(control) => <TextInput {...control} value={section.label} onChange={(event) => set({ label: event.target.value })} />}
          </Field>
          <Field label="Heading" required error={errors.heading}>
            {(control) => <TextArea {...control} rows={2} value={section.heading} onChange={(event) => set({ heading: event.target.value })} />}
          </Field>
          <Field label="Paragraph" error={errors.body} counter={{ value: section.body, max: 320 }}>
            {(control) => <TextArea {...control} rows={3} value={section.body} onChange={(event) => set({ body: event.target.value })} />}
          </Field>
          <Notice>The WhatsApp number, telephone and email beside the form come from Settings.</Notice>
        </>
      );
    }
  }
}
