"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { PASSWORD_LENGTH, passwordProblem, type InvitationPreview } from "@CC-City-Chauffeurs/core";

import { brand } from "@/content/brand";
import { signIn } from "@/lib/auth-client";

/**
 * Choosing a password from an invitation link, which makes the account
 * active, then signing straight in with it.
 *
 * Plain `fetch` rather than the admin's API client: that one speaks to
 * `/api/admin`, which needs a session, and treats a 401 as "signed out".
 */

type State =
  | { step: "loading" }
  | { step: "invalid"; message: string }
  | { step: "form"; invitation: InvitationPreview }
  | { step: "done" };

const OFFLINE = "Could not reach the server. Check your connection and try again.";

async function readBody(response: Response) {
  return (await response.json().catch(() => null)) as { error?: string; fields?: Record<string, string> } | null;
}

const inputClass =
  "mt-2 h-11 w-full border border-white/15 bg-obsidian px-3 text-[0.9375rem] text-white outline-none focus:border-white aria-[invalid=true]:border-alert";

export function AcceptInvite() {
  const token = useSearchParams().get("token")?.trim() ?? "";
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<{ password?: string; confirm?: string }>({});
  const [busy, setBusy] = useState<"saving" | "signing-in" | null>(null);

  // Known without asking the server, so shown at once.
  const view: State = token
    ? state
    : { step: "invalid", message: "This link is incomplete. Open the link from your invitation again, or ask an admin to send a new one." };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/public/invitations/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          const body = await readBody(response);
          setState({
            step: "invalid",
            message: body?.error || "This invitation link is no longer valid. Ask an admin to send you a new one.",
          });
          return;
        }
        setState({ step: "form", invitation: (await response.json()) as InvitationPreview });
      })
      .catch(() => {
        if (!cancelled) setState({ step: "invalid", message: OFFLINE });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view.step !== "form" || busy) return;
    const { email } = view.invitation;

    // From the form, not React state: a password manager may fill the inputs
    // without firing the events React listens for (see the sign-in page).
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    const found: typeof fields = {};
    const problem = passwordProblem(password);
    if (problem) found.password = problem;
    else if (confirm !== password) found.confirm = "The two passwords do not match.";
    setFields(found);
    setError(null);
    if (found.password || found.confirm) return;

    setBusy("saving");
    let response: Response;
    try {
      response = await fetch(`/api/public/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setBusy(null);
      setError(OFFLINE);
      return;
    }

    if (!response.ok) {
      setBusy(null);
      const body = await readBody(response);
      if (response.status === 410) {
        setState({ step: "invalid", message: body?.error || "This invitation link is no longer valid. Ask an admin to send you a new one." });
      } else if (response.status === 429) {
        setError("Too many attempts. Wait a minute and try again.");
      } else if (response.status === 422 && body?.fields?.password) {
        setFields({ password: body.fields.password });
      } else {
        setError(body?.error || "Your password could not be saved. Try again.");
      }
      return;
    }

    // The account is active: sign in with what they just chose.
    setBusy("signing-in");
    const result = await signIn.email({ email, password }).catch(() => null);
    if (!result || result.error) {
      setBusy(null);
      setState({ step: "done" });
      return;
    }
    router.replace("/");
  }

  return (
    <div
      data-admin
      className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 py-12 font-ui text-white antialiased scheme-dark"
    >
      <div className="w-full max-w-[22rem]">
        <Image src={brand.logo} alt="CC City Chauffeurs" width={150} height={40} priority className="h-9 w-auto" />

        {view.step === "loading" ? (
          <p role="status" className="label-xs mt-10 text-white/50">
            Checking your invitation…
          </p>
        ) : null}

        {view.step === "invalid" ? (
          <>
            <h1 className="display-sm mt-10 text-white">This link can&rsquo;t be used</h1>
            <p role="alert" className="mt-4 border-l-2 border-alert bg-alert/6 px-4 py-3 text-[0.8125rem] leading-relaxed text-white/80">
              {view.message}
            </p>
            <Link
              href="/sign-in"
              className="label-xs mt-8 flex h-11 w-full items-center justify-center border border-white/30 text-white transition-colors hover:border-white hover:bg-white/6"
            >
              Go to sign in
            </Link>
          </>
        ) : null}

        {view.step === "form" ? (
          <>
            <h1 className="display-sm mt-10 text-white">Choose a password</h1>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-white/55">
              Hello {view.invitation.name}. You&rsquo;ll sign in as{" "}
              <span className="break-all text-white">{view.invitation.email}</span>.
            </p>

            <form noValidate onSubmit={submit} className="mt-9">
              {/* For password managers: saves the new password against the right address. */}
              <input type="email" name="username" autoComplete="username" value={view.invitation.email} readOnly hidden />

              <label htmlFor="password" className="label-xs block text-white/55">
                Choose a password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_LENGTH.min}
                maxLength={PASSWORD_LENGTH.max}
                aria-invalid={fields.password ? true : undefined}
                aria-describedby={fields.password ? "password-hint password-error" : "password-hint"}
                className={inputClass}
              />
              {fields.password ? (
                <p id="password-error" className="mt-2 text-[0.8125rem] leading-snug text-alert">
                  {fields.password}
                </p>
              ) : null}
              <p id="password-hint" className="mt-2 text-[0.75rem] leading-snug text-white/45">
                At least {PASSWORD_LENGTH.min} characters. A few unrelated words is easy to remember and hard to guess.
              </p>

              <label htmlFor="confirm" className="label-xs mt-6 block text-white/55">
                Type it again
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={fields.confirm ? true : undefined}
                aria-describedby={fields.confirm ? "confirm-error" : undefined}
                className={inputClass}
              />
              {fields.confirm ? (
                <p id="confirm-error" className="mt-2 text-[0.8125rem] leading-snug text-alert">
                  {fields.confirm}
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="mt-5 text-[0.8125rem] leading-snug text-alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy !== null}
                className="label-xs mt-8 flex h-11 w-full items-center justify-center bg-white text-ink transition-colors hover:bg-silver disabled:opacity-60"
              >
                {busy === "saving" ? "Saving…" : busy === "signing-in" ? "Signing you in…" : "Save password and sign in"}
              </button>
            </form>
          </>
        ) : null}

        {view.step === "done" ? (
          <>
            <h1 className="display-sm mt-10 text-white">You&rsquo;re all set — sign in</h1>
            <p role="status" className="mt-3 text-[0.8125rem] leading-relaxed text-white/55">
              Your password is saved. Sign in with your email address and the password you just chose.
            </p>
            <Link
              href="/sign-in"
              className="label-xs mt-8 flex h-11 w-full items-center justify-center bg-white text-ink transition-colors hover:bg-silver"
            >
              Sign in
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
