import type { Metadata } from "next";

import { BookingDetail } from "@/components/admin/bookings/booking-detail";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetail key={id} id={id} />;
}
