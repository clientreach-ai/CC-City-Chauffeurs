"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { usePreferences } from "@/components/admin/shell/preferences";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { useConfirm } from "@/components/admin/ui/dialog";
import { useDragSort } from "@/components/admin/ui/drag-sort";
import { AdminImage } from "@/components/admin/ui/image";
import { move } from "@/components/admin/ui/list-editors";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, Notice, PageBody, PageHeader, Skeleton } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { FilterSelect, ResultCount, SearchField, SegmentedFilter, SelectionBar, Toolbar } from "@/components/admin/ui/toolbar";
import { errorMessage, useCmsQuery } from "@/lib/query";
import { deniedReason } from "@CC-City-Chauffeurs/core";
import { getVehicles } from "@/lib/api/fleet";
import { deleteGalleryItems, getGallery, getGalleryRows, reorderGallery, setGalleryStatus } from "@/lib/api/gallery";
import { getServices } from "@/lib/api/services";
import { galleryCategories, labelFor, visibilityStatuses } from "@CC-City-Chauffeurs/core";
import type { GalleryCategory, GalleryItem, Visibility } from "@CC-City-Chauffeurs/core";

import { AddPhotographsDialog, GalleryItemDialog } from "./gallery-dialogs";

export function GalleryManager() {
  const { can } = usePreferences();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useCmsQuery("gallery:manager", async () => {
    const [items, rows, vehicles, services] = await Promise.all([getGallery(), getGalleryRows(), getVehicles(), getServices()]);
    return { items, rows, vehicles, services };
  });

  const [category, setCategory] = useState<GalleryCategory | "all">("all");
  const [row, setRow] = useState<string | "all">("all");
  const [status, setStatus] = useState<Visibility | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const rows = data?.rows ?? [];
  const canPublish = can("content.publish");
  const canDelete = can("content.delete");
  const filtering = category !== "all" || row !== "all" || status !== "all" || query.trim() !== "";

  const visible = items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (row !== "all" && item.row !== row) return false;
    if (status !== "all" && item.status !== status) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [item.image.alt, item.caption, item.location].some((text) => text.toLowerCase().includes(needle));
  });

  const rowLabel = (id: string) => rows.find((entry) => entry.id === id)?.label ?? id;

  const saveOrder = async (ids: string[]) => {
    try {
      await reorderGallery(ids);
    } catch (err) {
      notify.error("Order not saved", errorMessage(err));
    }
  };
  const { itemProps } = useDragSort(
    items.map((item) => item.id),
    (ids) => void saveOrder(ids),
  );

  const setStatusFor = async (ids: string[], next: Visibility) => {
    setBusy(true);
    try {
      const result = await setGalleryStatus(ids, next);
      if (result.skipped) {
        notify.info(
          `${result.updated} published, ${result.skipped} skipped`,
          "Photographs without a description (alt text) stay hidden until one is added.",
        );
      } else {
        notify.success(
          next === "published"
            ? `${result.updated} ${result.updated === 1 ? "photograph" : "photographs"} published`
            : `${result.updated} ${result.updated === 1 ? "photograph" : "photographs"} hidden`,
        );
      }
      setSelected(new Set());
    } catch (err) {
      notify.error("Not changed", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ids: string[]) => {
    const ok = await confirm({
      title: ids.length === 1 ? "Delete this photograph?" : `Delete ${ids.length} photographs?`,
      body: "They are removed from the gallery permanently. To take them off the website but keep them, hide them instead.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteGalleryItems(ids);
      notify.success(ids.length === 1 ? "Photograph deleted" : `${ids.length} photographs deleted`);
      setSelected(new Set());
    } catch (err) {
      notify.error("Not deleted", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const menu = (item: GalleryItem): MenuAction[] => {
    const index = items.indexOf(item);
    return [
      { label: "Edit details", icon: <Pencil />, onSelect: () => setEditing(item) },
      item.status === "published"
        ? { label: "Hide from website", icon: <EyeOff />, onSelect: () => void setStatusFor([item.id], "draft"), disabled: !canPublish, reason: deniedReason("content.publish") }
        : { label: "Publish", icon: <Eye />, onSelect: () => void setStatusFor([item.id], "published"), disabled: !canPublish, reason: deniedReason("content.publish") },
      "separator",
      { label: "Move earlier", icon: <ArrowLeft />, onSelect: () => void saveOrder(move(items, index, index - 1).map((i) => i.id)), disabled: index === 0 },
      { label: "Move later", icon: <ArrowRight />, onSelect: () => void saveOrder(move(items, index, index + 1).map((i) => i.id)), disabled: index === items.length - 1 },
      "separator",
      { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => void remove([item.id]), disabled: !canDelete, reason: deniedReason("content.delete") },
    ];
  };

  const counts = Object.fromEntries(galleryCategories.map((option) => [option.value, items.filter((item) => item.category === option.value).length]));

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Gallery"
        description="The photographs on the gallery page. The website sets them out in one row per vehicle, in the order below. Hidden photographs stay here but not on the website."
        meta={
          data ? (
            <p className="text-[0.8125rem] text-white/60">
              {items.filter((item) => item.status === "published").length} published · {items.filter((item) => item.status === "draft").length} hidden
            </p>
          ) : null
        }
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <ImagePlus aria-hidden />
            Add photographs
          </Button>
        }
      />

      <SegmentedFilter
        label="Category"
        value={category}
        onChange={setCategory}
        options={[
          { value: "all", label: "All", count: items.length },
          ...galleryCategories.map((option) => ({ ...option, count: counts[option.value] })),
        ]}
        className="mb-5"
      />

      <Toolbar>
        <SearchField label="Search photographs" placeholder="Search descriptions and places" value={query} onChange={setQuery} />
        <FilterSelect label="Filter by gallery row" allLabel="All rows" value={row} onChange={setRow} options={rows.map((entry) => ({ value: entry.id, label: entry.label }))} />
        <FilterSelect label="Filter by status" allLabel="Any status" value={status} onChange={setStatus} options={visibilityStatuses} className="sm:w-40" />
        {data ? <ResultCount count={visible.length} total={items.length} noun={["photograph", "photographs"]} /> : null}
      </Toolbar>

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" disabled={!canPublish || busy} onClick={() => void setStatusFor([...selected], "published")}>
          <Eye aria-hidden />
          Publish
        </Button>
        <Button size="sm" disabled={!canPublish || busy} onClick={() => void setStatusFor([...selected], "draft")}>
          <EyeOff aria-hidden />
          Hide
        </Button>
        <Button size="sm" variant="danger" disabled={!canDelete || busy} onClick={() => void remove([...selected])}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      </SelectionBar>

      {category !== "all" && category !== "vehicles" && counts[category] === 0 ? (
        <Notice className="mb-5" title={`No ${labelFor(galleryCategories, category).toLowerCase()} photographs yet`}>
          Every photograph so far comes from the client’s vehicle shoots. Real photographs from their own weddings,
          events and airport work can be added here once the client supplies them — with the permission of anyone
          pictured.
        </Notice>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div role="status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          <span className="sr-only">Loading the gallery…</span>
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-4/3" />
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState
          title="The gallery is empty"
          body="Add the client’s own photographs to start the gallery."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              <ImagePlus aria-hidden />
              Add photographs
            </Button>
          }
        />
      ) : !visible.length ? (
        <EmptyState title="No photographs match" body="Try another category, row or search." />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Photographs, in display order">
            {visible.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <li
                  key={item.id}
                  {...(filtering ? {} : itemProps(item.id))}
                  className={cn(
                    "group relative border bg-obsidian transition-colors data-[dragging]:opacity-40 data-[drop-target]:border-white",
                    isSelected ? "border-white" : "border-white/10",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="relative block aspect-4/3 w-full overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
                    aria-label={`Edit details: ${item.image.alt || "photograph without a description"}`}
                  >
                    <AdminImage
                      image={item.image}
                      alt=""
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className={cn("transition-opacity duration-300", item.status === "draft" ? "opacity-45" : "group-hover:opacity-85")}
                    />
                  </button>
                  <label className="absolute top-2 left-2 flex size-7 cursor-pointer items-center justify-center bg-ink/80">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      aria-label={`Select ${item.image.alt || "photograph"}`}
                      onChange={(event) => {
                        const next = new Set(selected);
                        if (event.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        setSelected(next);
                      }}
                      className="size-4 cursor-pointer accent-white"
                    />
                  </label>
                  {/* Published is the normal state; only the exception is marked. */}
                  {item.status === "draft" ? (
                    <div className="absolute top-2 right-2">
                      <StatusBadge kind="visibility" value={item.status} className="bg-ink/85 text-white/80" />
                    </div>
                  ) : null}
                  <div className="flex items-start gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-[0.8125rem]", item.image.alt ? "text-white" : "text-alert")}>
                        {item.image.alt || "No description yet"}
                      </p>
                      <p className="mt-0.5 truncate text-[0.75rem] text-white/50">
                        {rowLabel(item.row)} · {labelFor(galleryCategories, item.category)}
                      </p>
                    </div>
                    <ActionMenu label={`Actions for ${item.image.alt || "photograph"}`} actions={menu(item)} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[0.75rem] text-white/50">
            {filtering
              ? "Clear the filters to reorder by dragging."
              : "Drag photographs to reorder them, or use “Move earlier / later” in each menu. The website follows this order within each row."}
          </p>
        </>
      )}

      {data ? (
        <>
          <GalleryItemDialog
            item={editing}
            onClose={() => setEditing(null)}
            rows={rows}
            vehicles={data.vehicles}
            services={data.services}
            canPublish={canPublish}
          />
          <AddPhotographsDialog open={adding} onClose={() => setAdding(false)} rows={rows} vehicles={data.vehicles} />
        </>
      ) : null}
    </PageBody>
  );
}
