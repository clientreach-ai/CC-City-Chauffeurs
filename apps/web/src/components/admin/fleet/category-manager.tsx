"use client";

import { ChevronDown, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button, IconButton } from "@/components/admin/ui/button";
import { Dialog, useConfirm } from "@/components/admin/ui/dialog";
import { Field, TextArea, TextInput } from "@/components/admin/ui/form";
import { Hint } from "@/components/admin/ui/hint";
import { Thumb } from "@/components/admin/ui/image";
import { move, ReorderButtons } from "@/components/admin/ui/list-editors";
import { ErrorState, LoadingRows, Notice, PageBody, PageHeader } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { slugify } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { deniedReason } from "@/lib/cms/permissions";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getVehicles,
  reorderCategories,
  reorderCategoryVehicles,
  setCategoryStatus,
  updateCategory,
} from "@/lib/cms/repositories/fleet";
import type { FleetCategory, FleetCategoryInput, Vehicle } from "@/lib/cms/types";
import { CmsValidationError, type FieldErrors } from "@/lib/cms/validation";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function CategoryManager() {
  const { can } = usePreferences();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useCmsQuery("fleet:categories", async () => {
    const [categories, vehicles] = await Promise.all([getCategories(), getVehicles()]);
    return { categories, vehicles };
  });
  const [editing, setEditing] = useState<FleetCategory | "new" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const categories = data?.categories ?? [];
  const vehicles = data?.vehicles ?? [];
  const canPublish = can("content.publish");
  const canDelete = can("content.delete");

  const reorder = async (from: number, to: number) => {
    try {
      await reorderCategories(move(categories, from, to).map((category) => category.id));
      notify.success("Order saved", "The fleet page follows this order.");
    } catch (err) {
      notify.error("Order not saved", errorMessage(err));
    }
  };

  const toggle = async (category: FleetCategory) => {
    const hiding = category.status === "published";
    if (hiding) {
      const ok = await confirm({
        title: `Hide ${category.title}?`,
        body: "The grouping and its heading come off the fleet page. Its vehicles stay published and still appear in any other grouping they belong to.",
        confirmLabel: "Hide grouping",
      });
      if (!ok) return;
    }
    try {
      await setCategoryStatus(category.id, hiding ? "draft" : "published");
      notify.success(hiding ? `${category.title} hidden` : `${category.title} published`);
    } catch (err) {
      notify.error("Not changed", errorMessage(err));
    }
  };

  const remove = async (category: FleetCategory) => {
    const ok = await confirm({
      title: `Delete ${category.title}?`,
      body: "The grouping is removed permanently. It has no vehicles, so nothing else changes.",
      confirmLabel: "Delete grouping",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteCategory(category.id);
      notify.success(`${category.title} deleted`);
    } catch (err) {
      notify.error("Not deleted", errorMessage(err));
    }
  };

  return (
    <PageBody>
      <PageHeader
        crumbs={[{ label: "Fleet", href: adminRoutes.fleet }, { label: "Groupings" }]}
        title="Fleet groupings"
        description="The groupings on the fleet page, in the order it shows them. Vehicles join a grouping from their own editor; the order of vehicles within a grouping is set here."
        actions={
          <Hint content={deniedReason("content.publish")} disabled={canPublish}>
            <span>
              <Button variant="primary" disabled={!canPublish} onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                New grouping
              </Button>
            </span>
          </Hint>
        }
      />

      <Notice className="mb-8" title="The client’s own groupings">
        Chauffeur Fleet, High-Profile SUVs, Group Transport and Statement / Experience Vehicles are the client’s
        confirmed structure (PRD §10.7). Rename or merge them only on the client’s instruction. A grouping that still
        has vehicles cannot be deleted — move the vehicles first.
      </Notice>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows rows={4} label="Loading groupings" />
      ) : (
        <ol className="border-t border-hairline">
          {categories.map((category, i) => {
            const members = category.vehicleOrder
              .map((vehicleId) => vehicles.find((vehicle) => vehicle.id === vehicleId))
              .filter((vehicle): vehicle is Vehicle => !!vehicle);
            const open = expanded === category.id;
            return (
              <li key={category.id} className="border-b border-hairline py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span className="label-xs w-8 shrink-0 pt-1 text-silver">({NUMERALS[i] ?? i + 1})</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="display-sm text-white">{category.title}</h2>
                      <StatusBadge kind="visibility" value={category.status} />
                    </div>
                    <p className="mt-2 max-w-[60ch] text-[0.875rem] text-white/60">{category.summary || "No summary."}</p>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : category.id)}
                      className="mt-3 inline-flex items-center gap-2 text-[0.8125rem] text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                    >
                      {members.length} {members.length === 1 ? "vehicle" : "vehicles"}
                      <ChevronDown className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")} aria-hidden />
                      <span className="sr-only">{open ? "Hide vehicle order" : "Show vehicle order"}</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    <ReorderButtons index={i} count={categories.length} itemLabel={category.title} onMove={reorder} />
                    <IconButton label={`Edit ${category.title}`} onClick={() => setEditing(category)} disabled={!canPublish}>
                      <Pencil aria-hidden />
                    </IconButton>
                    <IconButton
                      label={category.status === "published" ? `Hide ${category.title}` : `Publish ${category.title}`}
                      onClick={() => void toggle(category)}
                      disabled={!canPublish}
                    >
                      {category.status === "published" ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    </IconButton>
                    <Hint
                      content={members.length ? "Move its vehicles to another grouping first." : deniedReason("content.delete")}
                      disabled={!members.length && canDelete}
                    >
                      <span>
                        <IconButton
                          label={`Delete ${category.title}`}
                          disabled={members.length > 0 || !canDelete}
                          onClick={() => void remove(category)}
                          className="hover:text-alert"
                        >
                          <Trash2 aria-hidden />
                        </IconButton>
                      </span>
                    </Hint>
                  </div>
                </div>

                {open ? (
                  <ol className="mt-4 border-t border-hairline sm:ml-12" aria-label={`Vehicle order in ${category.title}`}>
                    {members.map((vehicle, j) => (
                      <li key={vehicle.id} className="flex items-center gap-3 border-b border-hairline py-2.5">
                        <span className="label-xs w-6 text-white/45 tabular-nums">{String(j + 1).padStart(2, "0")}</span>
                        <Thumb image={vehicle.images.main} className="h-9 w-12" />
                        <GuardedLink href={adminRoutes.vehicle(vehicle.id)} className="min-w-0 flex-1 truncate text-[0.875rem] text-white hover:underline">
                          {vehicle.name}
                        </GuardedLink>
                        <StatusBadge kind="publish" value={vehicle.status} className="hidden sm:inline-flex" />
                        <ReorderButtons
                          index={j}
                          count={members.length}
                          itemLabel={vehicle.name}
                          onMove={async (from, to) => {
                            try {
                              await reorderCategoryVehicles(category.id, move(members, from, to).map((v) => v.id));
                            } catch (err) {
                              notify.error("Order not saved", errorMessage(err));
                            }
                          }}
                        />
                      </li>
                    ))}
                    {!members.length ? <li className="py-3 text-[0.8125rem] text-white/55">No vehicles in this grouping.</li> : null}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <CategoryDialog
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
        }}
      />
    </PageBody>
  );
}

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: FleetCategory | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = category === "new";
  const initial: FleetCategoryInput =
    category && category !== "new"
      ? { title: category.title, slug: category.slug, summary: category.summary, status: category.status }
      : { title: "", slug: "", summary: "", status: "draft" };

  return (
    <Dialog
      open={category !== null}
      onClose={onClose}
      title={isNew ? "New grouping" : "Edit grouping"}
      description={isNew ? "New groupings start hidden. Publish one once it has vehicles." : undefined}
    >
      {category !== null ? (
        <CategoryForm key={isNew ? "new" : category.id} initial={initial} id={isNew ? null : category.id} onCancel={onClose} onSaved={onSaved} />
      ) : null}
    </Dialog>
  );
}

function CategoryForm({
  initial,
  id,
  onCancel,
  onSaved,
}: {
  initial: FleetCategoryInput;
  id: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!id);

  const submit = async () => {
    setSaving(true);
    try {
      if (id) await updateCategory(id, form);
      else await createCategory(form);
      notify.success(id ? "Grouping saved" : "Grouping created", id ? undefined : "Hidden until you publish it.");
      onSaved();
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
      className="flex flex-col gap-5"
    >
      <Field label="Name" required error={errors.title}>
        {(control) => (
          <TextInput
            {...control}
            autoFocus
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value, slug: slugTouched ? form.slug : slugify(event.target.value) })
            }
          />
        )}
      </Field>
      <Field label="Slug" required error={errors.slug} description={`Anchor on the fleet page: /fleet#${form.slug || "…"}`}>
        {(control) => (
          <TextInput
            {...control}
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setForm({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") });
            }}
          />
        )}
      </Field>
      <Field label="Summary" error={errors.summary} counter={{ value: form.summary, max: 160 }} description="One line beside the grouping’s heading.">
        {(control) => <TextArea {...control} rows={2} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving}>
          {id ? "Save grouping" : "Create grouping"}
        </Button>
      </div>
    </form>
  );
}
