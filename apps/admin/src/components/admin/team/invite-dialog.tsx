"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import {
  CmsValidationError,
  hasErrors,
  INVITATION_DAYS,
  roles,
  type FieldErrors,
  type InvitationIssued,
  type InviteMemberInput,
} from "@CC-City-Chauffeurs/core";

import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { ChoiceCards, ErrorSummary, Field, TextInput } from "@/components/admin/ui/form";
import { notify } from "@/components/admin/ui/toast";
import { emptyInvite, inviteMember, validateInvite } from "@/lib/api/team";
import { errorMessage } from "@/lib/query";

const labels = { name: "Name", email: "Email address", role: "Role" };

export const roleOptions = roles.map((role) => ({ value: role.value, label: role.label, note: role.summary }));

/** Mounted only while open, so every invitation starts from a clean form. */
export function InviteDialog({ onClose, onIssued }: { onClose: () => void; onIssued: (issued: InvitationIssued) => void }) {
  const [form, setForm] = useState<InviteMemberInput>(emptyInvite);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);

  const update = (patch: Partial<InviteMemberInput>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (attempted) setErrors(validateInvite(next));
  };

  const submit = async () => {
    const input = { ...form, name: form.name.trim(), email: form.email.trim() };
    const found = validateInvite(input);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) return;
    setSending(true);
    try {
      onIssued(await inviteMember(input));
    } catch (err) {
      if (err instanceof CmsValidationError) setErrors(err.fields);
      else notify.error("Invitation not sent", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Invite someone"
      description={`They get an email with a link to choose their own password. The link works once and expires in ${INVITATION_DAYS} days.`}
      width="38rem"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-6"
      >
        {attempted && hasErrors(errors) ? <ErrorSummary errors={errors} labels={labels} /> : null}
        <Field label="Name" required error={errors.name}>
          {(control) => (
            <TextInput
              {...control}
              data-autofocus
              autoComplete="off"
              value={form.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          )}
        </Field>
        <Field label="Email address" required error={errors.email} description="They sign in with this address.">
          {(control) => (
            <TextInput
              {...control}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={form.email}
              onChange={(event) => update({ email: event.target.value })}
            />
          )}
        </Field>
        <ChoiceCards legend="Role" options={roleOptions} value={form.role} onChange={(role) => update({ role })} />
        {errors.role ? <p className="-mt-3 text-[0.8125rem] text-alert">{errors.role}</p> : null}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-hairline bg-graphite px-5 py-4 sm:-mx-6 sm:px-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={sending}>
            {sending ? null : <Send aria-hidden />}
            {sending ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
