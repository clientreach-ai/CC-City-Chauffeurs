"use client";

import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import { ErrorSummary, Field, TextInput } from "@/components/admin/ui/form";
import { notify } from "@/components/admin/ui/toast";
import { useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { authClient } from "@/lib/auth-client";
import {
  hasErrors,
  PASSWORD_LENGTH,
  validatePasswordChange,
  type ChangePasswordInput,
  type FieldErrors,
} from "@CC-City-Chauffeurs/core";

const empty: ChangePasswordInput = { currentPassword: "", newPassword: "", confirmPassword: "" };

const labels = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Type it again",
};

/**
 * What better-auth's refusal means, said for the field it belongs to.
 *
 * `INVALID_PASSWORD` is the current password being wrong — the only answer
 * that says anything about the account, and it is the signed-in person's
 * own. Anything without a field is shown as a toast instead.
 */
function refusal(status: number | undefined, code: string | undefined): { fields?: FieldErrors; message?: string } {
  if (code === "INVALID_PASSWORD") return { fields: { currentPassword: "That is not your current password." } };
  if (code === "PASSWORD_TOO_SHORT") return { fields: { newPassword: `Use at least ${PASSWORD_LENGTH.min} characters.` } };
  if (code === "PASSWORD_TOO_LONG") return { fields: { newPassword: `Use at most ${PASSWORD_LENGTH.max} characters.` } };
  if (status === 429) return { message: "Too many attempts. Wait a minute and try again." };
  if (status === 401) return { message: "Your session has ended. Sign in again, then change your password." };
  if (!status) return { message: "Could not reach the server. Check your connection and try again." };
  return { message: "Your password was not changed. Try again." };
}

/**
 * Changes the signed-in person's own password, through better-auth's
 * `/change-password`: it checks the current password, stores the new one in
 * the same hash it signs in with, and — asked to here, always — signs out
 * every other device, issuing this one a fresh session so nobody is thrown
 * out mid-change. A password someone else may have seen stops being useful
 * everywhere at once.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const [form, setForm] = useState<ChangePasswordInput>(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useUnsavedChanges(form.currentPassword !== "" || form.newPassword !== "" || form.confirmPassword !== "");

  const update = (patch: Partial<ChangePasswordInput>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (attempted) setErrors(validatePasswordChange(next));
  };

  const submit = async () => {
    const found = validatePasswordChange(form);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) return;

    setSaving(true);
    const result = await authClient
      .changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        revokeOtherSessions: true,
      })
      .catch(() => ({ error: { status: undefined, code: undefined } }));
    setSaving(false);

    if (result.error) {
      const { fields, message } = refusal(result.error.status, result.error.code);
      if (fields) setErrors(fields);
      if (message) notify.error("Password not changed", message);
      return;
    }

    setForm(empty);
    setErrors({});
    setAttempted(false);
    notify.success("Password changed", "You've been signed out on every other device. Use the new password next time you sign in.");
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex max-w-md flex-col gap-6"
    >
      {/* For password managers: which account this new password belongs to. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      {attempted && hasErrors(errors) ? <ErrorSummary errors={errors} labels={labels} /> : null}
      <Field label={labels.currentPassword} required error={errors.currentPassword}>
        {(control) => (
          <TextInput
            {...control}
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => update({ currentPassword: event.target.value })}
          />
        )}
      </Field>
      <Field
        label={labels.newPassword}
        required
        error={errors.newPassword}
        description={`At least ${PASSWORD_LENGTH.min} characters. A few unrelated words is easy to remember and hard to guess.`}
      >
        {(control) => (
          <TextInput
            {...control}
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => update({ newPassword: event.target.value })}
          />
        )}
      </Field>
      <Field label={labels.confirmPassword} required error={errors.confirmPassword}>
        {(control) => (
          <TextInput
            {...control}
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => update({ confirmPassword: event.target.value })}
          />
        )}
      </Field>
      <div className="flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.8125rem] leading-snug text-white/55">Every other device you are signed in on is signed out.</p>
        <Button type="submit" variant="primary" busy={saving} className="shrink-0">
          {saving ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
