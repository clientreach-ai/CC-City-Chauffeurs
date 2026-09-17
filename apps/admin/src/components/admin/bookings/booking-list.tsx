"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { DataTable, rowLinkClass, type Column } from "@/components/admin/ui/table";
import { FilterSelect, ResultCount, SearchField, SegmentedFilter, Toolbar } from "@/components/admin/ui/toolbar";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatShortDate, todayISO } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import { getBookings, getCustomers } from "@/lib/api/operations";
import { bookingStatuses } from "@CC-City-Chauffeurs/core";
import type { Booking, BookingStatus } from "@CC-City-Chauffeurs/core";

import { transitions, useBookingStatus } from "./booking-status";

type When = "upcoming" | "past" | "all";

export function BookingList() {
  const router = useRouter();
  const { can } = usePreferences();
  const { serviceLabel, vehicleName } = useLookups();
  const changeStatus = useBookingStatus();
  const { data, loading, error, reload } = useCmsQuery("bookings:list", async () => {
    const [bookings, customers] = await Promise.all([getBookings(), getCustomers()]);
    return { bookings, customers };
  });
  const [when, setWhen] = useState<When>("upcoming");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState("");

  const today = todayISO();
  const bookings = data?.bookings ?? [];
  const customerName = (id: string | null) => data?.customers.find((customer) => customer.id === id)?.name ?? "—";
  const isUpcoming = (booking: Booking) => booking.date >= today && booking.status !== "completed" && booking.status !== "cancelled";

  const filtered = bookings.filter((booking) => {
    if (when === "upcoming" && !isUpcoming(booking)) return false;
    if (when === "past" && isUpcoming(booking)) return false;
    if (status !== "all" && booking.status !== status) return false;
    const needle = query.trim().toLowerCase();
    return (
      !needle ||
      [booking.reference, customerName(booking.customerId), booking.pickup, booking.destination].some((value) => value.toLowerCase().includes(needle))
    );
  });

  const canEdit = can("operations.edit");
  const menu = (booking: Booking): MenuAction[] => [
    { label: "Open", icon: <ExternalLink />, onSelect: () => router.push(adminRoutes.booking(booking.id)) },
    ...(transitions[booking.status].length ? (["separator"] as MenuAction[]) : []),
    ...transitions[booking.status].map(
      (step): MenuAction => ({
        label: step.label,
        icon: step.icon,
        tone: step.to === "cancelled" ? "danger" : "default",
        disabled: !canEdit,
        onSelect: () => void changeStatus(booking, step.to),
      }),
    ),
  ];

  const columns: Column<Booking>[] = [
    {
      id: "date",
      header: "Date",
      sortValue: (booking) => `${booking.date}${booking.time}`,
      cell: (booking) => (
        <span className="text-[0.8125rem] whitespace-nowrap tabular-nums">
          {booking.date === today ? "Today" : formatShortDate(booking.date)}
          <span className="block text-white/55">{booking.time}</span>
        </span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (booking) => customerName(booking.customerId),
      cell: (booking) => (
        <div>
          <GuardedLink href={adminRoutes.booking(booking.id)} className={rowLinkClass}>
            {customerName(booking.customerId)}
          </GuardedLink>
          <p className="mt-0.5 text-[0.75rem] text-white/50">{booking.reference}</p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      cell: (booking) => (
        <span className="text-[0.8125rem] text-white/80">
          {serviceLabel(booking.service)}
          <span className="block text-white/50">{vehicleName(booking.vehicleId) || "Vehicle to be assigned"}</span>
        </span>
      ),
    },
    {
      id: "journey",
      header: "Pick-up → destination",
      minWidth: "lg",
      cell: (booking) => (
        <span className="line-clamp-2 max-w-[30ch] text-[0.8125rem] text-white/65">
          {booking.pickup} → {booking.destination || "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (booking) => bookingStatuses.findIndex((option) => option.value === booking.status),
      cell: (booking) => <StatusBadge kind="booking" value={booking.status} />,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Agreed journeys, from pending to completed. A foundation only — there is no calendar, dispatch or chauffeur assignment yet."
      />

      <SegmentedFilter
        label="When"
        value={when}
        onChange={setWhen}
        className="mt-6 mb-5"
        options={[
          { value: "upcoming", label: "Upcoming", count: bookings.filter(isUpcoming).length },
          { value: "past", label: "Past & closed", count: bookings.filter((b) => !isUpcoming(b)).length },
          { value: "all", label: "All", count: bookings.length },
        ]}
      />

      <Toolbar>
        <SearchField label="Search bookings" placeholder="Reference, customer, place" value={query} onChange={setQuery} />
        <FilterSelect label="Filter by status" allLabel="Any status" value={status} onChange={setStatus} options={bookingStatuses} className="sm:w-44" />
        {data ? <ResultCount count={filtered.length} total={bookings.length} noun={["booking", "bookings"]} /> : null}
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading bookings" />
      ) : !filtered.length ? (
        <EmptyState title="No bookings match" body={when === "upcoming" ? "Nothing coming up with these filters." : "Try another filter or search."} />
      ) : (
        <DataTable
          caption="Bookings"
          rows={filtered}
          columns={columns}
          rowKey={(booking) => booking.id}
          initialSort={{ id: "date", direction: when === "past" ? "desc" : "asc" }}
          rowClassName={(booking) => (booking.status === "cancelled" ? "opacity-60" : "")}
          actions={(booking) => <ActionMenu label={`Actions for ${booking.reference}`} actions={menu(booking)} />}
          renderCard={(booking) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <GuardedLink href={adminRoutes.booking(booking.id)} className={rowLinkClass}>
                    {customerName(booking.customerId)}
                  </GuardedLink>
                  <p className="mt-0.5 text-[0.75rem] text-white/55">
                    {booking.date === today ? "Today" : formatShortDate(booking.date)} · {booking.time}
                  </p>
                </div>
                <StatusBadge kind="booking" value={booking.status} />
              </div>
              <p className="mt-1.5 text-[0.8125rem] text-white/75">
                {serviceLabel(booking.service)} · {vehicleName(booking.vehicleId) || "Vehicle to be assigned"}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-white/55">
                {booking.pickup} → {booking.destination || "—"}
              </p>
            </div>
          )}
        />
      )}
    </PageBody>
  );
}
