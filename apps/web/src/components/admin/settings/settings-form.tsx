"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";

import { EditorLayout, focusFirstError, MobileActionBar, SectionIndex } from "@/components/admin/editor";
import { usePreferences } from "@/components/admin/shell/preferences";
import { Button, IconButton } from "@/components/admin/ui/button";
import { useConfirm } from "@/components/admin/ui/dialog";
import { ErrorSummary, Field, FieldRow, FormSection, Select, Switch, TextArea, TextInput } from "@/components/admin/ui/form";
import { ImageField } from "@/components/admin/ui/image";
import { StringListEditor } from "@/components/admin/ui/list-editors";
import { ErrorState, LoadingBlock, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatDateTime } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { deniedReason } from "@/lib/cms/permissions";
import { getSettings, resetLocalData, updateSettings, validateSettings } from "@/lib/cms/repositories/content";
import { socialPlatforms } from "@/lib/cms/status";
import type { SiteSettings, SocialPlatform } from "@/lib/cms/types";
import { CmsValidationError, hasErrors, SEO_LIMITS, type FieldErrors } from "@/lib/cms/validation";

const SECTIONS = [
  { id: "business", label: "Business", fields: ["business"] },
  { id: "contact", label: "Contact", fields: ["contact"] },
  { id: "booking", label: "Booking terms", fields: ["booking"] },
  { id: "social", label: "Social links", fields: ["social"] },
  { id: "seo", label: "SEO defaults", fields: ["seo"] },
  { id: "footer", label: "Footer", fields: ["footer"] },
  { id: "data", label: "Local data", fields: [] },
];

export function SettingsForm() {
  const { data, loading, error, reload } = useCmsQuery("settings", getSettings);
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [baseline, setBaseline] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const { can } = usePreferences();
  const confirm = useConfirm();
  const ref = useRef<HTMLFormElement>(null);

  // Take the stored settings once; after that the form owns them until saved.
  if (data && form === null) {
    setForm(data);
    setBaseline(JSON.stringify(data));
  }
  const dirty = form !== null && JSON.stringify(form) !== baseline;
  useUnsavedChanges(dirty);

  if (error) {
    return (
      <PageBody>
        <PageHeader eyebrow="System" title="Settings" />
        <ErrorState error={error} onRetry={reload} />
      </PageBody>
    );
  }
  if (loading || !form) {
    return (
      <PageBody>
        <PageHeader eyebrow="System" title="Settings" />
        <LoadingBlock label="Loading settings" />
      </PageBody>
    );
  }

  const canEdit = can("settings.edit");
  const set = <K extends keyof SiteSettings>(key: K, patch: Partial<SiteSettings[K]>) => {
    const next = { ...form, [key]: { ...(form[key] as object), ...patch } } as SiteSettings;
    setForm(next);
    if (attempted) setErrors(validateSettings(next));
  };

  const save = async () => {
    const found = validateSettings(form);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      notify.error("Not saved yet", "Some fields need attention — they are marked below.");
      focusFirstError(ref.current);
      return;
    }
    setSaving(true);
    try {
      const saved = await updateSettings(form);
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      setAttempted(false);
      notify.success("Settings saved");
    } catch (err) {
      if (err instanceof CmsValidationError) setErrors(err.fields);
      else notify.error("Not saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Reset the local preview data?",
      body: "Every change made in this browser — vehicles, services, gallery, testimonials, homepage, settings and the sample enquiries — is discarded, and the admin starts again from the live website’s content. Nothing on the website changes.",
      confirmLabel: "Reset everything",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await resetLocalData();
      const fresh = await getSettings();
      setForm(fresh);
      setBaseline(JSON.stringify(fresh));
      notify.success("Local data reset", "The admin is back to the live website’s content.");
    } catch (err) {
      notify.error("Not reset", errorMessage(err));
    }
  };

  const saveButton = (wide: boolean) => (
    <Button variant="primary" className={wide ? "w-full" : ""} busy={saving} disabled={!dirty || !canEdit} onClick={() => void save()}>
      Save settings
    </Button>
  );

  return (
    <PageBody className="pb-32 lg:pb-24">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Business details used across the website — contact numbers, SEO defaults and the footer. Change a number here and it changes everywhere it appears."
      />

      <EditorLayout
        rail={
          <>
            <Panel title="Save">
              {!canEdit ? <p className="mb-4 text-[0.8125rem] leading-snug text-white/60">{deniedReason("settings.edit")}</p> : null}
              <p className="mb-4 text-[0.8125rem] text-white/60">{dirty ? "You have unsaved changes." : "Everything is saved."}</p>
              <div className="hidden lg:block">{saveButton(true)}</div>
              <p className="mt-4 text-[0.75rem] text-white/50">Last saved {formatDateTime(form.updatedAt)}</p>
            </Panel>
            <SectionIndex sections={SECTIONS} errors={errors} />
          </>
        }
        main={
          <form
            ref={ref}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={!canEdit} className="flex min-w-0 flex-col">
              {attempted && hasErrors(errors) ? (
                <div className="mb-8">
                  <ErrorSummary errors={errors} />
                </div>
              ) : null}

              <FormSection id="business" index="01" title="Business">
                <FieldRow>
                  <Field label="Trading name" required error={errors["business.companyName"]}>
                    {(control) => <TextInput {...control} value={form.business.companyName} onChange={(event) => set("business", { companyName: event.target.value })} />}
                  </Field>
                  <Field label="Legal name" required error={errors["business.legalName"]}>
                    {(control) => <TextInput {...control} value={form.business.legalName} onChange={(event) => set("business", { legalName: event.target.value })} />}
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="Director">
                    {(control) => <TextInput {...control} value={form.business.director} onChange={(event) => set("business", { director: event.target.value })} />}
                  </Field>
                  <Field label="Tagline">
                    {(control) => <TextInput {...control} value={form.business.tagline} onChange={(event) => set("business", { tagline: event.target.value })} />}
                  </Field>
                </FieldRow>
                <Field label="Positioning line" description="One sentence, used in the footer and search results.">
                  {(control) => <TextInput {...control} value={form.business.positioning} onChange={(event) => set("business", { positioning: event.target.value })} />}
                </Field>
                <Field
                  label="Address"
                  description="Only once the client confirms an address they are happy to publish. Blank shows just “London”."
                >
                  {(control) => <TextArea {...control} rows={2} value={form.business.address} placeholder="Not published" onChange={(event) => set("business", { address: event.target.value })} />}
                </Field>
                <FieldRow>
                  <Field label="Base">
                    {(control) => <TextInput {...control} value={form.business.base} onChange={(event) => set("business", { base: event.target.value })} />}
                  </Field>
                  <Field label="Coverage">
                    {(control) => <TextInput {...control} value={form.business.coverage} onChange={(event) => set("business", { coverage: event.target.value })} />}
                  </Field>
                </FieldRow>
                <StringListEditor
                  legend="Service areas"
                  description="Listed in the footer and in the structured data search engines read."
                  items={form.business.serviceAreas}
                  onChange={(serviceAreas) => set("business", { serviceAreas })}
                  addLabel="Add area"
                  itemLabel="Area"
                  max={12}
                />
              </FormSection>

              <FormSection
                id="contact"
                index="02"
                title="Contact"
                description="The numbers every call, WhatsApp and email button on the website uses."
              >
                <FieldRow>
                  <Field label="Office telephone" required error={errors["contact.phoneDisplay"]} description="As shown, e.g. 020 8443 3332.">
                    {(control) => <TextInput {...control} type="tel" value={form.contact.phoneDisplay} onChange={(event) => set("contact", { phoneDisplay: event.target.value })} />}
                  </Field>
                  <Field label="Telephone, international" required error={errors["contact.phoneE164"]} description="Used for the call link, e.g. +442084433332.">
                    {(control) => <TextInput {...control} value={form.contact.phoneE164} onChange={(event) => set("contact", { phoneE164: event.target.value.replace(/\s/g, "") })} />}
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="WhatsApp, as shown" description="e.g. 07804 429407.">
                    {(control) => <TextInput {...control} type="tel" value={form.contact.whatsappDisplay} onChange={(event) => set("contact", { whatsappDisplay: event.target.value })} />}
                  </Field>
                  <Field label="WhatsApp number" required error={errors["contact.whatsappNumber"]} description="Digits with country code, e.g. 447804429407.">
                    {(control) => (
                      <TextInput {...control} inputMode="numeric" value={form.contact.whatsappNumber} onChange={(event) => set("contact", { whatsappNumber: event.target.value.replace(/[^\d]/g, "") })} />
                    )}
                  </Field>
                </FieldRow>
                <Notice>
                  Which single mobile number the business standardises on is still open with the client (PRD §17 Q2). Every
                  WhatsApp button and the enquiry form’s hand-off use this one number.
                </Notice>
                <Field label="Opening message" description="Pre-filled when someone taps a WhatsApp button.">
                  {(control) => <TextInput {...control} value={form.contact.whatsappIntro} onChange={(event) => set("contact", { whatsappIntro: event.target.value })} />}
                </Field>
                <Field label="Enquiries email" required error={errors["contact.email"]}>
                  {(control) => <TextInput {...control} type="email" value={form.contact.email} onChange={(event) => set("contact", { email: event.target.value })} />}
                </Field>
                <Field
                  label="Enquiry response note"
                  error={errors["contact.responseNote"]}
                  counter={{ value: form.contact.responseNote, max: 160 }}
                  description="Optional line beside the contact details. Never promise a response time the business cannot meet every time — the old site’s “within 1 hour” was removed for that reason."
                >
                  {(control) => <TextInput {...control} value={form.contact.responseNote} placeholder="Not shown" onChange={(event) => set("contact", { responseNote: event.target.value })} />}
                </Field>
              </FormSection>

              <FormSection
                id="booking"
                index="03"
                title="Booking terms"
                description="Short terms shown beside every service’s quote brief. Only terms the client has confirmed — cancellation wording is still open (PRD §17 Q6)."
              >
                <StringListEditor
                  legend="Terms"
                  items={form.booking.terms}
                  onChange={(terms) => set("booking", { terms })}
                  addLabel="Add term"
                  itemLabel="Term"
                  multiline
                  max={6}
                />
              </FormSection>

              <FormSection
                id="social"
                index="04"
                title="Social links"
                description="Only accounts the business actually runs. None are confirmed yet, so the website shows none."
              >
                {form.social.length ? (
                  <ul className="flex flex-col gap-3">
                    {form.social.map((link, i) => (
                      <li key={link.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-start">
                        <Select
                          aria-label={`Platform for link ${i + 1}`}
                          value={link.platform}
                          onChange={(event) =>
                            setForm({ ...form, social: form.social.map((item) => (item.id === link.id ? { ...item, platform: event.target.value as SocialPlatform } : item)) })
                          }
                        >
                          {socialPlatforms.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <div>
                          <TextInput
                            aria-label={`Address for link ${i + 1}`}
                            aria-invalid={errors[`social.${i}.url`] ? true : undefined}
                            placeholder="https://"
                            value={link.url}
                            onChange={(event) =>
                              setForm({ ...form, social: form.social.map((item) => (item.id === link.id ? { ...item, url: event.target.value } : item)) })
                            }
                          />
                          {errors[`social.${i}.url`] ? <p className="mt-1.5 text-[0.8125rem] text-alert">{errors[`social.${i}.url`]}</p> : null}
                        </div>
                        <IconButton label={`Remove link ${i + 1}`} onClick={() => setForm({ ...form, social: form.social.filter((item) => item.id !== link.id) })}>
                          <X aria-hidden />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border border-dashed border-white/15 px-4 py-3 text-[0.8125rem] text-white/55">No social accounts listed.</p>
                )}
                <div>
                  <Button size="sm" variant="ghost" className="-ml-3" onClick={() => setForm({ ...form, social: [...form.social, { id: `social-${Date.now().toString(36)}`, platform: "instagram", url: "" }] })}>
                    <Plus aria-hidden />
                    Add a link
                  </Button>
                </div>
              </FormSection>

              <FormSection id="seo" index="05" title="SEO defaults" description="Used where a page has no title or description of its own, and as the default share card.">
                <Field label="Website address" error={errors["seo.siteUrl"]} description="The domain search engines are told is canonical.">
                  {(control) => <TextInput {...control} value={form.seo.siteUrl} onChange={(event) => set("seo", { siteUrl: event.target.value })} />}
                </Field>
                <Field label="Default title" required error={errors["seo.siteTitle"]} counter={{ value: form.seo.siteTitle, max: SEO_LIMITS.title }}>
                  {(control) => <TextInput {...control} value={form.seo.siteTitle} onChange={(event) => set("seo", { siteTitle: event.target.value })} />}
                </Field>
                <Field
                  label="Default description"
                  required
                  error={errors["seo.defaultDescription"]}
                  counter={{ value: form.seo.defaultDescription, max: SEO_LIMITS.description }}
                >
                  {(control) => <TextArea {...control} rows={3} value={form.seo.defaultDescription} onChange={(event) => set("seo", { defaultDescription: event.target.value })} />}
                </Field>
                <ImageField
                  label="Default share image"
                  description="1200 × 630. Shown when a link to the site is shared on WhatsApp or social media."
                  value={form.seo.shareImage}
                  onChange={(shareImage) => set("seo", { shareImage })}
                  aspect="aspect-[1200/630]"
                />
              </FormSection>

              <FormSection id="footer" index="06" title="Footer">
                <Field label="Footer line">
                  {(control) => <TextInput {...control} value={form.footer.text} onChange={(event) => set("footer", { text: event.target.value })} />}
                </Field>
                <ul className="flex flex-col border-t border-hairline">
                  {(
                    [
                      ["showServiceLinks", "Service links", "The two columns of service and page links."],
                      ["showServiceAreas", "Where we work", "The list of service areas."],
                      ["showContact", "Contact details", "Telephone, WhatsApp and email."],
                    ] as const
                  ).map(([key, label, note]) => (
                    <li key={key} className="flex items-center justify-between gap-4 border-b border-hairline py-3.5">
                      <div>
                        <p className="text-[0.875rem] text-white">{label}</p>
                        <p className="text-[0.75rem] text-white/55">{note}</p>
                      </div>
                      <Switch label={`Show ${label.toLowerCase()} in the footer`} checked={form.footer[key]} onChange={(on) => set("footer", { [key]: on })} disabled={!canEdit} />
                    </li>
                  ))}
                </ul>
              </FormSection>
            </fieldset>

            <FormSection id="data" index="07" title="Local data" description="This preview keeps every change in this browser only.">
              <Notice title="What this preview is">
                There is no sign-in, database or file storage yet. Everything you change here is saved in this browser
                alone — other people see their own copy, and the live website is never affected. When the backend is
                connected, the same screens save to it instead.
              </Notice>
              <div>
                <Button variant="danger" onClick={() => void reset()}>
                  <RotateCcw aria-hidden />
                  Reset local data
                </Button>
              </div>
            </FormSection>
          </form>
        }
      />

      <MobileActionBar dirty={dirty}>{saveButton(false)}</MobileActionBar>
    </PageBody>
  );
}
