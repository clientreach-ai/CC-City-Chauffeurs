"use client";

import { useEffect } from "react";

/**
 * The boundary above the site shell.
 *
 * `(site)/error.tsx` covers a page that fails inside the shell, but the shell
 * itself reads the settings every page is built from — navigation, telephone
 * numbers, the footer — so when that read fails there is no shell to render
 * the message in. This one owns no data at all, which is the point: it can
 * still render when nothing else can.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The site could not be loaded.", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center bg-ink px-6 font-[family-name:var(--font-ui)]">
      <div className="mx-auto w-full max-w-[52ch]">
        <p className="label-xs text-silver">City Chauffeurs</p>
        <h1 className="display-md mt-5 text-white">The site is briefly unavailable</h1>
        <p className="copy mt-6 text-white/70">
          We are having trouble loading the page. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="label-xs mt-10 text-white underline-offset-8 hover:underline"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
