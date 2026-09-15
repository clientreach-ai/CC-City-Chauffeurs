"use client";

import { Dialog } from "@/components/admin/ui/dialog";
import { SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { VehicleEntry, type VehicleEntryData } from "@CC-City-Chauffeurs/ui/site/vehicle-entry";
import { passengersText, rateLabel, UNCONFIRMED } from "@CC-City-Chauffeurs/core";
import { availabilityOptions, labelFor } from "@CC-City-Chauffeurs/core";
import type { FleetCategory, PublishStatus, VehicleInput } from "@CC-City-Chauffeurs/core";
import { resolveImageSrc } from "@CC-City-Chauffeurs/core";
import { SITE_URL } from "@/lib/api/client";

/** The vehicle as the fleet page's shared component takes it. */
export function toEntryData(vehicle: VehicleInput): VehicleEntryData {
  const main = vehicle.images.main;
  return {
    name: vehicle.name || "Untitled vehicle",
    marque: vehicle.make || "Make not set",
    line: vehicle.shortDescription,
    image: main
      ? { src: resolveImageSrc(main.src, SITE_URL), width: main.width, height: main.height }
      : undefined,
    imageAlt: main?.alt,
    specs: [
      { label: "Passengers", value: passengersText(vehicle) },
      { label: "Luggage", value: vehicle.specs.luggage || UNCONFIRMED },
      { label: "Availability", value: labelFor(availabilityOptions, vehicle.availability) },
      { label: "Indicative rate", value: rateLabel(vehicle) },
    ],
    suited: vehicle.suitedTags,
    enquireHref: `/request-a-quote?vehicle=${encodeURIComponent(vehicle.name)}`,
  };
}

const statusLine: Record<PublishStatus, string> = {
  draft: "Draft — not visible on the website until it is published.",
  published: "Published — this is how it appears on the fleet page.",
  archived: "Archived — not visible on the website.",
};

/**
 * Full-screen preview of a vehicle — saved or not — rendered by the same
 * component as the live fleet page, on the site's own ground and type.
 */
export function VehiclePreview({
  open,
  onClose,
  vehicle,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  vehicle: VehicleInput;
  categories: FleetCategory[];
}) {
  const grouping = categories
    .filter((category) => vehicle.categoryIds.includes(category.id))
    .sort((a, b) => a.position - b.position)[0];
  const numeral = grouping ? ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][grouping.position] : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Preview — ${vehicle.name || "Untitled vehicle"}`}
      variant="fullscreen"
      hideHeader
      bodyClassName="p-0"
      className="bg-ink"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-obsidian/95 px-4 py-3 backdrop-blur-[6px] sm:px-6">
        <div className="min-w-0">
          <p className="label-xs text-silver">Preview · /fleet</p>
          <p className="mt-1 text-[0.8125rem] text-white/65">{statusLine[vehicle.status]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-autofocus
          className="btn-ghost btn-on-dark min-h-10! px-5! py-2.5!"
        >
          Close preview
        </button>
      </div>

      {/* The page itself: inert, so its links cannot navigate away mid-edit. */}
      <div data-site inert className="bg-ink font-ui text-white">
        <div className={`${shell} pt-16 pb-24 lg:pt-24`}>
          {grouping ? (
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10">
              <SectionLabel index={numeral}>{grouping.title}</SectionLabel>
              <p className="label-xs text-white/55">{grouping.summary}</p>
            </div>
          ) : (
            <p className="label-xs pb-10 text-white/55">Not in a grouping yet — it would not appear on the fleet page.</p>
          )}
          <VehicleEntry vehicle={toEntryData(vehicle)} wide />
          <div className="mt-20 border-t border-hairline pt-10">
            <VehicleEntry vehicle={toEntryData(vehicle)} wide={false} />
          </div>
          <p className="label-xs mt-10 text-white/45">
            The fleet page alternates wide and narrow layouts, so both are shown.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
