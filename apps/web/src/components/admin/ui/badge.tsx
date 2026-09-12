import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import {
  bookingStatuses,
  enquiryStatuses,
  labelFor,
  publishStatuses,
  visibilityStatuses,
} from "@/lib/cms/status";
import type { BookingStatus, EnquiryStatus, PublishStatus, Visibility } from "@/lib/cms/types";

/**
 * Status badges. Monochrome, like the rest of the brand: states are told
 * apart by fill, outline and dash — and always by their word — never by
 * colour alone.
 */

const shape = "inline-flex h-6 shrink-0 items-center gap-1.5 border px-2 font-ui text-[0.625rem] font-medium tracking-[0.14em] whitespace-nowrap uppercase";

const solid = "border-white bg-white text-ink";
const silver = "border-silver bg-silver text-ink";
const outline = "border-white/55 text-white";
const quiet = "border-white/30 text-white/70";
const dashed = "border-dashed border-white/30 text-white/55";

const styles = {
  publish: { published: solid, draft: outline, archived: dashed } satisfies Record<PublishStatus, string>,
  visibility: { published: solid, draft: dashed } satisfies Record<Visibility, string>,
  enquiry: {
    new: solid,
    contacted: outline,
    quoted: quiet,
    won: silver,
    lost: dashed,
  } satisfies Record<EnquiryStatus, string>,
  booking: {
    pending: outline,
    confirmed: solid,
    "in-progress": silver,
    completed: quiet,
    cancelled: dashed,
  } satisfies Record<BookingStatus, string>,
};

type BadgeProps =
  | { kind: "publish"; value: PublishStatus }
  | { kind: "visibility"; value: Visibility }
  | { kind: "enquiry"; value: EnquiryStatus }
  | { kind: "booking"; value: BookingStatus };

export function StatusBadge(props: BadgeProps & { className?: string }) {
  let label: string;
  let style: string;
  switch (props.kind) {
    case "publish":
      label = labelFor(publishStatuses, props.value);
      style = styles.publish[props.value];
      break;
    case "visibility":
      label = labelFor(visibilityStatuses, props.value);
      style = styles.visibility[props.value];
      break;
    case "enquiry":
      label = labelFor(enquiryStatuses, props.value);
      style = styles.enquiry[props.value];
      break;
    case "booking":
      label = labelFor(bookingStatuses, props.value);
      style = styles.booking[props.value];
      break;
  }
  const live =
    (props.kind === "publish" || props.kind === "visibility") && props.value === "published";
  return (
    <span className={cn(shape, style, props.className)}>
      {live ? <span aria-hidden className="size-1.5 bg-ink" /> : null}
      {label}
    </span>
  );
}

/** A neutral label chip — category names, services. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center border border-white/15 px-2 text-[0.75rem] whitespace-nowrap text-white/75", className)}>
      {children}
    </span>
  );
}
