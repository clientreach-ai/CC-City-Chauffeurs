import type { Metadata } from "next";

import { BookingCalendar } from "@/components/admin/bookings/booking-calendar";

export const metadata: Metadata = { title: "Booking calendar" };

export default function BookingCalendarPage() {
  return <BookingCalendar />;
}
