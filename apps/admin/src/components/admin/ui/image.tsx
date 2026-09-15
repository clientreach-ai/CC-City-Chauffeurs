"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, ImageOff, ImagePlus, Images, Trash2, Upload, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { errorMessage, useCmsQuery } from "@/lib/query";
import { deleteMedia, getMedia, toImageRef, uploadMedia } from "@/lib/api/media";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/storage";
import { SITE_URL } from "@/lib/api/client";
import { resolveImageSrc } from "@CC-City-Chauffeurs/core";
import type { ImageRef, MediaAsset } from "@CC-City-Chauffeurs/core";

import { Button, IconButton } from "./button";
import { Dialog } from "./dialog";
import { useDragSort } from "./drag-sort";
import { TextInput } from "./form";
import { move } from "./list-editors";
import { notify } from "./toast";
import { SearchField } from "./toolbar";

// ------------------------------------------------------------------ image

type Source = Pick<ImageRef, "src" | "width" | "height"> & { alt?: string };

/**
 * Thumbnails through the Next image optimiser — the site's photographs are
 * several hundred kilobytes each at source.
 *
 * The database stores the site's own photography as site-relative paths, so
 * that the records survive a redeploy or a change of domain. The website can
 * serve those as they are; the admin is a different origin, so it resolves
 * them against the website here, at the point of rendering. What is stored
 * is never rewritten.
 */
export function AdminImage({
  image,
  alt,
  sizes = "160px",
  className,
}: {
  image: Source;
  alt?: string;
  sizes?: string;
  className?: string;
}) {
  const local = image.src.startsWith("data:") || image.src.startsWith("blob:");
  return (
    <Image
      src={resolveImageSrc(image.src, SITE_URL)}
      alt={alt ?? image.alt ?? ""}
      fill
      sizes={sizes}
      unoptimized={local}
      className={cn("object-cover", className)}
    />
  );
}

export function Thumb({ image, className, alt = "" }: { image: Source | null; className?: string; alt?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden bg-graphite", className)}>
      {image ? (
        <AdminImage image={image} alt={alt} sizes="120px" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-white/30">
          <ImageOff className="size-4" aria-hidden />
          <span className="sr-only">No photograph</span>
        </span>
      )}
    </span>
  );
}

function OriginNote({ src }: { src: string }) {
  // An upload is served from the API; the site's own photography is not.
  const uploaded = src.includes("/uploads/");
  return (
    <span className="text-[0.75rem] text-white/55">
      {uploaded ? "Uploaded" : "Site photography"}
    </span>
  );
}

// ------------------------------------------------------------------ upload

export function useUploader() {
  const [busy, setBusy] = useState(false);
  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return [];
    setBusy(true);
    const done: MediaAsset[] = [];
    for (const file of list) {
      try {
        done.push(await uploadMedia(file));
      } catch (error) {
        notify.error("Image not added", errorMessage(error));
      }
    }
    setBusy(false);
    return done;
  };
  return { upload, busy };
}

function FileButton({
  onFiles,
  multiple,
  busy,
  children,
  variant = "secondary",
}: {
  onFiles: (files: FileList) => void;
  multiple?: boolean;
  busy?: boolean;
  children: ReactNode;
  variant?: "secondary" | "primary" | "ghost";
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button variant={variant} size="sm" busy={busy} onClick={() => ref.current?.click()}>
        {busy ? null : <Upload aria-hidden />}
        {busy ? "Preparing…" : children}
      </Button>
    </>
  );
}

// ------------------------------------------------------------------ library

export function MediaLibraryDialog({
  open,
  onClose,
  onSelect,
  multiple,
  title = "Choose a photograph",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (assets: MediaAsset[]) => void;
  multiple?: boolean;
  title?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width="64rem"
      description={
        <>
          The site&rsquo;s own photography, plus anything you add here. An image you add is
          uploaded straight away and is available to every editor.
        </>
      }
    >
      {open ? <Library onClose={onClose} onSelect={onSelect} multiple={multiple} /> : null}
    </Dialog>
  );
}

function Library({
  onClose,
  onSelect,
  multiple,
}: {
  onClose: () => void;
  onSelect: (assets: MediaAsset[]) => void;
  multiple?: boolean;
}) {
  const { data, loading } = useCmsQuery("media", getMedia);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<"all" | "site" | "local">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const { upload, busy } = useUploader();

  const assets = (data ?? []).filter((asset) => {
    if (origin !== "all" && asset.origin !== origin) return false;
    if (!query) return true;
    const needle = query.toLowerCase();
    return asset.filename.toLowerCase().includes(needle) || asset.alt.toLowerCase().includes(needle);
  });

  const toggle = (id: string) =>
    setPicked((current) =>
      multiple ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id],
    );

  const confirm = () => {
    const chosen = picked
      .map((id) => data?.find((asset) => asset.id === id))
      .filter((asset): asset is MediaAsset => !!asset);
    onSelect(chosen);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField label="Search photographs" value={query} onChange={setQuery} className="sm:w-64" />
        <div role="group" aria-label="Source" className="flex border border-white/15">
          {(
            [
              ["all", "All"],
              ["site", "Site photography"],
              ["local", "Added here"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={origin === value}
              onClick={() => setOrigin(value)}
              className={cn(
                "h-9 px-3 text-[0.75rem] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
                origin === value ? "bg-white text-ink" : "text-white/70 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <FileButton
            multiple
            busy={busy}
            onFiles={async (files) => {
              const added = await upload(files);
              if (added.length) {
                setOrigin("all");
                setPicked((current) => (multiple ? [...current, ...added.map((a) => a.id)] : [added[0].id]));
                notify.success(
                  added.length === 1 ? "Image added to the library" : `${added.length} images added to the library`,
                  "Uploaded and available to every editor.",
                );
              }
            }}
          >
            Add images
          </FileButton>
        </div>
      </div>

      {loading ? (
        <div role="status" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          <span className="sr-only">Loading photographs…</span>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="aspect-4/3 animate-pulse bg-white/6" />
          ))}
        </div>
      ) : assets.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6" aria-label="Photographs">
          {assets.map((asset) => {
            const on = picked.includes(asset.id);
            return (
              <li key={asset.id} className="relative">
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${asset.alt || asset.filename}${asset.origin === "local" ? " (local preview)" : ""}`}
                  onClick={() => toggle(asset.id)}
                  onDoubleClick={() => {
                    if (!multiple) {
                      onSelect([asset]);
                      onClose();
                    }
                  }}
                  className={cn(
                    "group relative block aspect-4/3 w-full overflow-hidden bg-obsidian outline-offset-2 focus-visible:outline-2 focus-visible:outline-white",
                    on ? "ring-2 ring-white ring-offset-2 ring-offset-graphite" : "",
                  )}
                >
                  <AdminImage image={asset} alt="" sizes="(max-width: 640px) 33vw, 160px" className="transition-opacity group-hover:opacity-80" />
                  {on ? (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center bg-white text-ink">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                  {asset.origin === "local" ? (
                    <span className="absolute bottom-0 left-0 bg-ink/85 px-1.5 py-0.5 text-[0.625rem] tracking-[0.1em] text-white uppercase">
                      Local
                    </span>
                  ) : null}
                </button>
                {asset.origin === "local" ? (
                  <button
                    type="button"
                    aria-label={`Remove ${asset.filename} from the library`}
                    onClick={async () => {
                      try {
                        await deleteMedia(asset.id);
                        setPicked((current) => current.filter((id) => id !== asset.id));
                      } catch (error) {
                        notify.error("Could not remove the image", errorMessage(error));
                      }
                    }}
                    className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center bg-ink/85 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border border-dashed border-white/15 px-4 py-8 text-center text-[0.875rem] text-white/60">
          No photographs match.
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-graphite px-5 py-4 sm:-mx-6 sm:px-6">
        <p className="text-[0.8125rem] text-white/60" aria-live="polite">
          {picked.length ? `${picked.length} selected` : multiple ? "Select one or more photographs" : "Select a photograph"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!picked.length} onClick={confirm}>
            {multiple && picked.length > 1 ? `Use ${picked.length} photographs` : "Use photograph"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ fields

/**
 * A single image with its alt text: the main vehicle photograph, a service
 * hero, a share card.
 */
export function ImageField({
  label,
  value,
  onChange,
  description,
  error,
  altError,
  required,
  aspect = "aspect-4/3",
}: {
  label: string;
  value: ImageRef | null;
  onChange: (value: ImageRef | null) => void;
  description?: ReactNode;
  error?: string;
  altError?: string;
  required?: boolean;
  aspect?: string;
}) {
  const [open, setOpen] = useState(false);
  const { upload, busy } = useUploader();
  const altId = useId();
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="label-xs text-white/70">
        {label}
        {required ? (
          <>
            <span className="ml-1.5 text-silver" aria-hidden>
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </p>
      {description ? <p className="mt-2 text-[0.8125rem] leading-snug text-white/55">{description}</p> : null}

      {/* The container is the wrapper: an element cannot query its own width. */}
      <div className="@container mt-3">
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-[minmax(0,14rem)_1fr]">
          <div className={cn("relative w-full overflow-hidden border", aspect, error ? "border-alert" : "border-white/12", value ? "bg-obsidian" : "border-dashed bg-transparent")}>
            {value ? (
              <AdminImage image={value} alt={value.alt} sizes="240px" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/45">
                <ImagePlus className="size-5" aria-hidden />
                <span className="text-[0.75rem]">No photograph</span>
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setOpen(true)}>
                <Images aria-hidden />
                {value ? "Replace" : "Choose from library"}
              </Button>
              <FileButton
                busy={busy}
                variant="ghost"
                onFiles={async (files) => {
                  const [asset] = await upload(files);
                  if (asset) onChange(toImageRef(asset, value?.alt ?? ""));
                }}
              >
                Upload
              </FileButton>
              {value ? (
                <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                  <X aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
            {value ? (
              <>
                <OriginNote src={value.src} />
                <div>
                  <label htmlFor={altId} className="label-xs text-white/70">
                    Alt text
                  </label>
                  <TextInput
                    id={altId}
                    className="mt-2"
                    value={value.alt}
                    aria-invalid={altError ? true : undefined}
                    aria-describedby={`${altId}-help`}
                    placeholder="What the photograph shows"
                    onChange={(event) => onChange({ ...value, alt: event.target.value })}
                  />
                  {altError ? <p className="mt-2 text-[0.8125rem] text-alert">{altError}</p> : null}
                  <p id={`${altId}-help`} className="mt-2 text-[0.75rem] leading-snug text-white/55">
                    Read aloud to people who cannot see the image, e.g. “Rolls-Royce Cullinan outside a London hotel at
                    night”.
                  </p>
                </div>
              </>
            ) : null}
            {error ? <p className="text-[0.8125rem] text-alert">{error}</p> : null}
          </div>
        </div>
      </div>

      <MediaLibraryDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={([asset]) => asset && onChange(toImageRef(asset, value?.alt || asset.alt))}
      />
    </div>
  );
}

/** An ordered set of photographs — vehicle and service galleries. */
export function ImageListField({
  label,
  value,
  onChange,
  description,
  max = 24,
}: {
  label: string;
  value: ImageRef[];
  onChange: (value: ImageRef[]) => void;
  description?: ReactNode;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [replacing, setReplacing] = useState<number | null>(null);
  const keys = value.map((image, i) => `${image.src.slice(-48)}-${i}`);
  const { itemProps } = useDragSort(keys, (order) => onChange(order.map((key) => value[keys.indexOf(key)])));
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId} className="@container">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p id={labelId} className="label-xs text-white/70">
          {label}
        </p>
        <span className="text-[0.75rem] text-white/55">
          {value.length} / {max}
        </span>
      </div>
      {description ? <p className="mt-2 text-[0.8125rem] leading-snug text-white/55">{description}</p> : null}

      {value.length ? (
        <ol className="mt-3 grid grid-cols-1 gap-3 @xs:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-4">
          {value.map((image, i) => (
            <li
              key={keys[i]}
              {...itemProps(keys[i])}
              className="group border border-white/12 bg-obsidian data-[dragging]:opacity-40 data-[drop-target]:border-white"
            >
              <div className="relative aspect-4/3 cursor-grab overflow-hidden active:cursor-grabbing">
                <AdminImage image={image} alt={image.alt} sizes="200px" />
                <span className="absolute top-1.5 left-1.5 bg-ink/85 px-1.5 py-0.5 text-[0.625rem] text-white tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                <TextInput
                  aria-label={`Alt text for photograph ${i + 1}`}
                  value={image.alt}
                  placeholder="Alt text"
                  className="h-8 text-[0.8125rem]"
                  onChange={(event) =>
                    onChange(value.map((item, j) => (j === i ? { ...item, alt: event.target.value } : item)))
                  }
                />
                <div className="flex items-center justify-between">
                  <div className="flex">
                    <IconButton size="sm" label={`Move photograph ${i + 1} earlier`} disabled={i === 0} onClick={() => onChange(move(value, i, i - 1))}>
                      <ArrowLeft aria-hidden />
                    </IconButton>
                    <IconButton
                      size="sm"
                      label={`Move photograph ${i + 1} later`}
                      disabled={i === value.length - 1}
                      onClick={() => onChange(move(value, i, i + 1))}
                    >
                      <ArrowRight aria-hidden />
                    </IconButton>
                  </div>
                  <div className="flex">
                    <IconButton size="sm" label={`Replace photograph ${i + 1}`} onClick={() => setReplacing(i)}>
                      <Images aria-hidden />
                    </IconButton>
                    <IconButton size="sm" label={`Remove photograph ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                      <X aria-hidden />
                    </IconButton>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 border border-dashed border-white/15 px-4 py-6 text-[0.8125rem] text-white/55">
          No gallery photographs yet.
        </p>
      )}

      {value.length < max ? (
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
          <ImagePlus aria-hidden />
          Add photographs
        </Button>
      ) : null}
      {value.length > 1 ? (
        <p className="mt-2 text-[0.75rem] text-white/50">Drag to reorder, or use the arrows.</p>
      ) : null}

      <MediaLibraryDialog
        open={open}
        multiple
        title="Add photographs"
        onClose={() => setOpen(false)}
        onSelect={(assets) => onChange([...value, ...assets.map((asset) => toImageRef(asset))].slice(0, max))}
      />
      <MediaLibraryDialog
        open={replacing !== null}
        title="Replace photograph"
        onClose={() => setReplacing(null)}
        onSelect={([asset]) => {
          if (asset && replacing !== null) {
            onChange(value.map((item, j) => (j === replacing ? toImageRef(asset, item.alt) : item)));
          }
        }}
      />
    </div>
  );
}
