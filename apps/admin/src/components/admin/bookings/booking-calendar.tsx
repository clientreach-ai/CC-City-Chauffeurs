"use client";

import { ChevronLeft, ChevronRight, Rows3 } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { useLookups } from "@/components/admin/lookups";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/admin/ui/button";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatShortDate, todayISO } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import { getBookings, getCustomers } from "@/lib/api/operations";
import type { Booking } from "@CC-City-Chauffeurs/core";

/** "September 2026" — the month on show. */
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

/** The week runs Monday to Sunday, as a British diary does. */
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** How many of a day's jobs a grid cell prints before it offers the rest. */
const shownPerDay = 3;

/** A local date as "YYYY-MM-DD" — the form a booking stores its date in. */
function isoDate(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

/** The first of the month we are in, which is where the calendar opens. */
function thisMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * The cells a month grid prints: the month itself, padded at both ends with
 * the days either side of it so every row is a whole week.
 */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // getDay() counts from Sunday, so it is shifted: the grid opens on the
  // Monday on or before the 1st and runs whole weeks until the month is used.
  const lead = (first.getDay() + 6) % 7;
  return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const date = new Date(month.getFullYear(), month.getMonth(), i + 1 - lead);
    return { date, iso: isoDate(date), inMonth: date.getMonth() === month.getMonth() };
  });
}

/**
 * One booking as it reads inside a day. Cancelled ones are kept and faded
 * rather than hidden: a day that had a job called off is not the same day as
 * one that never had it, and the office is the party that needs to know.
 */
function BookingEntry({ booking, subject, compact = false }: { booking: Booking; subject: string; compact?: boolean }) {
  return (
    <GuardedLink
      href={adminRoutes.booking(booking.id)}
      className={cn(
        "block border-l-2 border-white/15 py-1 pl-2 transition-colors duration-200 hover:border-white/55 hover:bg-white/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
        booking.status === "cancelled" ? "opacity-55" : "",
      )}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {booking.time ? <span className="text-[0.75rem] text-white tabular-nums">{booking.time}</span> : null}
        {/* Inside a grid cell the badge is set a size down and tracked
            tighter, so that "In progress" still fits a seventh of a week. */}
        <StatusBadge kind="booking" value={booking.status} className={compact ? "h-5 px-1.5 text-[0.5625rem] tracking-[0.09em]" : undefined} />
      </span>
      <span className="mt-0.5 block truncate text-[0.75rem] text-white/60">
        {booking.reference} · {subject}
      </span>
      {compact ? null : <span className="mt-0.5 block text-[0.75rem] text-white/50">{booking.pickup}</span>}
    </GuardedLink>
  );
}

/**
 * The bookings month by month.
 *
 * A diary, not a dispatch board: it shows what is already agreed and lets
 * the office read the shape of a day. Below `md` the grid gives way to an
 * agenda, because seven columns on a phone is seven columns of nothing.
 */
export function BookingCalendar() {
  const { vehicleName } = useLookups();
  // Deliberately the list screen's key and the list screen's shape, so
  // moving between the two views reads one cache instead of fetching twice.
  const { data, loading, error, reload } = useCmsQuery("bookings:list", async () => {
    const [bookings, customers] = await Promise.all([getBookings(), getCustomers()]);
    return { bookings, customers };
  });
  const [month, setMonth] = useState(thisMonth);
  const [expanded, setExpanded] = useState<string[]>([]);

  const today = todayISO();
  const bookings = data?.bookings ?? [];
  const customerName = (id: string | null) => data?.customers.find((customer) => customer.id === id)?.name ?? "";

  // Which car is out is what a calendar is read for, so the vehicle leads and
  // the customer stands in only while no vehicle has been assigned.
  const subjectOf = (booking: Booking) =>
    vehicleName(booking.vehicleId) || customerName(booking.customerId) || "Vehicle to be assigned";

  // The API returns bookings in date then time order, so each day's list is
  // already in the order it will be worked.
  const byDate = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const day = byDate.get(booking.date);
    if (day) day.push(booking);
    else byDate.set(booking.date, [booking]);
  }

  const cells = monthGrid(month);
  const prefix = isoDate(month).slice(0, 7);
  const days = [...byDate.entries()].filter(([date]) => date.startsWith(prefix));
  const count = days.reduce((total, [, list]) => total + list.length, 0);
  const onThisMonth = prefix === today.slice(0, 7);

  const step = (by: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + by, 1));
  const toggle = (iso: string) =>
    setExpanded((current) => (current.includes(iso) ? current.filter((date) => date !== iso) : [...current, iso]));

  return (
    <PageBody>
      <PageHeader
        crumbs={[{ label: "Bookings", href: adminRoutes.bookings }, { label: "Calendar" }]}
        title="Booking calendar"
        description="Every agreed journey, month by month. A reading of the diary and nothing more — no car is dispatched from here and nobody is told anything."
        actions={
          <ButtonLink href={adminRoutes.bookings}>
            <Rows3 aria-hidden />
            List view
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hairline py-3">
        <div className="min-w-0">
          <p className="label-sm text-white" aria-live="polite">
            {monthFormat.format(month)}
          </p>
          {data ? (
            <p className="mt-1 text-[0.75rem] text-white/50">
              {count ? `${count} booking${count === 1 ? "" : "s"}` : "Nothing booked this month"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* One press back to the month in hand, however far the reader has wandered. */}
          <Button size="sm" variant="ghost" disabled={onThisMonth} onClick={() => setMonth(thisMonth())}>
            Today
          </Button>
          <IconButton size="sm" label="Previous month" onClick={() => step(-1)}>
            <ChevronLeft aria-hidden />
          </IconButton>
          <IconButton size="sm" label="Next month" onClick={() => step(1)}>
            <ChevronRight aria-hidden />
          </IconButton>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading bookings" />
      ) : (
        <>
          <div className="mt-5 hidden md:block">
            <div aria-hidden className="grid grid-cols-7">
              {weekdays.map((day) => (
                <p key={day} className="label-xs px-2 pb-2 text-white/45">
                  {day}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-l border-hairline">
              {cells.map((cell) => {
                const day = byDate.get(cell.iso) ?? [];
                const open = expanded.includes(cell.iso);
                const shown = open ? day : day.slice(0, shownPerDay);
                return (
                  <div
                    key={cell.iso}
                    aria-current={cell.iso === today ? "date" : undefined}
                    className={cn(
                      "flex min-h-32 min-w-0 flex-col gap-1.5 border-r border-b border-hairline p-2",
                      cell.inMonth ? "" : "bg-white/2.5",
                    )}
                  >
                    <p className="flex items-center justify-between gap-2">
                      <span className="sr-only">{formatShortDate(cell.iso)}</span>
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex size-6 items-center justify-center text-[0.75rem] tabular-nums",
                          cell.iso === today
                            ? "bg-white font-medium text-ink"
                            : cell.inMonth
                              ? "text-white/70"
                              : "text-white/35",
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                      {cell.iso === today ? <span className="label-xs text-white/60">Today</span> : null}
                    </p>
                    {shown.map((booking) => (
                      <BookingEntry key={booking.id} booking={booking} subject={subjectOf(booking)} compact />
                    ))}
                    {day.length > shownPerDay ? (
                      <button
                        type="button"
                        onClick={() => toggle(cell.iso)}
                        className="label-xs mt-auto self-start py-1 text-white/55 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {open ? "Show fewer" : `+${day.length - shownPerDay} more`}
                        <span className="sr-only"> on {formatShortDate(cell.iso)}</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* The phone gets the same month as an agenda: only the days with
              work on them, in order, at a width a place name fits in. */}
          <div className="mt-5 md:hidden">
            {days.length ? (
              <ol className="border-t border-hairline">
                {days.map(([date, list]) => (
                  <li key={date} className="border-b border-hairline py-4">
                    <p className="label-xs flex flex-wrap items-baseline gap-x-2 text-white/70">
                      {date === today ? "Today" : formatShortDate(date)}
                      <span className="text-white/40">
                        {list.length} booking{list.length === 1 ? "" : "s"}
                      </span>
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2.5">
                      {list.map((booking) => (
                        <BookingEntry key={booking.id} booking={booking} subject={subjectOf(booking)} />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title={`Nothing in ${monthFormat.format(month)}`}
                body="No bookings fall in this month. Step back or forward to find the one you are after."
              />
            )}
          </div>
        </>
      )}
    </PageBody>
  );
}
