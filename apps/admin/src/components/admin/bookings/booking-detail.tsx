"use client";

import { useState } from "react";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Field, TextArea } from "@/components/admin/ui/form";
import { DefinitionList, ErrorState, LoadingBlock, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatDate, formatDateTime } from "@CC-City-Chauffeurs/core";
import { errorMessage, useCmsQuery } from "@/lib/query";
import { getBooking, getBookingClashes, getCustomer, getEnquiry, updateBookingNotes } from "@/lib/api/operations";
import { bookingStatuses } from "@CC-City-Chauffeurs/core";
import { CmsNotFoundError } from "@CC-City-Chauffeurs/core";

import { transitions, useBookingStatus } from "./booking-status";

export function BookingDetail({ id }: { id: string }) {
  const { can } = usePreferences();
  const { serviceLabel, vehicleName, vehicles } = useLookups();
  const changeStatus = useBookingStatus();
  const { data, loading, error, reload } = useCmsQuery(`booking:${id}`, async () => {
    const booking = await getBooking(id);
    // The booking carries only the enquiry's id, so the enquiry itself is
    // what the reference has to come from. A missing one must not take the
    // whole screen down: the booking still reads without it, and the same
    // goes for the day's other jobs — they are context, not the record.
    const [customer, enquiry, clashes] = await Promise.all([
      booking.customerId ? getCustomer(booking.customerId).then((result) => result.customer) : null,
      booking.enquiryId ? getEnquiry(booking.enquiryId).catch(() => null) : null,
      getBookingClashes(id).catch(() => []),
    ]);
    return { booking, customer, enquiry, clashes };
  });
  const [notes, setNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const dirty = notes !== null && notes !== data?.booking.notes;
  useUnsavedChanges(dirty);

  if (error) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Bookings", href: adminRoutes.bookings }, { label: "Not found" }]} title="Booking not found" />
        <ErrorState error={error} onRetry={error instanceof CmsNotFoundError ? undefined : reload} />
      </PageBody>
    );
  }
  if (loading || !data) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Bookings", href: adminRoutes.bookings }, { label: "Loading" }]} title="Loading…" />
        <LoadingBlock label="Loading the booking" />
      </PageBody>
    );
  }

  const { booking, customer, enquiry, clashes } = data;
  const canEdit = can("operations.edit");
  const steps = transitions[booking.status];
  // Nothing to weigh up on a job that is over or called off, so the day's
  // other work is only worth raising while this one is still open.
  const open = booking.status !== "completed" && booking.status !== "cancelled";
  // Named only when the vehicle is still on the fleet; `vehicleName` answers
  // "no longer listed" for a deleted one, which is no way to open a sentence.
  const car = vehicles.find((vehicle) => vehicle.id === booking.vehicleId)?.name;

  const saveNotes = async () => {
    if (notes === null) return;
    setSaving(true);
    try {
      await updateBookingNotes(booking.id, notes);
      setNotes(null);
      notify.success("Notes saved");
    } catch (err) {
      notify.error("Notes not saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBody>
      <PageHeader
        crumbs={[{ label: "Bookings", href: adminRoutes.bookings }, { label: booking.reference }]}
        title={customer?.name ?? booking.reference}
        meta={
          <>
            <StatusBadge kind="booking" value={booking.status} />
            {/* A booking taken over the telephone often has no time yet, and
                "9 Sept 2027 at" with nothing after it reads as a bug. */}
            <span className="text-[0.8125rem] text-white/60">
              {booking.time ? `${formatDate(booking.date)} at ${booking.time}` : formatDate(booking.date)}
            </span>
          </>
        }
      />

      {open && clashes.length ? (
        <Notice
          tone="warning"
          title={clashes.length === 1 ? "This car is down for another job that day" : `This car is down for ${clashes.length} other jobs that day`}
        >
          <p>
            {car ?? "The same car"} is also carrying the journeys below on {formatDate(booking.date)}. That is often an ordinary day — a
            wedding at eleven and an airport run at eight are no trouble at all. A booking here carries a date and a
            time and nothing that says when the car is free again, so this one is yours to judge, not the system’s.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {clashes.map((clash) => (
              <li key={clash.id} className="flex flex-wrap items-baseline gap-x-2">
                {clash.time ? <span className="text-white/60 tabular-nums">{clash.time}</span> : null}
                <GuardedLink href={adminRoutes.booking(clash.id)} className="text-white underline underline-offset-4 decoration-white/40 hover:decoration-white">
                  {clash.reference}
                </GuardedLink>
                <span className="text-white/60">— {clash.pickup}</span>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
          <section aria-labelledby="booking-journey">
            <h2 id="booking-journey" className="label-xs mb-3 text-white/70">
              Journey
            </h2>
            <DefinitionList
              items={[
                { label: "Date", value: formatDate(booking.date) },
                { label: "Time", value: booking.time },
                { label: "Pick-up", value: booking.pickup },
                { label: "Destination", value: booking.destination },
                { label: "Passengers", value: booking.passengers != null ? String(booking.passengers) : "" },
                { label: "Service", value: serviceLabel(booking.service) },
                { label: "Vehicle", value: vehicleName(booking.vehicleId) || "To be assigned" },
                {
                  label: "Came from",
                  value: booking.enquiryId ? (
                    <GuardedLink href={adminRoutes.enquiry(booking.enquiryId)} className="underline-offset-4 hover:underline">
                      {enquiry?.reference ?? "Open the enquiry"}
                    </GuardedLink>
                  ) : booking.origin === "whatsapp" ? (
                    "Requested on WhatsApp"
                  ) : (
                    "Taken by the office"
                  ),
                },
              ]}
            />
          </section>

          <section aria-labelledby="booking-customer">
            <h2 id="booking-customer" className="label-xs mb-3 text-white/70">
              Customer
            </h2>
            {customer ? (
              <DefinitionList
                items={[
                  {
                    label: "Name",
                    value: (
                      <GuardedLink href={adminRoutes.customer(customer.id)} className="underline-offset-4 hover:underline">
                        {customer.name}
                      </GuardedLink>
                    ),
                  },
                  { label: "Phone", value: customer.phone },
                  { label: "Email", value: customer.email },
                ]}
              />
            ) : (
              <p className="text-[0.875rem] text-white/55">No customer record.</p>
            )}
          </section>

          <section aria-labelledby="booking-notes">
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void saveNotes();
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Notes" description="Internal. Timings, luggage, access, anything the day depends on.">
                {(control) => (
                  <TextArea {...control} rows={4} disabled={!canEdit} value={notes ?? booking.notes} onChange={(event) => setNotes(event.target.value)} />
                )}
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={!dirty} busy={saving}>
                  Save notes
                </Button>
                {dirty ? (
                  <Button size="sm" variant="ghost" onClick={() => setNotes(null)}>
                    Discard
                  </Button>
                ) : null}
              </div>
            </form>
          </section>

          <section aria-labelledby="booking-activity">
            <h2 id="booking-activity" className="label-xs mb-3 text-white/70">
              Activity
            </h2>
            <ol className="flex flex-col gap-4 border-l border-hairline pl-5">
              {[...booking.activity].reverse().map((entry) => (
                <li key={entry.id} className="relative">
                  <span aria-hidden className="absolute top-1.5 -left-[23.5px] size-2 border border-white/50 bg-ink" />
                  <p className="text-[0.8125rem] text-white/85">{entry.text}</p>
                  <p className="text-[0.75rem] text-white/50">{formatDateTime(entry.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="order-1 lg:order-2" aria-label="Status">
          <div className="flex flex-col gap-5 lg:sticky lg:top-18">
            <Panel title="Status">
              <div className="flex items-center gap-3">
                <StatusBadge kind="booking" value={booking.status} />
                <span className="text-[0.8125rem] text-white/60">{bookingStatuses.find((option) => option.value === booking.status)?.note}</span>
              </div>
              {steps.length ? (
                <div className="mt-5 flex flex-col gap-2">
                  {steps.map((step, i) => (
                    <Button
                      key={step.to}
                      className="w-full"
                      variant={step.to === "cancelled" ? "danger" : i === 0 ? "primary" : "secondary"}
                      disabled={!canEdit || working}
                      onClick={async () => {
                        setWorking(true);
                        await changeStatus(booking, step.to);
                        setWorking(false);
                      }}
                    >
                      {step.icon}
                      {step.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[0.8125rem] text-white/55">This booking is closed.</p>
              )}
              <p className="mt-4 text-[0.75rem] leading-snug text-white/50">
                Status is recorded here only. No confirmation is sent to the customer and no chauffeur is notified.
              </p>
            </Panel>
            <dl className="flex flex-col gap-1.5 px-1 text-[0.75rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-white/50">Created</dt>
                <dd className="text-white/75 tabular-nums">{formatDateTime(booking.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/50">Last updated</dt>
                <dd className="text-white/75 tabular-nums">{formatDateTime(booking.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </PageBody>
  );
}
