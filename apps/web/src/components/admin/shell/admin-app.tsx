"use client";

import { usePathname } from "next/navigation";
import { ExternalLink, Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { TooltipProvider } from "@CC-City-Chauffeurs/ui/components/tooltip";
import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { ConfirmProvider, Dialog } from "@/components/admin/ui/dialog";
import { AdminToaster } from "@/components/admin/ui/toast";
import { GuardedLink, UnsavedChangesProvider } from "@/components/admin/ui/unsaved";
import { configureDatabase } from "@/lib/cms/store/database";
import type { ContentSeed } from "@/lib/cms/types";

import { PreferencesProvider, usePreferences } from "./preferences";
import { adminRoutes } from "./routes";
import { RoleSwitcher, Sidebar, SidebarNav, Wordmark } from "./sidebar";

/**
 * The admin application shell: providers, sidebar, top bar, and the notice
 * that says plainly what this preview is and is not.
 */
export function AdminApp({ seed, children }: { seed: ContentSeed; children: ReactNode }) {
  // Hands the server-built seed to the mock database. Idempotent.
  configureDatabase(seed);

  return (
    <PreferencesProvider>
      <ConfirmProvider>
        <UnsavedChangesProvider>
          <TooltipProvider delay={250}>
            <Frame>{children}</Frame>
            <AdminToaster />
          </TooltipProvider>
        </UnsavedChangesProvider>
      </ConfirmProvider>
    </PreferencesProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { collapsed } = usePreferences();
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the page changes underneath it.
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  return (
    <div data-admin className="min-h-dvh bg-ink font-ui text-white antialiased scheme-dark">
      <a
        href="#admin-content"
        className="label-xs sr-only fixed top-3 left-3 z-70 bg-white px-5 py-3.5 text-ink focus:not-sr-only"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className={cn("transition-[padding] duration-300 ease-editorial motion-reduce:transition-none", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-hairline bg-ink/95 px-3 backdrop-blur-[6px] sm:px-6 lg:h-12 lg:px-10">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
            aria-expanded={drawer}
            className="flex size-10 items-center justify-center text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-white lg:hidden"
          >
            <Menu className="size-5" strokeWidth={1.5} aria-hidden />
          </button>
          <GuardedLink href={adminRoutes.dashboard} aria-label="City Chauffeurs admin — overview" className="flex items-center lg:hidden">
            <Wordmark />
          </GuardedLink>

          <p className="hidden min-w-0 flex-1 items-center gap-3 text-[0.75rem] text-white/60 sm:flex">
            <span className="label-xs shrink-0 border border-white/30 px-2 py-1 text-[0.5625rem] text-white">Preview</span>
            <span className="truncate">
              No sign-in and no server yet — changes are kept in this browser and do not change the live website.
            </span>
          </p>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="ml-auto hidden shrink-0 items-center gap-2 text-[0.75rem] text-white/65 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white lg:flex"
          >
            View website
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </header>

        {/* Phones: the preview notice gets its own line rather than being dropped. */}
        <p className="border-b border-hairline px-4 py-2 text-[0.75rem] leading-snug text-white/60 sm:hidden">
          <span className="font-medium text-white">Preview.</span> Changes stay in this browser and do not change the
          live website.
        </p>

        <main id="admin-content" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>

      <Dialog open={drawer} onClose={() => setDrawer(false)} title="Navigation" variant="drawer" hideHeader bodyClassName="p-0 flex flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
          <Wordmark />
          <button
            type="button"
            onClick={() => setDrawer(false)}
            className="label-xs flex h-10 items-center text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-5">
          <SidebarNav onNavigate={() => setDrawer(false)} />
        </div>
        <div className="border-t border-hairline py-4">
          <RoleSwitcher collapsed={false} />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex h-10 items-center gap-2 px-5 text-[0.8125rem] text-white/65 hover:text-white"
          >
            <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
            View website<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </Dialog>
    </div>
  );
}
