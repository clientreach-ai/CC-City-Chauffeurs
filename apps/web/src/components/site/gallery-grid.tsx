"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { gallery, galleryFilters, type GalleryImage } from "@/content/gallery";

/**
 * The gallery, organised as one slide track per vehicle.
 *
 * A single wall of sixty-four photographs tells a visitor nothing about what
 * they are looking at. People arrive here to check one specific thing — that
 * the car in the photograph is the car they will get — so the page is built
 * as a labelled listing: a row per vehicle, each with its own count and its
 * own horizontal track.
 *
 * Implementation notes:
 *   · the track is native scroll-snap, so it swipes on a phone and keeps
 *     working with no JavaScript at all
 *   · arrows page by one visible width and disable at each end, so the
 *     control always reflects what the track can actually do
 *   · captions are always visible; hover does not exist on a phone
 */

type Group = {
  id: string;
  label: string;
  images: readonly GalleryImage[];
};

function GalleryRow({
  group,
  onOpen,
}: {
  group: Group;
  onOpen: (image: GalleryImage, trigger: HTMLElement) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // 2px of slack — sub-pixel widths never quite reach the exact end.
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);

  const page = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section aria-labelledby={`gallery-${group.id}`} className="pt-12 first:pt-0">
      {/* Listing header — what this row is, and how much of it there is */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-t border-hairline pt-5">
        <div className="flex items-baseline gap-4">
          <h2 id={`gallery-${group.id}`} className="display-sm text-white">
            {group.label}
          </h2>
          <span className="label-xs tabular-nums text-white/45">
            {group.images.length}{" "}
            {group.images.length === 1 ? "frame" : "frames"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={atStart}
            aria-label={`Scroll ${group.label} photographs backwards`}
            className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-hairline text-white transition-colors duration-400 hover:border-white hover:bg-white hover:text-ink disabled:pointer-events-none disabled:opacity-25"
          >
            <span aria-hidden>←</span>
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={atEnd}
            aria-label={`Scroll ${group.label} photographs forwards`}
            className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-hairline text-white transition-colors duration-400 hover:border-white hover:bg-white hover:text-ink disabled:pointer-events-none disabled:opacity-25"
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {/* The track */}
      <div
        ref={trackRef}
        onScroll={sync}
        className="-mx-6 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:gap-5 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {group.images.map((image) => (
          <figure
            key={image.src}
            className="w-[78vw] shrink-0 snap-start sm:w-[46%] lg:w-[31%]"
          >
            <button
              type="button"
              onClick={(event) => onOpen(image, event.currentTarget)}
              aria-label={`Enlarge: ${image.alt}`}
              className="relative block w-full cursor-zoom-in overflow-hidden bg-graphite focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="media-zoom relative block aspect-[4/3] w-full">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 78vw, (max-width: 1024px) 46vw, 31vw"
                  // Every row lazy-loads. Eager-loading the first three of each
                  // row fetched ~18 frames before the visitor scrolled at all;
                  // the browser's lazy threshold still brings in the first row
                  // straight away, since it sits just below the hero.
                  loading="lazy"
                  className="object-cover"
                />
              </span>

              <span
                aria-hidden
                className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/25 bg-obsidian/55 text-white backdrop-blur-[2px] transition-colors duration-400 group-hover:border-white"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M6 1H1v5M10 15h5v-5" strokeLinecap="square" />
                  <path d="M1 1l5 5M15 15l-5-5" strokeLinecap="square" />
                </svg>
              </span>
            </button>

            <figcaption className="mt-3 flex items-baseline justify-between gap-4 border-t border-hairline pt-3">
              <span className="label-xs text-white/80">{image.alt}</span>
              <span className="label-xs shrink-0 text-white/45">{image.place}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function GalleryGrid() {
  const [filter, setFilter] = useState<string>("all");
  const [lightbox, setLightbox] = useState<{
    images: readonly GalleryImage[];
    index: number;
  } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /** One group per vehicle, in the order the filters declare. */
  const groups: Group[] = useMemo(() => {
    return galleryFilters
      .filter((f) => f.id !== "all")
      .map((f) => ({
        id: f.id,
        label: f.label,
        images: gallery.filter((image) => image.subject === f.id),
      }))
      .filter((group) => group.images.length > 0);
  }, []);

  const visible = filter === "all" ? groups : groups.filter((g) => g.id === filter);
  const total = visible.reduce((sum, g) => sum + g.images.length, 0);

  const open = useCallback((image: GalleryImage, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    // The lightbox walks the row the photograph came from, which is what
    // "next" means to someone who opened it from a vehicle's track.
    const images = gallery.filter((i) => i.subject === image.subject);
    setLightbox({ images, index: images.findIndex((i) => i.src === image.src) });
  }, []);

  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (delta: number) =>
      setLightbox((current) =>
        current === null
          ? null
          : {
              ...current,
              index:
                (current.index + delta + current.images.length) %
                current.images.length,
            },
      ),
    [],
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      returnFocusRef.current?.focus();
    };
  }, [lightbox, close, step]);

  const current = lightbox ? lightbox.images[lightbox.index] : null;

  return (
    <>
      {/* Filters — a listing of what is here, scrollable on a phone */}
      <div className="border-y border-hairline">
        <div
          role="group"
          aria-label="Filter photographs by vehicle"
          className="-mx-6 flex gap-2 overflow-x-auto px-6 py-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {galleryFilters.map((option) => {
            const isActive = filter === option.id;
            const count =
              option.id === "all"
                ? gallery.length
                : (groups.find((g) => g.id === option.id)?.images.length ?? 0);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={isActive}
                className={`label-xs flex shrink-0 items-center gap-2.5 rounded-[2px] border px-4 py-3 transition-colors duration-400 ${
                  isActive
                    ? "border-white bg-white text-ink"
                    : "border-hairline text-white/70 hover:border-white/40 hover:text-white"
                }`}
              >
                {option.label}
                <span
                  className={`tabular-nums ${isActive ? "text-ink/55" : "text-white/45"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="label-xs mt-6 text-white/55">
        {total} {total === 1 ? "photograph" : "photographs"} across{" "}
        {visible.length} {visible.length === 1 ? "vehicle" : "vehicles"}
        <span className="ml-3 hidden text-white/45 sm:inline">
          Swipe or use the arrows · select any frame to enlarge
        </span>
      </p>

      <div className="mt-10">
        {visible.map((group) => (
          <GalleryRow key={group.id} group={group} onOpen={open} />
        ))}
      </div>

      {/* Lightbox */}
      {current && lightbox ? (
        <div
          className="fixed inset-0 z-70 flex flex-col bg-obsidian/98 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
        >
          <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-10">
            <p className="label-xs tabular-nums text-white/55">
              {lightbox.index + 1} / {lightbox.images.length}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              className="label-xs flex h-11 items-center gap-2.5 px-2 text-white"
            >
              <span className="relative block h-4 w-4" aria-hidden>
                <span className="absolute top-1/2 left-0 block h-px w-4 rotate-45 bg-current" />
                <span className="absolute top-1/2 left-0 block h-px w-4 -rotate-45 bg-current" />
              </span>
              Close
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 py-4 sm:px-20">
            <Image
              key={current.src}
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="92vw"
              className="enter-image max-h-[72svh] w-auto max-w-full object-contain"
              priority
            />

            <button
              type="button"
              onClick={() => step(-1)}
              className="absolute left-1 flex h-12 w-12 items-center justify-center rounded-[3px] border border-hairline bg-obsidian/70 text-white transition-colors duration-400 hover:border-white hover:bg-white hover:text-ink sm:left-5"
              aria-label="Previous photograph"
            >
              <span aria-hidden>←</span>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="absolute right-1 flex h-12 w-12 items-center justify-center rounded-[3px] border border-hairline bg-obsidian/70 text-white transition-colors duration-400 hover:border-white hover:bg-white hover:text-ink sm:right-5"
              aria-label="Next photograph"
            >
              <span aria-hidden>→</span>
            </button>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-hairline px-5 py-4 sm:px-10">
            <p className="label-sm text-white">{current.alt}</p>
            <p className="label-xs text-white/45">
              {current.place}
              <span className="ml-4 hidden sm:inline">
                ← → to browse · Esc to close
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
