import type { Metadata } from "next";

import { BookingEditor } from "@/components/admin/bookings/booking-editor";

export const metadata: Metadata = { title: "New booking" };

export default function NewBookingPage() {
  return <BookingEditor />;
}
