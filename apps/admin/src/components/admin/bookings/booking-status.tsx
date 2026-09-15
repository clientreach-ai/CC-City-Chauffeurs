"use client";

import { CircleCheck, CircleX, Flag, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";

import { useConfirm } from "@/components/admin/ui/dialog";
import { notify } from "@/components/admin/ui/toast";
import { errorMessage } from "@/lib/query";
import { updateBookingStatus } from "@/lib/api/operations";
import type { Booking, BookingStatus } from "@CC-City-Chauffeurs/core";

/**
 * The booking workflow — deliberately simple, no dispatch:
 *   pending → confirmed → in progress → completed, and cancelled from any
 *   open state.
 */
export const transitions: Record<BookingStatus, { to: BookingStatus; label: string; icon: ReactNode }[]> = {
  pending: [
    { to: "confirmed", label: "Confirm", icon: <CircleCheck /> },
    { to: "cancelled", label: "Cancel booking", icon: <CircleX /> },
  ],
  confirmed: [
    { to: "in-progress", label: "Mark in progress", icon: <PlayCircle /> },
    { to: "cancelled", label: "Cancel booking", icon: <CircleX /> },
  ],
  "in-progress": [{ to: "completed", label: "Mark completed", icon: <Flag /> }],
  completed: [],
  cancelled: [],
};

export function useBookingStatus() {
  const confirm = useConfirm();
  return async (booking: Booking, to: BookingStatus) => {
    if (to === "cancelled") {
      const ok = await confirm({
        title: `Cancel ${booking.reference}?`,
        body: "The booking is marked cancelled and kept on record. Nobody is notified — tell the customer and any chauffeur yourself.",
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
        tone: "danger",
      });
      if (!ok) return false;
    }
    try {
      await updateBookingStatus(booking.id, to);
      notify.success(
        to === "confirmed" ? `${booking.reference} confirmed` : to === "cancelled" ? `${booking.reference} cancelled` : "Status updated",
        to === "confirmed" ? "Recorded here only — the customer has not been sent a confirmation." : undefined,
      );
      return true;
    } catch (error) {
      notify.error("Status not changed", errorMessage(error));
      return false;
    }
  };
}
