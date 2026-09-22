"use client";

import { CloudUpload, Copy, ExternalLink, Library, Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/admin/ui/button";
import { Dialog, useConfirm } from "@/components/admin/ui/dialog";
import { Field, TextInput } from "@/components/admin/ui/form";
import { AdminImage, FileButton, useUploader } from "@/components/admin/ui/image";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { DefinitionList, EmptyState, ErrorState, PageBody, PageHeader, Skeleton } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { ResultCount, SearchField, SegmentedFilter, SelectionBar, Toolbar } from "@/components/admin/ui/toolbar";
import { useLeaveGuard, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { errorMessage, useCmsQuery } from "@/lib/query";
import { deleteMedia, getMedia, getMediaUsage, replaceMedia, updateMedia } from "@/lib/api/media";
import { CmsValidationError, deniedReason, formatBytes, formatDate } from "@CC-City-Chauffeurs/core";
import type { FieldErrors, MediaAsset, MediaUsage } from "@CC-City-Chauffeurs/core";

/**
 * The media library: every photograph on the website, in one place.
 *
 * Uploading here is the same upload the fleet, service and gallery editors
 * offer beside their own fields; this is where the whole collection can be
 * seen, described, replaced and cleared out. The one rule the API holds is
 * shown rather than hidden — a photograph a page still shows cannot be
 * deleted, and each tile says where it is used.
 */

type Filter = "all" | "local" | "site" | "unused";

const USED_REASON = "It is still shown on the website. Replace it, or remove it from those pages first.";

const originLabel = (origin: MediaAsset["origin"]) => (origin === "site" ? "Site photography" : "Uploaded");

const places = (count: number) => `${count} ${count === 1 ? "place" : "places"}`;

const kindLabel: Record<MediaUsage["kind"], string> = {
  vehicle: "Vehicle",
  service: "Service",
  gallery: "Gallery",
  homepage: "Homepage",
  settings: "Settings",
};

/** Where a use of a photograph is edited. */
function usageHref(usage: MediaUsage) {
  switch (usage.kind) {
    case "vehicle":
      return adminRoutes.vehicle(usage.id);
    case "service":
      return adminRoutes.service(usage.id);
    case "gallery":
      return adminRoutes.gallery;
    case "homepage":
      return adminRoutes.content;
    case "settings":
      return adminRoutes.settings;
  }
}

async function copyAddress(asset: MediaAsset) {
  try {
    await navigator.clipboard.writeText(asset.src);
    notify.success("Address copied");
  } catch {
    notify.error("Could not copy the address", "Select it in the photograph's details and copy it from there.");
  }
}

export function MediaLibrary() {
  const { can } = usePreferences();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useCmsQuery("media:library", async () => {
    const [assets, usage] = await Promise.all([getMedia(), getMediaUsage()]);
    return { assets, usage };
  });

  const [show, setShow] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { upload, busy: uploading } = useUploader();
  // dragenter and dragleave fire for every child crossed; only the outermost pair matters.
  const dragDepth = useRef(0);

  const assets = data?.assets ?? [];
  const usage = data?.usage ?? {};
  const usesOf = (id: string) => usage[id] ?? [];
  const canEdit = can("content.edit");
  const canPublish = can("content.publish");
  const canDelete = can("content.delete");

  const counts = {
    all: assets.length,
    local: assets.filter((asset) => asset.origin === "local").length,
    site: assets.filter((asset) => asset.origin === "site").length,
    unused: assets.filter((asset) => !usesOf(asset.id).length).length,
  };

  const needle = query.trim().toLowerCase();
  const visible = assets.filter((asset) => {
    if (show === "unused" ? usesOf(asset.id).length > 0 : show !== "all" && asset.origin !== show) return false;
    return !needle || asset.filename.toLowerCase().includes(needle) || asset.alt.toLowerCase().includes(needle);
  });

  const take = async (files: FileList | File[]) => {
    if (!canEdit) return;
    const added = await upload(files);
    if (added.length) {
      notify.success(
        added.length === 1 ? "Photograph added" : `${added.length} photographs added`,
        "Stored, and available wherever a page takes a photograph.",
      );
    }
  };

  /** Deletes what can be deleted; returns how many went. */
  const remove = async (ids: string[]) => {
    const targets = ids.filter((id) => !usesOf(id).length);
    if (!targets.length) return 0;
    const ok = await confirm({
      title: targets.length === 1 ? "Delete this photograph?" : `Delete ${targets.length} photographs?`,
      body: "It is removed from the library and from storage. This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return 0;
    setBusy(true);
    let done = 0;
    for (const id of targets) {
      try {
        await deleteMedia(id);
        done += 1;
      } catch (err) {
        notify.error("Not deleted", errorMessage(err));
      }
    }
    if (done) notify.success(done === 1 ? "Photograph deleted" : `${done} photographs deleted`);
    setSelected(new Set());
    setBusy(false);
    return done;
  };

  const menu = (asset: MediaAsset): MenuAction[] => {
    const used = usesOf(asset.id).length > 0;
    return [
      { label: "Details", icon: <Pencil />, onSelect: () => setOpen(asset.id) },
      { label: "Copy address", icon: <Copy />, onSelect: () => void copyAddress(asset) },
      { label: "Open the file", icon: <ExternalLink />, onSelect: () => window.open(asset.src, "_blank", "noopener") },
      "separator",
      {
        label: "Delete",
        icon: <Trash2 />,
        tone: "danger",
        onSelect: () => void remove([asset.id]),
        disabled: !canDelete || used,
        reason: !canDelete ? deniedReason("content.delete") : USED_REASON,
      },
    ];
  };

  const deletable = [...selected].filter((id) => !usesOf(id).length);

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    if (canEdit) setDragOver(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (event.dataTransfer.files.length) void take(event.dataTransfer.files);
  };

  const uploadButton = canEdit ? (
    <FileButton multiple size="md" variant="primary" busy={uploading} onFiles={(files) => void take(files)}>
      Upload photographs
    </FileButton>
  ) : null;

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Media"
        description="Every photograph on the website, in one place. Upload here, then choose from the library wherever a page takes a photograph. A photograph a page still shows cannot be deleted — replace it instead, and every page that showed it follows."
        meta={
          data ? (
            <p className="text-[0.8125rem] text-white/60">
              {counts.all} {counts.all === 1 ? "photograph" : "photographs"} · {counts.unused} not in use
            </p>
          ) : null
        }
        actions={uploadButton}
      />

      <SegmentedFilter
        label="Show"
        value={show}
        onChange={setShow}
        options={[
          { value: "all", label: "All", count: counts.all },
          { value: "local", label: "Uploaded", count: counts.local },
          { value: "site", label: "Site photography", count: counts.site },
          { value: "unused", label: "Not in use", count: counts.unused },
        ]}
        className="mb-5"
      />

      <Toolbar>
        <SearchField label="Search photographs" placeholder="Search names and descriptions" value={query} onChange={setQuery} />
        {data ? <ResultCount count={visible.length} total={assets.length} noun={["photograph", "photographs"]} /> : null}
      </Toolbar>

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
        {selected.size > deletable.length ? (
          <p className="text-[0.75rem] text-white/55">
            {selected.size - deletable.length} of these {selected.size - deletable.length === 1 ? "is" : "are"} in use and will be kept.
          </p>
        ) : null}
        <Button size="sm" variant="danger" disabled={!canDelete || busy || !deletable.length} onClick={() => void remove(deletable)}>
          <Trash2 aria-hidden />
          Delete{deletable.length ? ` ${deletable.length}` : ""}
        </Button>
      </SelectionBar>

      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn("relative min-h-64 transition-[outline-color] duration-200", dragOver && "outline-2 outline-offset-8 outline-white/60 outline-dashed")}
      >
        {dragOver ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink/70">
            <p className="flex items-center gap-3 text-[0.875rem] text-white">
              <CloudUpload className="size-5" aria-hidden />
              Drop to upload
            </p>
          </div>
        ) : null}

        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <div role="status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            <span className="sr-only">Loading the library…</span>
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="aspect-4/3" />
            ))}
          </div>
        ) : !assets.length ? (
          <EmptyState
            title="No photographs yet"
            body="Upload the client’s own photographs here, or drop them anywhere on this page."
            icon={<Library />}
            action={uploadButton}
          />
        ) : !visible.length ? (
          <EmptyState title="No photographs match" body="Try another filter or search." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Photographs">
            {visible.map((asset) => {
              const uses = usesOf(asset.id);
              const isSelected = selected.has(asset.id);
              return (
                <li
                  key={asset.id}
                  className={cn("group relative border bg-obsidian transition-colors", isSelected ? "border-white" : "border-white/10")}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(asset.id)}
                    className="relative block aspect-4/3 w-full overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
                    aria-label={`Details: ${asset.filename}`}
                  >
                    <AdminImage
                      image={asset}
                      alt=""
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="transition-opacity duration-300 group-hover:opacity-85"
                    />
                  </button>
                  <label className="absolute top-2 left-2 flex size-7 cursor-pointer items-center justify-center bg-ink/80">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      aria-label={`Select ${asset.filename}`}
                      onChange={(event) => {
                        const next = new Set(selected);
                        if (event.target.checked) next.add(asset.id);
                        else next.delete(asset.id);
                        setSelected(next);
                      }}
                      className="size-4 cursor-pointer accent-white"
                    />
                  </label>
                  <div className="flex items-start gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] text-white" title={asset.filename}>
                        {asset.filename}
                      </p>
                      <p className="mt-0.5 truncate text-[0.75rem] text-white/50">
                        {asset.width} × {asset.height}
                        {asset.bytes != null ? ` · ${formatBytes(asset.bytes)}` : ""}
                        {" · "}
                        {uses.length ? `used in ${places(uses.length)}` : "not in use"}
                      </p>
                    </div>
                    <ActionMenu label={`Actions for ${asset.filename}`} actions={menu(asset)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canEdit && assets.length ? (
        <p className="mt-4 text-[0.75rem] text-white/50">
          Drag photographs anywhere onto the library to upload them. JPEG, PNG, WebP or AVIF, up to 25 MB each.
        </p>
      ) : null}

      <AssetDialog
        asset={open ? (assets.find((asset) => asset.id === open) ?? null) : null}
        usage={open ? usesOf(open) : []}
        onClose={() => setOpen(null)}
        canEdit={canEdit}
        canPublish={canPublish}
        canDelete={canDelete}
        onDelete={async (id) => {
          if (await remove([id])) setOpen(null);
        }}
      />
    </PageBody>
  );
}

// ------------------------------------------------------------------ details

function AssetDialog({
  asset,
  usage,
  onClose,
  canEdit,
  canPublish,
  canDelete,
  onDelete,
}: {
  asset: MediaAsset | null;
  usage: MediaUsage[];
  onClose: () => void;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const guard = useLeaveGuard();
  const close = async () => {
    if (await guard.confirmLeave()) onClose();
  };
  return (
    <Dialog open={asset !== null} onClose={() => void close()} title="Photograph" variant="sheet" width="40rem">
      {asset ? (
        <AssetPanel
          key={asset.id}
          asset={asset}
          usage={usage}
          onClose={onClose}
          onCancel={() => void close()}
          canEdit={canEdit}
          canPublish={canPublish}
          canDelete={canDelete}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

function AssetPanel({
  asset,
  usage,
  onClose,
  onCancel,
  canEdit,
  canPublish,
  canDelete,
  onDelete,
}: {
  asset: MediaAsset;
  usage: MediaUsage[];
  onClose: () => void;
  onCancel: () => void;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const confirm = useConfirm();
  const initial = { alt: asset.alt, filename: asset.filename };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const dirty = form.alt !== initial.alt || form.filename !== initial.filename;
  useUnsavedChanges(dirty);

  const used = usage.length > 0;
  const live = usage.filter((use) => use.published).length;

  const save = async () => {
    setSaving(true);
    try {
      await updateMedia(asset.id, form);
      notify.success("Photograph saved");
      onClose();
    } catch (error) {
      if (error instanceof CmsValidationError) setErrors(error.fields);
      else notify.error("Not saved", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const replace = async (files: FileList) => {
    const [file] = Array.from(files);
    if (!file) return;
    if (used) {
      const ok = await confirm({
        title: "Replace this photograph everywhere?",
        body: (
          <>
            The new file takes its place in {places(usage.length)}
            {live ? `, ${live} of them live on the website` : ""}. Each page keeps the description written for it.
          </>
        ),
        confirmLabel: "Replace",
      });
      if (!ok) return;
    }
    setReplacing(true);
    try {
      const result = await replaceMedia(asset.id, file);
      notify.success(
        "Photograph replaced",
        result.replaced ? `Updated in ${places(result.replaced)}.` : "It was not in use anywhere, so only the file has changed.",
      );
    } catch (error) {
      notify.error("Not replaced", errorMessage(error));
    } finally {
      setReplacing(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-6"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-obsidian">
        <AdminImage image={asset} alt={asset.alt} sizes="640px" className="object-contain" />
      </div>

      <DefinitionList
        items={[
          { label: "Dimensions", value: `${asset.width} × ${asset.height}` },
          { label: "File size", value: asset.bytes != null ? formatBytes(asset.bytes) : "Unknown" },
          { label: "Added", value: formatDate(asset.createdAt) },
          { label: "Source", value: originLabel(asset.origin) },
        ]}
      />

      <Field label="Address" description="Where the file is served from. Select it to copy.">
        {(control) => (
          <div className="flex gap-2">
            <TextInput
              {...control}
              readOnly
              value={asset.src}
              className="font-mono text-[0.75rem]"
              onFocus={(event) => event.currentTarget.select()}
            />
            <IconButton label="Copy address" onClick={() => void copyAddress(asset)}>
              <Copy aria-hidden />
            </IconButton>
          </div>
        )}
      </Field>

      <Field label="Name" required error={errors.filename} description="How it is listed in the library.">
        {(control) => (
          <TextInput
            {...control}
            value={form.filename}
            disabled={!canEdit}
            onChange={(event) => setForm({ ...form, filename: event.target.value })}
          />
        )}
      </Field>
      <Field
        label="Description (alt text)"
        error={errors.alt}
        counter={{ value: form.alt, max: 140 }}
        description="Offered when an editor picks this photograph. Each page keeps a description of its own."
      >
        {(control) => (
          <TextInput
            {...control}
            value={form.alt}
            disabled={!canEdit}
            placeholder="What the photograph shows"
            onChange={(event) => setForm({ ...form, alt: event.target.value })}
          />
        )}
      </Field>

      <section aria-labelledby={`${asset.id}-usage`}>
        <h3 id={`${asset.id}-usage`} className="label-xs text-white/70">
          Where it is used
        </h3>
        {usage.length ? (
          <ul className="mt-3 divide-y divide-hairline border border-hairline">
            {usage.map((use, i) => (
              <li key={`${use.kind}-${use.id}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] text-white">{use.label}</p>
                  <p className="mt-0.5 text-[0.75rem] text-white/50">
                    {kindLabel[use.kind]} · {use.slot}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge kind="visibility" value={use.published ? "published" : "draft"} />
                  <ButtonLink href={usageHref(use)} size="sm" variant="ghost">
                    Open
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[0.8125rem] text-white/55">Not used on any page. It can be deleted.</p>
        )}
      </section>

      <section aria-labelledby={`${asset.id}-replace`}>
        <h3 id={`${asset.id}-replace`} className="label-xs text-white/70">
          Replace the file
        </h3>
        <p className="mt-2 text-[0.8125rem] leading-snug text-white/55">
          A new file takes this photograph’s place everywhere it is used, live pages included. The name and description
          above stay as they are.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {canPublish ? (
            <FileButton busy={replacing} onFiles={(files) => void replace(files)}>
              Choose a replacement
            </FileButton>
          ) : (
            <>
              <Button size="sm" disabled>
                Choose a replacement
              </Button>
              <p className="text-[0.75rem] text-white/50">{deniedReason("content.publish")}</p>
            </>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-graphite px-5 py-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="danger" disabled={!canDelete || used} onClick={() => void onDelete(asset.id)}>
            <Trash2 aria-hidden />
            Delete
          </Button>
          {!canDelete ? (
            <p className="text-[0.75rem] text-white/50">{deniedReason("content.delete")}</p>
          ) : used ? (
            <p className="text-[0.75rem] text-white/50">In use on the website.</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={saving} disabled={!dirty || !canEdit}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
