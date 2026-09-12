"use client";

import { useState } from "react";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Field, TextArea } from "@/components/admin/ui/form";
import { DefinitionList, ErrorState, LoadingBlock, PageBody, PageHeader, Panel, SampleDataNotice } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatDate, formatDateTime } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { getBooking, getCustomer, updateBookingNotes } from "@/lib/cms/repositories/operations";
import { bookingStatuses } from "@/lib/cms/status";
import { CmsNotFoundError } from "@/lib/cms/validation";

import { transitions, useBookingStatus } from "./booking-status";

export function BookingDetail({ id }: { id: string }) {
  const { can } = usePreferences();
  const { serviceLabel, vehicleName } = useLookups();
  const changeStatus = useBookingStatus();
  const { data, loading, error, reload } = useCmsQuery(`booking:${id}`, async () => {
    const booking = await getBooking(id);
    const customer = booking.customerId ? (await getCustomer(booking.customerId)).customer : null;
    return { booking, customer };
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

  const { booking, customer } = data;
  const canEdit = can("operations.edit");
  const steps = transitions[booking.status];

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
            <span className="text-[0.8125rem] text-white/60">
              {formatDate(booking.date)} at {booking.time}
            </span>
          </>
        }
      />
      <SampleDataNotice />

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
                  label: "From enquiry",
                  value: booking.enquiryId ? (
                    <GuardedLink href={adminRoutes.enquiry(booking.enquiryId)} className="underline-offset-4 hover:underline">
                      {booking.enquiryId.toUpperCase()}
                    </GuardedLink>
                  ) : (
                    "Booked directly"
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
