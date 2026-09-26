"use client";

import { Archive, Eye, EyeOff, Pencil, Plus, Quote, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { usePreferences } from "@/components/admin/shell/preferences";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Dialog, useConfirm } from "@/components/admin/ui/dialog";
import { Checkbox, ChoiceCards, ErrorSummary, Field, FieldRow, Select, TextArea, TextInput } from "@/components/admin/ui/form";
import { move, ReorderButtons } from "@/components/admin/ui/list-editors";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useLeaveGuard, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatDate, todayISO } from "@CC-City-Chauffeurs/core";
import { errorMessage, useCmsQuery } from "@/lib/query";
import { deniedReason } from "@CC-City-Chauffeurs/core";
import { getServices } from "@/lib/api/services";
import {
  createTestimonial,
  deleteTestimonial,
  emptyTestimonial,
  getTestimonials,
  reorderTestimonials,
  setTestimonialStatus,
  updateTestimonial,
  validateTestimonial,
} from "@/lib/api/testimonials";
import { publishStatuses } from "@CC-City-Chauffeurs/core";
import type { PublishStatus, Service, Testimonial, TestimonialInput } from "@CC-City-Chauffeurs/core";
import { CmsValidationError, hasErrors, type FieldErrors } from "@CC-City-Chauffeurs/core";

export function TestimonialManager() {
  const { can } = usePreferences();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useCmsQuery("testimonials:manager", async () => {
    const [testimonials, services] = await Promise.all([getTestimonials(), getServices()]);
    return { testimonials, services };
  });
  const [editing, setEditing] = useState<Testimonial | "new" | null>(null);
  const [filter, setFilter] = useState<PublishStatus | "all">("all");
  const guard = useLeaveGuard();
  // Closing with unsaved text asks first, like leaving the page would.
  const close = async () => {
    if (await guard.confirmLeave()) setEditing(null);
  };

  const testimonials = data?.testimonials ?? [];
  const services = data?.services ?? [];
  const shown = filter === "all" ? testimonials : testimonials.filter((item) => item.status === filter);
  const canPublish = can("content.publish");
  const canDelete = can("content.delete");
  const serviceName = (id: string | null) => services.find((service) => service.id === id)?.name;

  const change = async (item: Testimonial, status: PublishStatus) => {
    try {
      await setTestimonialStatus(item.id, status);
      notify.success(status === "published" ? "Testimonial published" : status === "archived" ? "Testimonial archived" : "Testimonial unpublished");
    } catch (err) {
      notify.error("Not changed", err instanceof CmsValidationError ? Object.values(err.fields)[0] : errorMessage(err));
    }
  };

  const remove = async (item: Testimonial) => {
    const ok = await confirm({
      title: "Delete this testimonial?",
      body: `“${item.quote.slice(0, 90)}${item.quote.length > 90 ? "…" : ""}” — it is removed permanently. Archive it instead to keep a record of what was published.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTestimonial(item.id);
      notify.success("Testimonial deleted");
    } catch (err) {
      notify.error("Not deleted", errorMessage(err));
    }
  };

  const menu = (item: Testimonial): MenuAction[] => [
    { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(item) },
    item.status === "published"
      ? { label: "Unpublish", icon: <EyeOff />, onSelect: () => void change(item, "draft"), disabled: !canPublish, reason: deniedReason("content.publish") }
      : item.status === "archived"
        ? { label: "Restore as draft", icon: <RotateCcw />, onSelect: () => void change(item, "draft") }
        : { label: "Publish", icon: <Eye />, onSelect: () => void change(item, "published"), disabled: !canPublish, reason: deniedReason("content.publish") },
    ...(item.status !== "archived"
      ? [{ label: "Archive", icon: <Archive />, onSelect: () => void change(item, "archived"), disabled: !canPublish, reason: deniedReason("content.publish") } as MenuAction]
      : []),
    "separator",
    { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => void remove(item), disabled: !canDelete, reason: deniedReason("content.delete") },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Testimonials"
        description="A testimonial can only be published with the customer's first name, role and district, and a record that they agreed to it being used. The homepage shows its testimonials band only once at least one is published."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            Add testimonial
          </Button>
        }
      />

      {testimonials.length ? (
        <div role="group" aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
          {[{ value: "all" as const, label: "All" }, ...publishStatuses].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "h-8 border px-3 text-[0.75rem] transition-colors",
                filter === option.value ? "border-white bg-white text-ink" : "border-white/20 text-white/70 hover:text-white",
              )}
            >
              {option.label}{" "}
              <span className="tabular-nums opacity-70">
                {option.value === "all" ? testimonials.length : testimonials.filter((item) => item.status === option.value).length}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={3} label="Loading testimonials" />
      ) : !testimonials.length ? (
        <EmptyState
          icon={<Quote />}
          title="No testimonials yet"
          body={
            <>
              When the client has a real quote — with the customer’s permission — add it here as a draft, check the
              attribution, then publish it. First name, role (“Bride”, “Executive assistant”) and district
              (“Kensington”) are enough; surnames are never published.
            </>
          }
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              Add testimonial
            </Button>
          }
        />
      ) : !shown.length ? (
        <EmptyState title="None with this status" />
      ) : (
        <ol className="border-t border-hairline" aria-label="Testimonials, in display order">
          {shown.map((item) => {
            const index = testimonials.indexOf(item);
            return (
              <li key={item.id} className={cn("flex flex-col gap-4 border-b border-hairline py-6 sm:flex-row", item.status === "archived" ? "opacity-60" : "")}>
                <span className="label-xs w-7 shrink-0 pt-1.5 text-white/45 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <blockquote className="quote-lg max-w-[40ch] text-[1.5rem]! text-white">“{item.quote}”</blockquote>
                  <p className="label-xs mt-4 text-white/70">
                    {[item.firstName || "No name", item.role, item.district].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.75rem] text-white/55">
                    <StatusBadge kind="publish" value={item.status} />
                    {serviceName(item.serviceId) ? <span>{serviceName(item.serviceId)}</span> : null}
                    {item.date ? <span>{formatDate(item.date)}</span> : null}
                    <span className={item.permission ? "text-white/70" : "text-alert"}>
                      {item.permission ? "Permission recorded" : "No permission recorded"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  {filter === "all" ? (
                    <ReorderButtons
                      index={index}
                      count={testimonials.length}
                      itemLabel={`testimonial ${index + 1}`}
                      onMove={async (from, to) => {
                        try {
                          await reorderTestimonials(move(testimonials, from, to).map((t) => t.id));
                        } catch (err) {
                          notify.error("Order not saved", errorMessage(err));
                        }
                      }}
                    />
                  ) : null}
                  <ActionMenu label={`Actions for the testimonial from ${item.firstName || "an unnamed customer"}`} actions={menu(item)} />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => void close()}
        title={editing === "new" ? "Add testimonial" : "Edit testimonial"}
        variant="sheet"
        width="38rem"
      >
        {editing !== null ? (
          <TestimonialForm
            key={editing === "new" ? "new" : editing.id}
            testimonial={editing === "new" ? null : editing}
            services={services}
            canPublish={canPublish}
            onDone={() => setEditing(null)}
            onCancel={() => void close()}
          />
        ) : null}
      </Dialog>
    </PageBody>
  );
}

function TestimonialForm({
  testimonial,
  services,
  canPublish,
  onDone,
  onCancel,
}: {
  testimonial: Testimonial | null;
  services: Service[];
  canPublish: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initial: TestimonialInput = testimonial
    ? (({ id: _i, createdAt: _c, updatedAt: _u, position: _p, ...rest }) => rest)(testimonial)
    : emptyTestimonial();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);

  const update = (patch: Partial<TestimonialInput>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (attempted) setErrors(validateTestimonial(next));
  };

  const submit = async () => {
    const found = validateTestimonial(form);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    try {
      if (testimonial) await updateTestimonial(testimonial.id, form);
      else await createTestimonial(form);
      notify.success(testimonial ? "Testimonial saved" : "Testimonial added", form.status === "published" ? "Published." : "Saved as a draft.");
      onDone();
    } catch (err) {
      if (err instanceof CmsValidationError) setErrors(err.fields);
      else notify.error("Not saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-6"
    >
      {attempted && hasErrors(errors) ? <ErrorSummary errors={errors} /> : null}
      <Field label="Testimonial" required error={errors.quote} counter={{ value: form.quote, max: 600 }} description="The customer’s own words, unedited apart from obvious typing errors.">
        {(control) => <TextArea {...control} rows={5} value={form.quote} onChange={(event) => update({ quote: event.target.value })} />}
      </Field>
      <FieldRow columns={3}>
        <Field label="First name" error={errors.firstName} description="No surname.">
          {(control) => <TextInput {...control} value={form.firstName} onChange={(event) => update({ firstName: event.target.value })} />}
        </Field>
        <Field label="Role" error={errors.role} description="e.g. Bride.">
          {(control) => <TextInput {...control} value={form.role} onChange={(event) => update({ role: event.target.value })} />}
        </Field>
        <Field label="District" error={errors.district} description="e.g. Mayfair.">
          {(control) => <TextInput {...control} value={form.district} onChange={(event) => update({ district: event.target.value })} />}
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Service">
          {(control) => (
            <Select {...control} value={form.serviceId ?? ""} onChange={(event) => update({ serviceId: event.target.value || null })}>
              <option value="">Not specified</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date" description="When the journey took place, or when it was given.">
          {(control) => (
            <TextInput {...control} type="date" max={todayISO()} value={form.date} onChange={(event) => update({ date: event.target.value })} />
          )}
        </Field>
      </FieldRow>
      <div data-error-anchor={errors.permission ? "" : undefined} tabIndex={errors.permission ? -1 : undefined}>
        <Checkbox
          label="The customer has agreed to this being published"
          description="Keep their written agreement (a message or email) on file. Required to publish."
          checked={form.permission}
          onChange={(permission) => update({ permission })}
        />
        {errors.permission ? <p className="mt-2 text-[0.8125rem] text-alert">{errors.permission}</p> : null}
      </div>
      <ChoiceCards
        legend="Status"
        options={publishStatuses.map((option) => ({
          ...option,
          disabled: option.value === "published" && !canPublish,
        }))}
        value={form.status}
        onChange={(status) => update({ status })}
      />
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-hairline bg-graphite px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving} disabled={!dirty && !!testimonial}>
          {form.status === "published" ? "Save and publish" : "Save"}
        </Button>
      </div>
    </form>
  );
}
