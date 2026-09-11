"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { gallery, galleryFilters, type GalleryImage } from "@/content/gallery";

/**
 * The gallery. Filtering is by vehicle because that is what people are
 * actually checking — that the car in the photograph is the car they will get.
 * Every frame is the client's own photography.
 */
export function GalleryGrid() {
  const [filter, setFilter] = useState<string>("all");
  const [active, setActive] = useState<number | null>(null);

  const shown = useMemo(
    () => (filter === "all" ? gallery : gallery.filter((i) => i.subject === filter)),
    [filter],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>([["all", gallery.length]]);
    for (const image of gallery) {
      map.set(image.subject, (map.get(image.subject) ?? 0) + 1);
    }
    return map;
  }, []);

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (delta: number) =>
      setActive((current) =>
        current === null ? null : (current + delta + shown.length) % shown.length,
      ),
    [shown.length],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, close, step]);

  const current: GalleryImage | null = active === null ? null : shown[active];

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-y border-hairline py-5">
        {galleryFilters.map((option) => {
          const isActive = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setFilter(option.id);
                setActive(null);
              }}
              aria-pressed={isActive}
              className={`label-xs rounded-[2px] border px-4 py-2.5 transition-colors duration-500 ${
                isActive
                  ? "border-white bg-white text-ink"
                  : "border-hairline text-white/60 hover:border-white/50 hover:text-white"
              }`}
            >
              {option.label}
              <span className={isActive ? "ml-2 text-ink/50" : "ml-2 text-white/30"}>
                {counts.get(option.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Masonry-ish editorial grid: sharp corners, hairline gaps */}
      <div className="mt-10 columns-1 gap-4 sm:columns-2 sm:gap-5 lg:columns-3 lg:gap-6">
        {shown.map((image, i) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setActive(i)}
            className="group mb-4 block w-full cursor-zoom-in overflow-hidden bg-graphite sm:mb-5 lg:mb-6"
            aria-label={`Open ${image.alt}`}
          >
            <span className="relative block">
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-auto w-full transition-transform duration-[1400ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-[1.03]"
              />
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-[linear-gradient(0deg,rgba(6,6,7,0.85)_0%,rgba(6,6,7,0)_100%)] p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              >
                <span className="label-xs text-left text-white">{image.alt}</span>
                <span className="label-xs shrink-0 text-white/50">{image.place}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {current ? (
        <div
          className="fixed inset-0 z-70 flex flex-col bg-obsidian/97"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
        >
          <div className="flex items-center justify-between px-6 py-5 sm:px-10">
            <p className="label-xs text-white/50">
              {active !== null ? active + 1 : 0} / {shown.length}
            </p>
            <button
              type="button"
              onClick={close}
              className="label-xs flex items-center gap-2.5 text-white"
            >
              <span className="relative block h-4 w-4" aria-hidden>
                <span className="absolute top-1/2 left-0 block h-px w-4 rotate-45 bg-current" />
                <span className="absolute top-1/2 left-0 block h-px w-4 -rotate-45 bg-current" />
              </span>
              Close
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 pb-4 sm:px-14">
            <Image
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="90vw"
              className="max-h-[76svh] w-auto max-w-full object-contain"
              priority
            />

            <button
              type="button"
              onClick={() => step(-1)}
              className="label-xs absolute left-2 text-white/60 transition-colors duration-500 hover:text-white sm:left-5"
              aria-label="Previous photograph"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="label-xs absolute right-2 text-white/60 transition-colors duration-500 hover:text-white sm:right-5"
              aria-label="Next photograph"
            >
              →
            </button>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-hairline px-6 py-5 sm:px-10">
            <p className="label-sm text-white">{current.alt}</p>
            <p className="label-xs text-white/40">{current.place}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
