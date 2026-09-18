"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLayout, focusFirstError, MobileActionBar, SectionIndex } from "@/components/admin/editor";
import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { Button } from "@/components/admin/ui/button";
import {
  ChoiceCards,
  ErrorSummary,
  Field,
  FieldRow,
  FormSection,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/admin/ui/form";
import { Hint } from "@/components/admin/ui/hint";
import { LoadingBlock, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { errorMessage } from "@/lib/query";
import { createBooking, getBookingClashesFor } from "@/lib/api/operations";
import {
  bookingStatuses,
  CmsValidationError,
  deniedReason,
  formatDate,
  hasErrors,
  PUBLIC_FORM_LIMITS,
  type Booking,
  type FieldErrors,
} from "@CC-City-Chauffeurs/core";
import type { BookingInput } from "@CC-City-Chauffeurs/core/schemas";

/**
 * A booking the office takes itself.
 *
 * The telephone rings, the journey is agreed while they are still talking,
 * and it goes straight in the diary — there is no enquiry to convert, because
 * an enquiry is a question somebody asked and this call did not end in one.
 *
 * Only the customer's name and the date are asked for. Everything else is
 * whatever the caller happened to say, and somebody writing a job down at
 * speed should never be stopped for a field they can fill in afterwards.
 */

const SECTIONS = [
  { id: "customer", label: "Customer", fields: ["name", "phone", "email"] },
  { id: "journey", label: "Journey", fields: ["date", "time", "pickup", "dropoff", "passengers", "service"] },
  { id: "vehicle", label: "Vehicle", fields: ["vehicleId"] },
  { id: "notes", label: "Notes", fields: ["notes"] },
];

const LABELS: Record<string, string> = {
  name: "Customer name",
  phone: "Telephone",
  email: "Email",
  date: "Date",
  time: "Time",
  pickup: "Pick-up",
  dropoff: "Destination",
  service: "Service",
  notes: "Notes",
};

/** Pending or confirmed — nothing later can be true of a booking being written. */
const STATUSES = (["pending", "confirmed"] as const).map((value) => {
  const status = bookingStatuses.find((option) => option.value === value);
  return { value, label: status?.label ?? value, note: status?.note ?? "" };
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function emptyBooking(): BookingInput {
  return {
    name: "",
    phone: "",
    email: "",
    service: "",
    vehicleId: null,
    date: "",
    time: "",
    pickup: "",
    dropoff: "",
    passengers: null,
    notes: "",
    status: "pending",
  };
}

/**
 * The rules `bookingInputSchema` applies, run here first so the office is
 * told before the request goes rather than after it comes back. The lengths
 * are the shared `PUBLIC_FORM_LIMITS`, so this form and the API cannot
 * disagree about what fits.
 */
function validateBooking(form: BookingInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Whose booking is it? A name is enough.";
  else if (name.length > PUBLIC_FORM_LIMITS.name) {
    errors.name = `Please keep the name under ${PUBLIC_FORM_LIMITS.name} characters.`;
  }
  if (!ISO_DATE.test(form.date)) errors.date = "Choose the date of the journey.";
  const phone = form.phone.trim();
  if (phone && phone.replace(/\D/g, "").length < 7) {
    errors.phone = "That number looks too short — include the area code.";
  }
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "That email address does not look complete.";
  }
  return errors;
}

export function BookingEditor() {
  const router = useRouter();
  const { can } = usePreferences();
  const { ready, services, vehicles } = useLookups();
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<BookingInput>(emptyBooking);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clashes, setClashes] = useState<Booking[]>([]);

  const dirty = !saved && JSON.stringify(form) !== JSON.stringify(emptyBooking());
  useUnsavedChanges(dirty);

  /**
   * What that car is already carrying that day, asked while the caller is
   * still on the telephone. Held back a moment so a date being typed does not
   * become a request per keystroke, and never allowed to fail loudly: this is
   * something to read, not a gate.
   */
  const { vehicleId, date } = form;
  useEffect(() => {
    if (!vehicleId || !ISO_DATE.test(date)) {
      setClashes([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      getBookingClashesFor(vehicleId, date)
        .then((found) => {
          if (live) setClashes(found);
        })
        .catch(() => {
          if (live) setClashes([]);
        });
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [vehicleId, date]);

  const canEdit = can("operations.edit");

  const update = (patch: Partial<BookingInput>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (attempted) setErrors(validateBooking(next));
  };

  const save = async () => {
    const found = validateBooking(form);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      notify.error("Not saved yet", "Some fields need attention — they are marked below.");
      focusFirstError(formRef.current);
      return;
    }
    setSaving(true);
    try {
      const booking = await createBooking(form);
      setSaved(true);
      notify.success(
        `Booking ${booking.reference} taken`,
        booking.status === "confirmed"
          ? "In the diary as confirmed. Nothing has been sent to the customer."
          : "In the diary as pending. Nothing has been sent to the customer.",
      );
      router.replace(adminRoutes.booking(booking.id));
    } catch (error) {
      if (error instanceof CmsValidationError) {
        setErrors(error.fields);
        focusFirstError(formRef.current);
        notify.error("Not saved", "Some fields need attention — they are marked below.");
      } else {
        notify.error("Not saved", errorMessage(error));
      }
      setSaving(false);
    }
  };

  const saveButton = (layout: "rail" | "bar") => {
    const wide = layout === "rail" ? "w-full" : "";
    return (
      <Hint content={deniedReason("operations.edit")} disabled={canEdit}>
        <span className={wide}>
          <Button variant="primary" className={wide} disabled={!canEdit} busy={saving} onClick={() => void save()}>
            Save booking
          </Button>
        </span>
      </Hint>
    );
  };

  const header = (
    <PageHeader
      crumbs={[{ label: "Bookings", href: adminRoutes.bookings }, { label: "New booking" }]}
      title="New booking"
      description="A journey agreed on the telephone, written straight into the diary."
    />
  );

  if (!ready) {
    return (
      <PageBody>
        {header}
        <LoadingBlock label="Loading the services and the fleet" />
      </PageBody>
    );
  }

  // Named only while the vehicle is one this office recognises — the picker
  // only ever offers those, but the notice reads as a sentence either way.
  const car = vehicles.find((vehicle) => vehicle.id === form.vehicleId)?.name;

  return (
    <PageBody className="pb-32 lg:pb-24">
      {header}

      <EditorLayout
        rail={
          <>
            <Panel title="This booking">
              <ChoiceCards
                legend="Status"
                columns={2}
                options={STATUSES}
                value={form.status}
                onChange={(status) => update({ status })}
                disabled={!canEdit}
              />
              <div className="mt-5 hidden flex-col gap-2 lg:flex">{saveButton("rail")}</div>
              <p className="mt-4 text-[0.75rem] leading-snug text-white/50">
                Recorded here only. No confirmation is sent to the customer and no chauffeur is notified.
              </p>
            </Panel>

            <SectionIndex sections={SECTIONS} errors={errors} />
          </>
        }
        main={
          <form
            ref={formRef}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="flex flex-col"
          >
            {attempted && hasErrors(errors) ? (
              <div className="mb-8">
                <ErrorSummary errors={errors} labels={LABELS} />
              </div>
            ) : null}

            <FormSection
              id="customer"
              index="01"
              title="Customer"
              description="Matched to the customer the business already has, on the email address or the telephone number. Somebody new is added only when nobody matches — a regular who rings every month stays one customer."
            >
              <Field label="Customer name" required error={errors.name} description="Who the journey is for.">
                {(control) => (
                  <TextInput
                    {...control}
                    maxLength={PUBLIC_FORM_LIMITS.name}
                    value={form.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                )}
              </Field>
              <FieldRow>
                <Field label="Telephone" error={errors.phone}>
                  {(control) => (
                    <TextInput
                      {...control}
                      type="tel"
                      maxLength={PUBLIC_FORM_LIMITS.phone}
                      value={form.phone}
                      onChange={(event) => update({ phone: event.target.value })}
                    />
                  )}
                </Field>
                <Field label="Email" error={errors.email}>
                  {(control) => (
                    <TextInput
                      {...control}
                      type="email"
                      maxLength={PUBLIC_FORM_LIMITS.email}
                      value={form.email}
                      onChange={(event) => update({ email: event.target.value })}
                    />
                  )}
                </Field>
              </FieldRow>
            </FormSection>

            <FormSection
              id="journey"
              index="02"
              title="Journey"
              description="The date is the one thing a booking cannot do without. Anything still being decided can be left until the call is over."
            >
              <FieldRow>
                <Field label="Date" required error={errors.date}>
                  {(control) => (
                    <TextInput {...control} type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} />
                  )}
                </Field>
                <Field label="Time" error={errors.time} description="When the car is wanted.">
                  {(control) => (
                    <TextInput
                      {...control}
                      type="time"
                      maxLength={PUBLIC_FORM_LIMITS.time}
                      value={form.time}
                      onChange={(event) => update({ time: event.target.value })}
                    />
                  )}
                </Field>
              </FieldRow>
              <Field label="Pick-up" error={errors.pickup}>
                {(control) => (
                  <TextInput
                    {...control}
                    maxLength={PUBLIC_FORM_LIMITS.pickup}
                    value={form.pickup}
                    onChange={(event) => update({ pickup: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Destination" error={errors.dropoff}>
                {(control) => (
                  <TextInput
                    {...control}
                    maxLength={PUBLIC_FORM_LIMITS.dropoff}
                    value={form.dropoff}
                    onChange={(event) => update({ dropoff: event.target.value })}
                  />
                )}
              </Field>
              <FieldRow>
                <Field label="Passengers" error={errors.passengers}>
                  {(control) => (
                    <NumberInput
                      {...control}
                      min={1}
                      step={1}
                      value={form.passengers}
                      onValueChange={(passengers) => update({ passengers })}
                    />
                  )}
                </Field>
                <Field label="Service" error={errors.service} description="What the journey is, as the website lists it.">
                  {(control) => (
                    <Select {...control} value={form.service} onChange={(event) => update({ service: event.target.value })}>
                      <option value="">Not said yet</option>
                      {services.map((service) => (
                        <option key={service.value} value={service.value}>
                          {service.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </FieldRow>
            </FormSection>

            <FormSection
              id="vehicle"
              index="03"
              title="Vehicle"
              description="Which car is going, if that is settled. A booking can wait for its vehicle."
            >
              <Field label="Vehicle" error={errors.vehicleId}>
                {(control) => (
                  <Select
                    {...control}
                    value={form.vehicleId ?? ""}
                    onChange={(event) => update({ vehicleId: event.target.value || null })}
                  >
                    <option value="">No vehicle yet</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {clashes.length ? (
                <Notice
                  tone="warning"
                  title={
                    clashes.length === 1
                      ? "This car is down for another job that day"
                      : `This car is down for ${clashes.length} other jobs that day`
                  }
                >
                  <p>
                    {car ?? "The same car"} is already carrying the journeys below on {formatDate(form.date)}. That is often an
                    ordinary day — a wedding at eleven and an airport run at eight are no trouble at all. A booking here
                    carries a date and a time and nothing that says when the car is free again, so this one is yours to
                    judge, not the system’s. Nothing here stops you saving.
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
            </FormSection>

            <FormSection id="notes" index="04" title="Notes" description="Internal. Timings, luggage, access, anything the day depends on.">
              <Field label="Notes" error={errors.notes}>
                {(control) => (
                  <TextArea
                    {...control}
                    rows={5}
                    maxLength={PUBLIC_FORM_LIMITS.message}
                    value={form.notes}
                    onChange={(event) => update({ notes: event.target.value })}
                  />
                )}
              </Field>
            </FormSection>
          </form>
        }
      />

      <MobileActionBar dirty={dirty}>{saveButton("bar")}</MobileActionBar>
    </PageBody>
  );
}
