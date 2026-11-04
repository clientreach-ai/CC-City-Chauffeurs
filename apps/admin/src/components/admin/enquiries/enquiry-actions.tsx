"use client";

import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { ChoiceCards, Field, FieldRow, NumberInput, TextArea, TextInput } from "@/components/admin/ui/form";
import { notify } from "@/components/admin/ui/toast";
import { formatMoney } from "@CC-City-Chauffeurs/core";
import { errorMessage } from "@/lib/query";
import { recordQuote, updateEnquiryJourney, updateEnquiryStatus } from "@/lib/api/operations";
import { lostReasons } from "@CC-City-Chauffeurs/core";
import type { Enquiry, EnquiryStatus, LostReason } from "@CC-City-Chauffeurs/core";
import { CmsValidationError, type FieldErrors } from "@CC-City-Chauffeurs/core";

/** Status changes that need no extra input. */
export async function changeStatus(enquiry: Enquiry, status: EnquiryStatus) {
  try {
    await updateEnquiryStatus(enquiry.id, status);
    const messages: Partial<Record<EnquiryStatus, [string, string]>> = {
      contacted: ["Marked as contacted", "Recorded here only — the customer has not been sent anything."],
      won: ["Marked as won", "Create a booking when the details are agreed."],
      cancelled: ["Marked as cancelled", "Recorded as withdrawn by the customer, not as lost business."],
      new: ["Reopened", ""],
    };
    const [title, description] = messages[status] ?? ["Status updated", ""];
    notify.success(title, description || undefined);
    return true;
  } catch (error) {
    notify.error("Status not changed", errorMessage(error));
    return false;
  }
}

export function QuoteDialog({ enquiry, onClose }: { enquiry: Enquiry | null; onClose: () => void }) {
  return (
    <Dialog
      open={enquiry !== null}
      onClose={onClose}
      title="Record a quote"
      description="Keeps a record of the price offered and moves the enquiry to Quoted. It does not send anything — send the quote to the customer by WhatsApp, phone or email as usual."
    >
      {enquiry ? <QuoteForm key={enquiry.id} enquiry={enquiry} onClose={onClose} /> : null}
    </Dialog>
  );
}

function QuoteForm({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(enquiry.quote?.amount ?? null);
  const [note, setNote] = useState(enquiry.quote?.note ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await recordQuote(enquiry.id, { amount, note });
      notify.success(`Quote of ${formatMoney(amount)} recorded`, "Remember to send it to the customer.");
      onClose();
    } catch (error) {
      if (error instanceof CmsValidationError) setErrors(error.fields);
      else notify.error("Quote not recorded", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5"
    >
      <Field label="Amount quoted" required error={errors.amount} description="In pounds. Indicative rates: Cullinan £200/h, Urus £150, G-Wagon £125, S-Class £90, V-Class £75 — four-hour minimum.">
        {(control) => <NumberInput {...control} autoFocus prefix="£" min={0} step={10} value={amount} onValueChange={setAmount} />}
      </Field>
      <Field label="What it covers" error={errors.note} description="e.g. hours, vehicles, and any surcharges that apply.">
        {(control) => <TextArea {...control} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving}>
          Record quote
        </Button>
      </div>
    </form>
  );
}

/**
 * Amending the journey, which the office could not do at all before.
 *
 * The only way to change a date was to write a note and hope whoever read it
 * noticed. It is the same capability a customer reaches on WhatsApp, so a
 * journey moved in either place is the same record and the same trail.
 */
export function JourneyDialog({ enquiry, onClose }: { enquiry: Enquiry | null; onClose: () => void }) {
  return (
    <Dialog
      open={enquiry !== null}
      onClose={onClose}
      title="Amend the journey"
      description="Changes the enquiry itself and leaves a line on its history. It sends nothing to the customer — tell them as you normally would."
    >
      {enquiry ? <JourneyForm key={enquiry.id} enquiry={enquiry} onClose={onClose} /> : null}
    </Dialog>
  );
}

/** The fields this form edits, so a refusal about anything else is shown rather than lost. */
const JOURNEY_FIELDS = ["date", "time", "pickup", "dropoff", "passengers"] as const;

function JourneyForm({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  // What the form opened with. The enquiry prop refetches while the dialog is
  // open, and a customer may move the date on WhatsApp in that time; judging
  // "what the office touched" against the live record would send that new
  // date back as the old one.
  const [start] = useState(() => ({ ...enquiry.journey }));
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [pickup, setPickup] = useState(start.pickup);
  const [dropoff, setDropoff] = useState(start.dropoff);
  const [passengers, setPassengers] = useState<number | null>(start.passengers);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      // Only what the office actually touched, so a field left alone keeps
      // whatever value it has now rather than being written back over.
      const patch = {
        ...(date === start.date ? {} : { date }),
        ...(time === start.time ? {} : { time }),
        ...(pickup === start.pickup ? {} : { pickup }),
        ...(dropoff === start.dropoff ? {} : { dropoff }),
        ...(passengers === start.passengers ? {} : { passengers }),
      };
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      await updateEnquiryJourney(enquiry.id, patch);
      notify.success("Journey amended", "The customer has not been told — let them know as usual.");
      onClose();
    } catch (error) {
      if (error instanceof CmsValidationError) {
        setErrors(error.fields);
        // "This enquiry has already become a booking" is keyed to no field
        // here, and would otherwise leave the dialog sitting there silently.
        const elsewhere = Object.entries(error.fields)
          .filter(([field]) => !(JOURNEY_FIELDS as readonly string[]).includes(field))
          .map(([, message]) => message);
        if (elsewhere.length) notify.error("Journey not amended", elsewhere.join(" "));
      } else notify.error("Journey not amended", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5"
    >
      <FieldRow>
        <Field label="Date" error={errors.date} description="Today or later.">
          {(control) => <TextInput {...control} autoFocus type="date" value={date} onChange={(event) => setDate(event.target.value)} />}
        </Field>
        <Field label="Time" error={errors.time}>
          {(control) => <TextInput {...control} type="time" value={time} onChange={(event) => setTime(event.target.value)} />}
        </Field>
      </FieldRow>
      <Field label="Pick-up" error={errors.pickup}>
        {(control) => <TextInput {...control} value={pickup} onChange={(event) => setPickup(event.target.value)} />}
      </Field>
      <Field label="Drop-off" error={errors.dropoff}>
        {(control) => <TextInput {...control} value={dropoff} onChange={(event) => setDropoff(event.target.value)} />}
      </Field>
      <Field label="Passengers" error={errors.passengers}>
        {(control) => <NumberInput {...control} min={1} max={50} value={passengers} onValueChange={setPassengers} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving}>
          Save the journey
        </Button>
      </div>
    </form>
  );
}

export function LostDialog({ enquiry, onClose }: { enquiry: Enquiry | null; onClose: () => void }) {
  return (
    <Dialog open={enquiry !== null} onClose={onClose} title="Mark as lost" description="One tap on the reason — over time it shows why work is being lost (PRD §10.5).">
      {enquiry ? <LostForm key={enquiry.id} enquiry={enquiry} onClose={onClose} /> : null}
    </Dialog>
  );
}

function LostForm({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const [reason, setReason] = useState<LostReason>(enquiry.lostReason ?? "price");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await updateEnquiryStatus(enquiry.id, "lost", { lostReason: reason });
      notify.success("Marked as lost");
      onClose();
    } catch (error) {
      notify.error("Status not changed", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <ChoiceCards legend="Why was it lost?" columns={2} options={lostReasons} value={reason} onChange={setReason} />
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" busy={saving} onClick={() => void submit()}>
          Mark as lost
        </Button>
      </div>
    </div>
  );
}
