"use client";

import { CalendarPlus, CircleCheck, CircleX, Copy, MessageSquareText, PoundSterling, RotateCcw } from "lucide-react";
import { useState } from "react";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/admin/ui/button";
import { Field, TextArea } from "@/components/admin/ui/form";
import { DefinitionList, ErrorState, LoadingBlock, Notice, PageBody, PageHeader, Panel, SampleDataNotice } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatAge, formatDate, formatDateTime, formatMoney, formatWhen } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { addEnquiryNote, createBookingFromEnquiry, getEnquiry } from "@/lib/cms/repositories/operations";
import { enquirySources, enquiryStatuses, labelFor, lostReasons, replyChannels } from "@/lib/cms/status";
import { CmsNotFoundError, CmsValidationError } from "@/lib/cms/validation";

import { changeStatus, LostDialog, QuoteDialog } from "./enquiry-actions";

function CopyValue({ value, label }: { value: string; label: string }) {
  if (!value) return <span className="text-white/45">—</span>;
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="break-all">{value}</span>
      <IconButton
        size="sm"
        label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            notify.success(`${label[0].toUpperCase()}${label.slice(1)} copied`);
          } catch {
            notify.error("Could not copy", "Select the text and copy it instead.");
          }
        }}
      >
        <Copy aria-hidden />
      </IconButton>
    </span>
  );
}

export function EnquiryDetail({ id }: { id: string }) {
  const { can, author } = usePreferences();
  const { serviceLabel, vehicleName } = useLookups();
  const { data: enquiry, loading, error, reload } = useCmsQuery(`enquiry:${id}`, () => getEnquiry(id));
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();
  const [savingNote, setSavingNote] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [losing, setLosing] = useState(false);
  const [working, setWorking] = useState(false);
  useUnsavedChanges(note.trim().length > 0);

  const canEdit = can("operations.edit");

  if (error) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Enquiries", href: adminRoutes.enquiries }, { label: "Not found" }]} title="Enquiry not found" />
        <ErrorState error={error} onRetry={error instanceof CmsNotFoundError ? undefined : reload} />
      </PageBody>
    );
  }
  if (loading || !enquiry) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Enquiries", href: adminRoutes.enquiries }, { label: "Loading" }]} title="Loading…" />
        <LoadingBlock label="Loading the enquiry" />
      </PageBody>
    );
  }

  const { journey } = enquiry;

  const addNote = async () => {
    setSavingNote(true);
    try {
      await addEnquiryNote(enquiry.id, note, author);
      setNote("");
      setNoteError(undefined);
      notify.success("Note added");
    } catch (err) {
      if (err instanceof CmsValidationError) setNoteError(err.fields.body);
      else notify.error("Note not added", errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const run = async (status: Parameters<typeof changeStatus>[1]) => {
    setWorking(true);
    await changeStatus(enquiry, status);
    setWorking(false);
  };

  const createBooking = async () => {
    setWorking(true);
    try {
      const booking = await createBookingFromEnquiry(enquiry.id);
      notify.success(`Booking ${booking.reference} created`, "Pending — confirm it with the customer, then mark it confirmed.");
    } catch (err) {
      notify.error("Booking not created", err instanceof CmsValidationError ? Object.values(err.fields)[0] : errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const nextSteps = (
    <div className="flex flex-col gap-2">
      {enquiry.status === "new" ? (
        <Button variant="primary" className="w-full" disabled={!canEdit || working} onClick={() => void run("contacted")}>
          <MessageSquareText aria-hidden />
          Mark contacted
        </Button>
      ) : null}
      {enquiry.status !== "won" && enquiry.status !== "lost" ? (
        <Button variant={enquiry.status === "new" ? "secondary" : "primary"} className="w-full" disabled={!canEdit || working} onClick={() => setQuoting(true)}>
          <PoundSterling aria-hidden />
          {enquiry.quote ? "Update quote" : "Record quote"}
        </Button>
      ) : null}
      {enquiry.status !== "won" && enquiry.status !== "lost" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!canEdit || working} onClick={() => void run("won")}>
            <CircleCheck aria-hidden />
            Won
          </Button>
          <Button disabled={!canEdit || working} onClick={() => setLosing(true)}>
            <CircleX aria-hidden />
            Lost
          </Button>
        </div>
      ) : (
        <Button className="w-full" disabled={!canEdit || working} onClick={() => void run("contacted")}>
          <RotateCcw aria-hidden />
          Reopen
        </Button>
      )}
    </div>
  );

  return (
    <PageBody>
      <PageHeader
        crumbs={[{ label: "Enquiries", href: adminRoutes.enquiries }, { label: enquiry.reference }]}
        title={enquiry.contact.name}
        meta={
          <>
            <StatusBadge kind="enquiry" value={enquiry.status} />
            <span className="text-[0.8125rem] text-white/60">
              Received {formatWhen(enquiry.createdAt)} via {labelFor(enquirySources, enquiry.source)}
            </span>
            {enquiry.status === "new" ? <span className="text-[0.8125rem] text-white">Waiting {formatAge(enquiry.createdAt)}</span> : null}
          </>
        }
      />
      <SampleDataNotice />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <section aria-labelledby="customer-title">
              <h2 id="customer-title" className="label-xs mb-3 text-white/70">
                Customer
              </h2>
              <DefinitionList
                items={[
                  {
                    label: "Name",
                    value: enquiry.customerId ? (
                      <GuardedLink href={adminRoutes.customer(enquiry.customerId)} className="underline-offset-4 hover:underline">
                        {enquiry.contact.name}
                      </GuardedLink>
                    ) : (
                      enquiry.contact.name
                    ),
                  },
                  { label: "Phone", value: <CopyValue value={enquiry.contact.phone} label="phone number" /> },
                  { label: "Email", value: <CopyValue value={enquiry.contact.email} label="email address" /> },
                  { label: "Reply by", value: labelFor(replyChannels, enquiry.replyBy) },
                ]}
              />
            </section>
            <section aria-labelledby="journey-title">
              <h2 id="journey-title" className="label-xs mb-3 text-white/70">
                Journey
              </h2>
              <DefinitionList
                items={[
                  { label: "Service", value: serviceLabel(journey.service) },
                  { label: "Vehicle", value: vehicleName(journey.vehicleId) || "No preference" },
                  { label: "Pick-up", value: journey.pickup },
                  { label: "Drop-off", value: journey.dropoff },
                  { label: "Date", value: journey.date ? formatDate(journey.date) : "" },
                  { label: "Time", value: journey.time },
                  { label: "Passengers", value: journey.passengers != null ? String(journey.passengers) : "" },
                  { label: "Luggage", value: journey.luggage },
                  ...(journey.flight ? [{ label: "Flight", value: journey.flight }] : []),
                ]}
              />
            </section>
          </div>

          <section aria-labelledby="message-title">
            <h2 id="message-title" className="label-xs mb-3 text-white/70">
              Message
            </h2>
            <blockquote className="border-l border-hairline-strong pl-5 font-display text-[1.375rem] leading-snug font-light text-white/90">
              {enquiry.message || <span className="text-white/45">No message.</span>}
            </blockquote>
          </section>

          <section aria-labelledby="notes-title">
            <h2 id="notes-title" className="label-xs mb-3 text-white/70">
              Notes <span className="text-white/45">· internal</span>
            </h2>
            {enquiry.notes.length ? (
              <ul className="mb-5 border-t border-hairline">
                {enquiry.notes.map((entry) => (
                  <li key={entry.id} className="border-b border-hairline py-4">
                    <p className="text-[0.875rem] leading-relaxed whitespace-pre-line text-white">{entry.body}</p>
                    <p className="mt-2 text-[0.75rem] text-white/50">
                      {entry.author} · {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-[0.875rem] text-white/55">No notes yet.</p>
            )}
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void addNote();
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Add a note" error={noteError} description="Visible to anyone with access to the admin. Never shown to the customer.">
                {(control) => (
                  <TextArea {...control} rows={3} value={note} disabled={!canEdit} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Called — wants the Cullinan, confirming timings by Friday." />
                )}
              </Field>
              <div>
                <Button type="submit" size="sm" disabled={!note.trim() || !canEdit} busy={savingNote}>
                  Add note
                </Button>
              </div>
            </form>
          </section>

          <section aria-labelledby="activity-title">
            <h2 id="activity-title" className="label-xs mb-3 text-white/70">
              Activity
            </h2>
            <ol className="relative flex flex-col gap-4 border-l border-hairline pl-5">
              {[...enquiry.activity].reverse().map((entry) => (
                <li key={entry.id} className="relative">
                  <span aria-hidden className="absolute top-1.5 -left-[23.5px] size-2 border border-white/50 bg-ink" />
                  <p className="text-[0.8125rem] text-white/85">{entry.text}</p>
                  <p className="text-[0.75rem] text-white/50">{formatDateTime(entry.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="order-1 flex flex-col gap-5 lg:order-2" aria-label="Status and next steps">
          <div className="flex flex-col gap-5 lg:sticky lg:top-18">
            <Panel title="Status">
              <div className="flex items-center gap-3">
                <StatusBadge kind="enquiry" value={enquiry.status} />
                <span className="text-[0.8125rem] text-white/60">
                  {enquiry.status === "lost"
                    ? labelFor(lostReasons, enquiry.lostReason)
                    : enquiryStatuses.find((option) => option.value === enquiry.status)?.note}
                </span>
              </div>
              <div className="mt-5">{nextSteps}</div>
              <p className="mt-4 text-[0.75rem] leading-snug text-white/50">
                These record the state of the enquiry. Nothing is sent to the customer — reply by WhatsApp, phone or email
                as usual.
              </p>
            </Panel>

            <Panel title="Quote">
              {enquiry.quote ? (
                <>
                  <p className="font-display text-[2rem] leading-none font-light text-white tabular-nums">{formatMoney(enquiry.quote.amount)}</p>
                  {enquiry.quote.note ? <p className="mt-3 text-[0.8125rem] leading-relaxed text-white/70">{enquiry.quote.note}</p> : null}
                  <p className="mt-3 text-[0.75rem] text-white/50">Recorded {formatDateTime(enquiry.quote.recordedAt)}</p>
                </>
              ) : (
                <p className="text-[0.8125rem] text-white/55">No quote recorded.</p>
              )}
            </Panel>

            <Panel title="Booking">
              {enquiry.bookingId ? (
                <ButtonLink href={adminRoutes.booking(enquiry.bookingId)} size="sm">
                  Open the booking
                </ButtonLink>
              ) : enquiry.status === "won" ? (
                <>
                  <p className="mb-4 text-[0.8125rem] text-white/60">Won, with no booking yet.</p>
                  <Button size="sm" disabled={!canEdit || working} onClick={() => void createBooking()}>
                    <CalendarPlus aria-hidden />
                    Create booking
                  </Button>
                </>
              ) : (
                <p className="text-[0.8125rem] text-white/55">A booking can be created once the enquiry is won.</p>
              )}
            </Panel>

            <dl className="flex flex-col gap-1.5 px-1 text-[0.75rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-white/50">Created</dt>
                <dd className="text-white/75 tabular-nums">{formatDateTime(enquiry.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/50">Last updated</dt>
                <dd className="text-white/75 tabular-nums">{formatDateTime(enquiry.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {!canEdit ? <Notice className="mt-8">Your role can view enquiries but not change them.</Notice> : null}

      <QuoteDialog enquiry={quoting ? enquiry : null} onClose={() => setQuoting(false)} />
      <LostDialog enquiry={losing ? enquiry : null} onClose={() => setLosing(false)} />
    </PageBody>
  );
}
