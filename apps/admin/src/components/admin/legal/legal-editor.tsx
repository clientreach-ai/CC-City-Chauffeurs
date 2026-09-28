"use client";

import { ExternalLink, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { EditorLayout, focusFirstError, MobileActionBar } from "@/components/admin/editor";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { Button, ButtonLink, IconButton } from "@/components/admin/ui/button";
import { useConfirm } from "@/components/admin/ui/dialog";
import { ErrorSummary, Field, FormSection, TextArea, TextInput } from "@/components/admin/ui/form";
import { move, ReorderButtons, StringListEditor } from "@/components/admin/ui/list-editors";
import { ErrorState, LoadingBlock, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useUnsavedChanges } from "@/components/admin/ui/unsaved";
import {
  CmsValidationError,
  deniedReason,
  formatDateTime,
  hasErrors,
  isLegalDocumentId,
  LEGAL_LIMITS,
  type FieldErrors,
  type LegalDocument,
  type LegalDocumentContent,
  type LegalDocumentId,
} from "@CC-City-Chauffeurs/core";
import { SITE_URL } from "@/lib/api/client";
import { getLegalDocument, resetLegalDocument, updateLegalDocument, validateLegalDocument } from "@/lib/api/legal";
import { errorMessage, useCmsQuery } from "@/lib/query";

/**
 * Edits the privacy notice or the terms of service.
 *
 * A section's text is typed as one box — a blank line starts a new paragraph,
 * which is how anyone writes — and split into paragraphs only when saved.
 * Bullet points are a list of their own. Saving publishes: the website
 * refreshes the page as soon as the API accepts it.
 */

type SectionDraft = { key: string; heading: string; text: string; points: string[] };
type Draft = { title: string; summary: string; sections: SectionDraft[] };

let counter = 0;
const newKey = () => `section-${Date.now().toString(36)}-${(counter += 1)}`;

function toDraft(document: LegalDocument): Draft {
  return {
    title: document.title,
    summary: document.summary,
    sections: document.sections.map((section) => ({
      key: newKey(),
      heading: section.heading,
      text: section.paragraphs.join("\n\n"),
      points: section.points,
    })),
  };
}

function toContent(draft: Draft): LegalDocumentContent {
  return {
    title: draft.title,
    summary: draft.summary,
    sections: draft.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
      points: section.points,
    })),
  };
}

/** The part of a draft that decides whether there is anything to save. */
const snapshot = (draft: Draft) => JSON.stringify(toContent(draft));

const WEBSITE_PATH: Record<LegalDocumentId, string> = { privacy: "/privacy", terms: "/terms" };

export function LegalEditor({ id }: { id: string }) {
  if (!isLegalDocumentId(id)) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Legal pages", href: adminRoutes.legal }, { label: "Not found" }]} title="This page does not exist" />
        <Notice>There are two legal pages: the privacy notice and the terms of service.</Notice>
      </PageBody>
    );
  }
  return <Editor id={id} />;
}

function Editor({ id }: { id: LegalDocumentId }) {
  const { data, loading, error, reload } = useCmsQuery(`legal:${id}`, () => getLegalDocument(id));
  const { can } = usePreferences();
  const confirm = useConfirm();
  const ref = useRef<HTMLFormElement>(null);

  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Take the stored document once; after that the form owns it until saved.
  if (data && draft === null) {
    const fresh = toDraft(data);
    setDocument(data);
    setDraft(fresh);
    setBaseline(snapshot(fresh));
  }
  const dirty = draft !== null && snapshot(draft) !== baseline;
  useUnsavedChanges(dirty);

  const crumbs = [{ label: "Legal pages", href: adminRoutes.legal }, { label: data?.title ?? "Loading" }];

  if (error) {
    return (
      <PageBody>
        <PageHeader crumbs={crumbs} title="Legal page" />
        <ErrorState error={error} onRetry={reload} />
      </PageBody>
    );
  }
  if (loading || !draft || !document) {
    return (
      <PageBody>
        <PageHeader crumbs={crumbs} title="Loading…" />
        <LoadingBlock label="Loading the legal page" />
      </PageBody>
    );
  }

  const canEdit = can("settings.edit");

  const update = (next: Draft) => {
    setDraft(next);
    if (attempted) setErrors(validateLegalDocument(toContent(next)));
  };
  const setSection = (index: number, patch: Partial<SectionDraft>) =>
    update({ ...draft, sections: draft.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)) });

  const adopt = (saved: LegalDocument) => {
    const fresh = toDraft(saved);
    setDocument(saved);
    setDraft(fresh);
    setBaseline(snapshot(fresh));
    setAttempted(false);
    setErrors({});
  };

  const save = async () => {
    const content = toContent(draft);
    const found = validateLegalDocument(content);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      notify.error("Not saved yet", "Some fields need attention — they are marked below.");
      focusFirstError(ref.current);
      return;
    }
    setSaving(true);
    try {
      adopt(await updateLegalDocument(id, content));
      notify.success("Published", `The ${document.title.toLowerCase()} on the website now shows this version.`);
    } catch (err) {
      if (err instanceof CmsValidationError) setErrors(err.fields);
      else notify.error("Not saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: `Reset the ${document.title.toLowerCase()}?`,
      body: "The saved version is discarded and the website goes back to the wording it started with. Any unsaved changes here are lost too.",
      confirmLabel: "Reset to default",
      cancelLabel: "Keep my version",
      tone: "danger",
    });
    if (!ok) return;
    setResetting(true);
    try {
      adopt(await resetLegalDocument(id));
      notify.success("Reset", "The website shows the default wording again.");
    } catch (err) {
      notify.error("Not reset", errorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  const saveButton = (wide: boolean) => (
    <Button variant="primary" className={wide ? "w-full" : ""} busy={saving} disabled={!dirty || !canEdit} onClick={() => void save()}>
      Save and publish
    </Button>
  );

  return (
    <PageBody className="pb-32 lg:pb-24">
      <PageHeader
        crumbs={crumbs}
        title={document.title}
        description="Linked from the footer of every page on the website. What you save here is published straight away."
        actions={
          <ButtonLink href={`${SITE_URL}${WEBSITE_PATH[id]}`} variant="ghost" size="sm" external>
            <ExternalLink aria-hidden />
            View on website
          </ButtonLink>
        }
      />

      <EditorLayout
        rail={
          <>
            <Panel title="Publish">
              {!canEdit ? <p className="mb-4 text-[0.8125rem] leading-snug text-white/60">{deniedReason("settings.edit")}</p> : null}
              <p className="mb-4 text-[0.8125rem] text-white/60">{dirty ? "You have unsaved changes." : "Everything is saved."}</p>
              <div className="hidden lg:block">{saveButton(true)}</div>
              <p className="mt-4 text-[0.75rem] text-white/55">
                {document.isDefault
                  ? "Showing the default wording — not edited yet."
                  : `Last saved ${formatDateTime(document.updatedAt)}${document.updatedBy ? ` by ${document.updatedBy}` : ""}.`}
              </p>
            </Panel>
            {!document.isDefault && canEdit ? (
              <Panel title="Start again">
                <p className="mb-4 text-[0.8125rem] leading-snug text-white/60">
                  Go back to the wording the site started with.
                </p>
                <Button variant="ghost" size="sm" busy={resetting} onClick={() => void reset()}>
                  <RotateCcw aria-hidden />
                  Reset to default
                </Button>
              </Panel>
            ) : null}
            <Notice tone="warning">
              Legal text is relied on. Have changes checked by a qualified adviser before you publish them.
            </Notice>
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

              <FormSection id="page" index="01" title="Page">
                <Field label="Title" required error={errors.title} counter={{ value: draft.title, max: LEGAL_LIMITS.title }}>
                  {(control) => <TextInput {...control} value={draft.title} onChange={(event) => update({ ...draft, title: event.target.value })} />}
                </Field>
                <Field
                  label="Summary"
                  required
                  error={errors.summary}
                  counter={{ value: draft.summary, max: LEGAL_LIMITS.summary }}
                  description="One or two sentences under the title. Search engines show it as the page's description."
                >
                  {(control) => <TextArea {...control} rows={3} value={draft.summary} onChange={(event) => update({ ...draft, summary: event.target.value })} />}
                </Field>
              </FormSection>

              <FormSection
                id="sections"
                index="02"
                title="Sections"
                description="Each section is a heading on the page. Leave a blank line between paragraphs."
              >
                {errors.sections ? (
                  <p className="text-[0.8125rem] text-alert" data-error-anchor tabIndex={-1}>
                    {errors.sections}
                  </p>
                ) : null}

                <ol className="flex flex-col gap-6">
                  {draft.sections.map((section, i) => {
                    const at = `sections.${i}`;
                    const label = `section ${i + 1}`;
                    return (
                      <li key={section.key} className="border border-hairline p-4 sm:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="label-xs text-white/60">Section {i + 1}</p>
                          <div className="flex items-center gap-1">
                            <ReorderButtons
                              index={i}
                              count={draft.sections.length}
                              itemLabel={label}
                              onMove={(from, to) => update({ ...draft, sections: move(draft.sections, from, to) })}
                            />
                            <IconButton
                              size="sm"
                              label={`Remove ${label}`}
                              onClick={() => update({ ...draft, sections: draft.sections.filter((_, j) => j !== i) })}
                            >
                              <Trash2 aria-hidden />
                            </IconButton>
                          </div>
                        </div>

                        <div className="flex flex-col gap-5">
                          <Field label="Heading" required error={errors[`${at}.heading`]}>
                            {(control) => (
                              <TextInput {...control} value={section.heading} onChange={(event) => setSection(i, { heading: event.target.value })} />
                            )}
                          </Field>
                          <Field
                            label="Text"
                            error={errors[`${at}.paragraphs`] ?? Object.entries(errors).find(([key]) => key.startsWith(`${at}.paragraphs.`))?.[1]}
                            description="A blank line starts a new paragraph."
                          >
                            {(control) => (
                              <TextArea
                                {...control}
                                rows={Math.min(14, Math.max(4, section.text.split("\n").length + 1))}
                                value={section.text}
                                onChange={(event) => setSection(i, { text: event.target.value })}
                              />
                            )}
                          </Field>
                          <StringListEditor
                            legend="Bullet points"
                            description="Optional. Shown as a list after the text."
                            items={section.points}
                            onChange={(points) => setSection(i, { points })}
                            addLabel="Add point"
                            itemLabel="Point"
                            multiline
                            max={LEGAL_LIMITS.itemsPerSection}
                            error={Object.entries(errors).find(([key]) => key.startsWith(`${at}.points.`))?.[1]}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {draft.sections.length < LEGAL_LIMITS.sections ? (
                  <div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="-ml-3"
                      onClick={() => update({ ...draft, sections: [...draft.sections, { key: newKey(), heading: "", text: "", points: [] }] })}
                    >
                      <Plus aria-hidden />
                      Add a section
                    </Button>
                  </div>
                ) : null}
              </FormSection>
            </fieldset>
          </form>
        }
      />

      <MobileActionBar dirty={dirty}>{saveButton(false)}</MobileActionBar>
    </PageBody>
  );
}
