"use client";

import Image from "next/image";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Car,
  ConciergeBell,
  ExternalLink,
  Images,
  Inbox,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  Quote,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { Hint } from "@/components/admin/ui/hint";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { brand } from "@/content/brand";
import { useCmsQuery } from "@/lib/cms/hooks";
import { roles, type Capability } from "@/lib/cms/permissions";
import { getEnquiries } from "@/lib/cms/repositories/operations";

import { usePreferences } from "./preferences";
import { adminRoutes } from "./routes";

type NavItem = {
  label: string;
  href: Route;
  icon: LucideIcon;
  /** Hidden from roles without this capability. */
  requires?: Capability;
  exact?: boolean;
};

const sections: { label?: string; items: NavItem[] }[] = [
  { items: [{ label: "Overview", href: adminRoutes.dashboard, icon: LayoutDashboard, exact: true }] },
  {
    label: "Operations",
    items: [
      { label: "Enquiries", href: adminRoutes.enquiries, icon: Inbox, requires: "operations.view" },
      { label: "Bookings", href: adminRoutes.bookings, icon: CalendarClock, requires: "operations.view" },
      { label: "Customers", href: adminRoutes.customers, icon: Users, requires: "operations.view" },
    ],
  },
  {
    label: "Website",
    items: [
      { label: "Fleet", href: adminRoutes.fleet, icon: Car },
      { label: "Services", href: adminRoutes.services, icon: ConciergeBell },
      { label: "Gallery", href: adminRoutes.gallery, icon: Images },
      { label: "Testimonials", href: adminRoutes.testimonials, icon: Quote },
      { label: "Content", href: adminRoutes.content, icon: PanelsTopLeft },
    ],
  },
  { label: "System", items: [{ label: "Settings", href: adminRoutes.settings, icon: Settings }] },
];

function useNewEnquiries(enabled: boolean) {
  const { data } = useCmsQuery("sidebar:new-enquiries", async () =>
    enabled ? (await getEnquiries()).filter((item) => item.status === "new").length : 0,
  );
  return data ?? 0;
}

/**
 * The navigation itself, shared by the desktop sidebar and the mobile
 * drawer. `collapsed` draws icons only, with the label as a tooltip.
 */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = usePreferences();
  const unanswered = useNewEnquiries(can("operations.view"));

  const active = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <nav aria-label="Admin" className="flex flex-col gap-6">
      {sections.map((section) => {
        const items = section.items.filter((item) => !item.requires || can(item.requires));
        if (!items.length) return null;
        return (
          <div key={section.label ?? "top"}>
            {section.label ? (
              collapsed ? (
                <span aria-hidden className="mx-auto mb-2 block h-px w-5 bg-hairline" />
              ) : (
                <p className="label-xs mb-2 px-3 text-white/50">{section.label}</p>
              )
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const here = active(item);
                const Icon = item.icon;
                const count = item.href === adminRoutes.enquiries ? unanswered : 0;
                const link = (
                  <GuardedLink
                    href={item.href}
                    aria-current={here ? "page" : undefined}
                    aria-label={collapsed ? `${item.label}${count ? `, ${count} new` : ""}` : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 text-[0.8125rem] transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
                      collapsed ? "mx-auto w-10 justify-center" : "px-3",
                      here ? "bg-white/7.000000000000001 text-white" : "text-white/65 hover:bg-white/4 hover:text-white",
                    )}
                  >
                    {/* The current page is marked with a hairline, as on the public navigation. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-2 left-0 w-px bg-white transition-opacity duration-300",
                        here ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className="size-4.5 shrink-0" strokeWidth={1.5} aria-hidden />
                    {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
                    {count ? (
                      collapsed ? (
                        <span aria-hidden className="absolute top-2 right-2 size-1.5 bg-white" />
                      ) : (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center bg-white px-1.5 text-[0.6875rem] font-medium text-ink tabular-nums">
                          {count}
                          <span className="sr-only"> new</span>
                        </span>
                      )
                    ) : null}
                  </GuardedLink>
                );
                return (
                  <li key={item.href}>
                    <Hint content={count ? `${item.label} · ${count} new` : item.label} side="right" disabled={!collapsed}>
                      {link}
                    </Hint>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="font-display text-[1.375rem] leading-none font-light tracking-[0.02em] text-white" aria-label="City Chauffeurs">
        CC
      </span>
    );
  }
  return <Image src={brand.logo} alt="CC City Chauffeurs" sizes="200px" className="h-7 w-auto" priority />;
}

function RoleSwitcher({ collapsed }: { collapsed: boolean }) {
  const { role, setRole } = usePreferences();
  if (collapsed) return null;
  return (
    <div className="px-3">
      <label htmlFor="admin-role" className="label-xs text-white/50">
        Preview as
      </label>
      <select
        id="admin-role"
        value={role}
        onChange={(event) => setRole(event.target.value as typeof role)}
        aria-describedby="admin-role-note"
        className="mt-2 h-9 w-full cursor-pointer rounded-[2px] border border-white/15 bg-obsidian px-2.5 text-[0.8125rem] text-white focus:border-white focus:outline-none [&>option]:bg-ink"
      >
        {roles.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p id="admin-role-note" className="mt-2 text-[0.6875rem] leading-snug text-white/50">
        {roles.find((option) => option.value === role)?.summary} Not enforced — there is no sign-in yet.
      </p>
    </div>
  );
}

export function Sidebar() {
  const { collapsed, setCollapsed } = usePreferences();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-hairline bg-obsidian transition-[width] duration-300 ease-editorial motion-reduce:transition-none lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b border-hairline", collapsed ? "justify-center" : "px-5")}>
        <GuardedLink href={adminRoutes.dashboard} aria-label="City Chauffeurs admin — overview" className="flex items-center">
          <Wordmark compact={collapsed} />
        </GuardedLink>
      </div>

      <div className="flex-1 overflow-y-auto py-5 [scrollbar-width:thin]">
        <div className={collapsed ? "" : "px-2"}>
          <SidebarNav collapsed={collapsed} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-4 border-t border-hairline py-4">
        <RoleSwitcher collapsed={collapsed} />
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "justify-between px-2")}>
          <Hint content="View the website" side="right" disabled={!collapsed}>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              aria-label={collapsed ? "View the website (opens in a new tab)" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 text-[0.8125rem] text-white/65 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white",
                collapsed ? "w-10 justify-center" : "px-3",
              )}
            >
              <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
              {collapsed ? null : (
                <>
                  View website<span className="sr-only"> (opens in a new tab)</span>
                </>
              )}
            </a>
          </Hint>
          <Hint content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="flex size-9 items-center justify-center text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" strokeWidth={1.5} aria-hidden />
              ) : (
                <PanelLeftClose className="size-4" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </Hint>
        </div>
      </div>
    </aside>
  );
}

export { RoleSwitcher };
