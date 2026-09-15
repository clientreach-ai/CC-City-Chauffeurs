"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { brand } from "@/content/brand";
import { signIn, useAuthSession } from "@/lib/auth-client";

/**
 * What to say about a failed sign-in.
 *
 * A wrong password and an unknown address get the same words on purpose —
 * saying which half was wrong tells someone probing which addresses are
 * real. Everything else is a problem the person can actually act on, so it
 * says what it is: hiding a rate limit behind "wrong password" sends people
 * round in circles.
 */
function signInError(status: number | undefined, code: string | undefined) {
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (code === "INVALID_EMAIL") return "That does not look like an email address.";
  if (status === 401 || code === "INVALID_EMAIL_OR_PASSWORD") {
    return "That email address and password do not match an account.";
  }
  if (!status) return "Could not reach the server. Check your connection and try again.";
  return "Could not sign you in. Try again.";
}

/**
 * Signing in.
 *
 * Outside the admin shell deliberately: the shell assumes a session, and
 * this is the one screen that runs without one.
 */
export default function SignInPage() {
  const router = useRouter();
  const { data, isPending } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — nothing to do here.
  useEffect(() => {
    if (!isPending && data?.user) router.replace("/dashboard");
  }, [data, isPending, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    /*
     * Read the fields from the form rather than from React state.
     *
     * A password manager filling the form on load sets the inputs directly
     * and does not always fire the events React listens for, so controlled
     * state can still be empty while the browser shows — and validates — a
     * filled field. The form element is what the browser actually has.
     */
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setError("Enter your email address and password.");
      return;
    }

    setBusy(true);
    const result = await signIn.email({ email, password });
    setBusy(false);

    if (result.error) {
      setError(signInError(result.error.status, result.error.code));
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div
      data-admin
      className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 font-ui text-white antialiased scheme-dark"
    >
      <div className="w-full max-w-[22rem]">
        <Image src={brand.logo} alt="CC City Chauffeurs" width={150} height={40} priority className="h-9 w-auto" />

        <h1 className="display-sm mt-10 text-white">Admin</h1>
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-white/55">
          Sign in to manage the fleet, the service pages and the enquiries that come in from the
          website.
        </p>

        <form onSubmit={submit} className="mt-9">
          <label htmlFor="email" className="label-xs block text-white/55">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-2 h-11 w-full border border-white/15 bg-obsidian px-3 text-[0.9375rem] text-white outline-none focus:border-white"
          />

          <label htmlFor="password" className="label-xs mt-6 block text-white/55">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 h-11 w-full border border-white/15 bg-obsidian px-3 text-[0.9375rem] text-white outline-none focus:border-white"
          />

          {error ? (
            <p role="alert" className="mt-5 text-[0.8125rem] leading-snug text-alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="label-xs mt-8 flex h-11 w-full items-center justify-center bg-white text-ink transition-colors hover:bg-silver disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
