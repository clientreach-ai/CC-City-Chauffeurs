"use client";

import { useEffect } from "react";
import Link from "next/link";

import { routes } from "@/content/site";
import { shell } from "@CC-City-Chauffeurs/ui/site/primitives";

/**
 * When a page cannot be built.
 *
 * Every page here renders records fetched from the API, and a read that fails
 * for any reason other than "this record does not exist" throws rather than
 * quietly turning into a 404. Without this the visitor would get the runtime's
 * own error page — unstyled, unbranded, and with no way back to the site or to
 * a telephone number. The journey they were about to book is worth more than
 * the page they happened to be on, so the contact routes stay in front of them.
 *
 * The section frame is written out here rather than taken from
 * `components/site/sections`: that module also holds the bands that read the
 * API, so it carries `server-only` transitively, and a client component may
 * not import it — doing so refuses to compile and takes every page with it.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this to the server log; the visitor never sees it.
    console.error("The page could not be loaded.", error);
  }, [error]);

  return (
    <section className="bg-ink text-white">
      <div className={`${shell} pt-28 pb-24 lg:pt-36 lg:pb-36`}>
        <p className="label-xs text-silver">Something went wrong</p>
        <h1 className="display-md mt-5 max-w-[18ch] text-white">This page could not be loaded</h1>
        <p className="copy mt-6 max-w-[52ch] text-white/70">
          The fault is ours, not yours. Try again in a moment — or call the office and we will
          arrange your journey directly.
        </p>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
          <button type="button" onClick={reset} className="label-xs text-white underline-offset-8 hover:underline">
            Try again
          </button>
          <Link href={routes.contact} className="label-xs text-white/70 underline-offset-8 hover:underline">
            Contact us
          </Link>
          <Link href={routes.home} className="label-xs text-white/70 underline-offset-8 hover:underline">
            Back to the homepage
          </Link>
        </div>
      </div>
    </section>
  );
}
