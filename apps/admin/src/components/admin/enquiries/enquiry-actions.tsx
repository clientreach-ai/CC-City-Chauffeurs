"use client";

import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { ChoiceCards, Field, NumberInput, TextArea } from "@/components/admin/ui/form";
import { notify } from "@/components/admin/ui/toast";
import { formatMoney } from "@CC-City-Chauffeurs/core";
import { errorMessage } from "@/lib/query";
import { recordQuote, updateEnquiryStatus } from "@/lib/api/operations";
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
