"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { brand } from "@/content/brand";
import { signIn, useAuthSession } from "@/lib/auth-client";

/**
 * Signing in.
 *
 * Outside the admin shell deliberately: the shell assumes a session, and
 * this is the one screen that runs without one.
 */
export default function SignInPage() {
  const router = useRouter();
  const { data, isPending } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — nothing to do here.
  useEffect(() => {
    if (!isPending && data?.user) router.replace("/dashboard");
  }, [data, isPending, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn.email({ email: email.trim(), password });
    if (result.error) {
      // Never say which half was wrong — that tells an attacker which
      // addresses are real.
      setError("That email address and password do not match an account.");
      setBusy(false);
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
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-11 w-full border border-white/15 bg-obsidian px-3 text-[0.9375rem] text-white outline-none focus:border-white"
          />

          <label htmlFor="password" className="label-xs mt-6 block text-white/55">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
