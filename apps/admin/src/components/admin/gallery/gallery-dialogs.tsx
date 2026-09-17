"use client";

import { Images, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { CheckboxGrid, Field, FieldRow, Select, Switch, TextInput } from "@/components/admin/ui/form";
import { AdminImage, MediaLibraryDialog, useUploader } from "@/components/admin/ui/image";
import { Notice } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { useLeaveGuard, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { errorMessage } from "@/lib/query";
import { addGalleryImages, updateGalleryItem } from "@/lib/api/gallery";
import { toImageRef } from "@/lib/api/media";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/storage";
import { galleryCategories } from "@CC-City-Chauffeurs/core";
import type { GalleryCategory, GalleryItem, GalleryItemInput, MediaAsset, Service, Vehicle } from "@CC-City-Chauffeurs/core";
import { CmsValidationError, type FieldErrors } from "@CC-City-Chauffeurs/core";

type Row = { id: string; label: string };

// ------------------------------------------------------------------ edit

export function GalleryItemDialog({
  item,
  onClose,
  rows,
  vehicles,
  services,
  canPublish,
}: {
  item: GalleryItem | null;
  onClose: () => void;
  rows: Row[];
  vehicles: Vehicle[];
  services: Service[];
  canPublish: boolean;
}) {
  const guard = useLeaveGuard();
  const close = async () => {
    if (await guard.confirmLeave()) onClose();
  };
  return (
    <Dialog open={item !== null} onClose={() => void close()} title="Photograph details" variant="sheet" width="40rem">
      {item ? (
        <GalleryItemForm key={item.id} item={item} onClose={onClose} onCancel={() => void close()} rows={rows} vehicles={vehicles} services={services} canPublish={canPublish} />
      ) : null}
    </Dialog>
  );
}

function GalleryItemForm({
  item,
  onClose,
  onCancel,
  rows,
  vehicles,
  services,
  canPublish,
}: {
  item: GalleryItem;
  onClose: () => void;
  onCancel: () => void;
  rows: Row[];
  vehicles: Vehicle[];
  services: Service[];
  canPublish: boolean;
}) {
  const { id: _id, createdAt: _c, updatedAt: _u, position: _p, ...initial } = item;
  const [form, setForm] = useState<GalleryItemInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const offFleet = form.vehicleId === null;
  useUnsavedChanges(dirty);

  const save = async () => {
    setSaving(true);
    try {
      await updateGalleryItem(item.id, form);
      notify.success("Photograph saved");
      onClose();
    } catch (error) {
      if (error instanceof CmsValidationError) setErrors(error.fields);
      else notify.error("Not saved", errorMessage(error));
    } finally {
      setSaving(false);
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
        <AdminImage image={form.image} alt={form.image.alt} sizes="640px" className="object-contain" />
      </div>
      <p className="-mt-3 text-[0.75rem] text-white/50">
        {`${form.image.width} × ${form.image.height} · ${form.image.src.includes("/uploads/") ? "uploaded" : "site photography"}`}
      </p>

      <Field
        label="Description (alt text)"
        required
        error={errors["image.alt"]}
        counter={{ value: form.image.alt, max: 140 }}
        description="What the photograph shows. Read aloud to people who cannot see it, and shown as its caption on the gallery."
      >
        {(control) => (
          <TextInput {...control} value={form.image.alt} onChange={(event) => setForm({ ...form, image: { ...form.image, alt: event.target.value } })} />
        )}
      </Field>
      <FieldRow>
        <Field label="Location" description="e.g. “Canary Wharf, London”.">
          {(control) => <TextInput {...control} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />}
        </Field>
        <Field label="Caption" error={errors.caption} description="Optional extra line.">
          {(control) => <TextInput {...control} value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} />}
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Gallery row" required error={errors.row} description="Which row it sits in on /gallery.">
          {(control) => (
            <Select {...control} value={form.row} onChange={(event) => setForm({ ...form, row: event.target.value })}>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Category">
          {(control) => (
            <Select {...control} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as GalleryCategory })}>
              {galleryCategories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FieldRow>
      <Field
        label="Vehicle pictured"
        description="Link it to a fleet vehicle, or mark it as a car from a shoot that is not on the fleet."
      >
        {(control) => (
          <Select {...control} value={form.vehicleId ?? ""} onChange={(event) => setForm({ ...form, vehicleId: event.target.value || null })}>
            <option value="">Not on the fleet (shoot only)</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {offFleet ? (
        <Notice>
          Cars that are not on the fleet (the Ferrari SF90 and Rolls-Royce Wraith, for example) can appear in the gallery,
          but never as representative imagery for a bookable vehicle.
        </Notice>
      ) : null}
      <CheckboxGrid
        legend="Related services"
        description="Optional. Lets a service page draw on this photograph later."
        options={services.map((service) => ({ value: service.id, label: service.name }))}
        value={form.serviceIds}
        onChange={(serviceIds) => setForm({ ...form, serviceIds })}
      />
      <div className="flex items-center justify-between gap-4 border-t border-hairline pt-5">
        <div>
          <p className="text-[0.875rem] text-white" id="gallery-visibility-label">
            Show on the website
          </p>
          <p className="mt-0.5 text-[0.75rem] text-white/55">
            {canPublish ? "Needs a description first." : "Editors cannot publish — a manager or admin does."}
          </p>
        </div>
        <Switch
          label="Show on the website"
          checked={form.status === "published"}
          disabled={!canPublish}
          onChange={(on) => setForm({ ...form, status: on ? "published" : "draft" })}
        />
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-hairline bg-graphite px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ add

export function AddPhotographsDialog({
  open,
  onClose,
  rows,
  vehicles,
}: {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  vehicles: Vehicle[];
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add photographs"
      width="44rem"
      description="New photographs arrive hidden, so nothing reaches the website until it has a description and someone publishes it."
    >
      {open ? <AddForm onClose={onClose} rows={rows} vehicles={vehicles} /> : null}
    </Dialog>
  );
}

function AddForm({ onClose, rows, vehicles }: { onClose: () => void; rows: Row[]; vehicles: Vehicle[] }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [library, setLibrary] = useState(false);
  const [defaults, setDefaults] = useState<Pick<GalleryItemInput, "row" | "category" | "vehicleId">>({
    row: rows[0]?.id ?? "",
    category: "vehicles",
    vehicleId: null,
  });
  const [saving, setSaving] = useState(false);
  const { upload, busy } = useUploader();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const take = async (files: FileList | File[]) => {
    const added = await upload(files);
    if (added.length) setAssets((current) => [...current, ...added]);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const items = await addGalleryImages(
        assets.map((asset) => toImageRef(asset)),
        defaults,
      );
      notify.success(
        `${items.length} ${items.length === 1 ? "photograph" : "photographs"} added as hidden`,
        "Describe each one, then publish it.",
      );
      onClose();
    } catch (error) {
      notify.error("Not added", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length) void take(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-white bg-white/4" : "border-white/20"
        }`}
      >
        <Upload className="size-5 text-white/50" aria-hidden />
        <p className="text-[0.875rem] text-white">Drop the client’s photographs here</p>
        <p className="text-[0.75rem] text-white/55">JPEG, PNG, WebP or AVIF · uploaded as you add them, then added to the gallery as hidden</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              if (event.target.files?.length) void take(event.target.files);
              event.target.value = "";
            }}
          />
          <Button size="sm" busy={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Preparing…" : (
              <>
                <Upload aria-hidden />
                Choose files
              </>
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLibrary(true)}>
            <Images aria-hidden />
            From the library
          </Button>
        </div>
      </div>

      {assets.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Photographs to add">
          {assets.map((asset) => (
            <li key={asset.id} className="relative aspect-4/3 overflow-hidden bg-obsidian">
              <AdminImage image={asset} alt={asset.filename} sizes="120px" />
              <button
                type="button"
                onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))}
                aria-label={`Don’t add ${asset.filename}`}
                className="absolute top-1 right-1 flex size-6 items-center justify-center bg-ink/85 text-[0.75rem] text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="label-xs mb-3 text-white/70">Apply to all</legend>
        <FieldRow columns={3}>
          <Field label="Gallery row">
            {(control) => (
              <Select {...control} value={defaults.row} onChange={(event) => setDefaults({ ...defaults, row: event.target.value })}>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Category">
            {(control) => (
              <Select {...control} value={defaults.category} onChange={(event) => setDefaults({ ...defaults, category: event.target.value as GalleryCategory })}>
                {galleryCategories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Vehicle">
            {(control) => (
              <Select {...control} value={defaults.vehicleId ?? ""} onChange={(event) => setDefaults({ ...defaults, vehicleId: event.target.value || null })}>
                <option value="">Not on the fleet</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FieldRow>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!assets.length} busy={saving} onClick={() => void submit()}>
          Add {assets.length ? `${assets.length} ` : ""}
          {assets.length === 1 ? "photograph" : "photographs"}
        </Button>
      </div>

      <MediaLibraryDialog
        open={library}
        multiple
        title="Choose from the library"
        onClose={() => setLibrary(false)}
        onSelect={(chosen) => setAssets((current) => [...current, ...chosen.filter((a) => !current.some((c) => c.id === a.id))])}
      />
    </div>
  );
}
