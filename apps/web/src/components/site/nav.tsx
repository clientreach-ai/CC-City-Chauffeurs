"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { brand } from "@/content/brand";
import { navLinks, routes, type NavGroup } from "@/content/site";

/** Everything the navigation needs about the business, from site settings. */
export type NavBusiness = {
  name: string;
  legalName: string;
  phoneDisplay: string;
  whatsappDisplay: string;
  email: string;
  tel: string;
  mailto: string;
  whatsapp: string;
};
import { PhoneIcon, WhatsAppIcon } from "./icons";
import { shell } from "@CC-City-Chauffeurs/ui/site/primitives";

function Wordmark({ alt, className = "" }: { alt: string; className?: string }) {
  return (
    <Image
      src={brand.logo}
      alt={alt}
      sizes="300px"
      className={`h-7 w-auto sm:h-9 ${className}`}
    />
  );
}

export function Nav({ groups, business }: { groups: readonly NavGroup[]; business: NavBusiness }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // The full-screen menu behaves as a dialog: focus moves in when it opens,
  // Escape closes it, and focus returns to the button that opened it.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeButtonRef.current?.focus();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      menuButtonRef.current?.focus();
    }
  }, [open]);

  // Close everything when the route changes
  useEffect(() => {
    setOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        onMouseLeave={() => setOpenGroup(null)}
        className={`fixed inset-x-0 top-0 z-50 text-white transition-[background-color,border-color,backdrop-filter] duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
          (scrolled || openGroup) && !open
            ? "border-b border-hairline bg-obsidian/95 backdrop-blur-[6px]"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        {/* Contrast guarantee while the bar is transparent over the hero */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(6,6,7,0.65)_0%,rgba(6,6,7,0)_100%)] transition-opacity duration-700 ${
            scrolled || openGroup ? "opacity-0" : "opacity-100"
          }`}
        />

        <div
          className={`${shell} relative flex items-center justify-between transition-[padding] duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
            scrolled || openGroup ? "py-4" : "py-5 lg:py-6"
          }`}
        >
          <Link href={routes.home} aria-label={`${business.legalName} — home`} className="shrink-0">
            <Wordmark alt={business.legalName} />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {groups.map((group) => {
              const expanded = openGroup === group.label;
              const here = isActive(group.href);
              return (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => setOpenGroup(group.label)}
                >
                  {/*
                    A disclosure button, not a link. It carries a chevron so it
                    is visibly different from a plain destination, and it opens
                    on click as well as hover — hover alone is unusable on a
                    touchscreen, where the old link simply navigated away.
                    The destination itself is the "Overview" link inside.
                  */}
                  <button
                    type="button"
                    onClick={() => setOpenGroup(expanded ? null : group.label)}
                    aria-expanded={expanded}
                    aria-haspopup="true"
                    className={`label-xs flex h-11 items-center gap-2 transition-colors duration-400 hover:text-white ${
                      here || expanded ? "text-white" : "text-white/70"
                    }`}
                  >
                    {group.label}
                    <svg
                      aria-hidden
                      viewBox="0 0 10 6"
                      className={`h-[5px] w-[9px] transition-transform duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                        expanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    >
                      <path d="M1 1l4 4 4-4" strokeLinecap="square" />
                    </svg>
                  </button>
                  {/* Where you are, stated plainly */}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-white transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                      here ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </div>
              );
            })}

            {navLinks.map((link) => {
              const here = isActive(link.href);
              return (
                <div key={link.href} className="relative">
                  <Link
                    href={link.href}
                    onMouseEnter={() => setOpenGroup(null)}
                    aria-current={here ? "page" : undefined}
                    className={`label-xs flex h-11 items-center transition-colors duration-400 hover:text-white ${
                      here ? "text-white" : "text-white/70"
                    }`}
                  >
                    {link.label}
                  </Link>
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-white transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                      here ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-6">
            {/* Call and WhatsApp as a matched pair of quiet icon buttons —
                recognisable marks, drawn in the site's own white and silver. */}
            <div className="flex items-center gap-2">
              <a
                href={business.tel}
                aria-label={`Call ${business.name} on ${business.phoneDisplay}`}
                title={`Call ${business.phoneDisplay}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-white/25 text-white/75 transition-colors duration-500 hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
              >
                <PhoneIcon className="h-[19px] w-[19px]" />
              </a>
              <a
                href={business.whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label={`WhatsApp ${business.name} on ${business.whatsappDisplay}`}
                title="Message us on WhatsApp"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-white/25 text-white/75 transition-colors duration-500 hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
              >
                <WhatsAppIcon className="h-[18px] w-[18px]" />
              </a>
            </div>
            <Link
              href={routes.quote}
              className="btn-ghost btn-solid-invert hidden !min-h-11 !px-6 !py-3 sm:inline-flex"
            >
              Request a quote
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setOpen(true)}
              className="label-xs flex min-h-11 items-center gap-2.5 text-white lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="site-menu"
            >
              <span className="flex flex-col gap-[5px]" aria-hidden>
                <span className="block h-px w-6 bg-current" />
                <span className="block h-px w-6 bg-current" />
              </span>
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>

        {/* Dropdown panel — a hairline sheet, not a mega-menu */}
        {groups.map((group) => (
          <div
            key={`panel-${group.label}`}
            onMouseEnter={() => setOpenGroup(group.label)}
            className={`absolute inset-x-0 top-full hidden border-t border-hairline bg-obsidian/97 backdrop-blur-[2px] transition-[opacity,visibility] duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] lg:block ${
              openGroup === group.label
                ? "visible opacity-100"
                : "invisible opacity-0"
            }`}
          >
            <div className={`${shell} grid grid-cols-12 gap-x-12 py-10`}>
              <div className="col-span-3">
                <p className="label-xs text-white/50">{group.label}</p>
                <Link
                  href={group.href}
                  className="label-xs link-quiet mt-5 inline-flex items-center gap-2.5 text-white"
                >
                  All {group.label.toLowerCase()} services
                  <span aria-hidden>→</span>
                </Link>
              </div>
              <ul className="col-span-9 grid grid-cols-3 gap-x-10 gap-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group block border-t border-hairline py-4"
                    >
                      <span className="label-sm block text-white/85 transition-colors duration-500 group-hover:text-white">
                        {item.label}
                      </span>
                      {item.note ? (
                        <span className="copy mt-1.5 block text-white/50">
                          {item.note}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </header>

      {/* Full-screen menu — the same editorial language, nothing decorative */}
      <div
        className={`fixed inset-0 z-60 overflow-y-auto bg-obsidian text-white transition-opacity duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        // Closed, the menu is out of the tab order and the accessibility tree
        // entirely — not merely transparent.
        inert={!open}
      >
        <div className={`${shell} flex items-center justify-between py-6`}>
          <Wordmark alt={business.legalName} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            className="label-xs flex min-h-11 items-center gap-2.5"
            aria-label="Close menu"
          >
            <span className="relative block h-4 w-4" aria-hidden>
              <span className="absolute top-1/2 left-0 block h-px w-4 rotate-45 bg-current" />
              <span className="absolute top-1/2 left-0 block h-px w-4 -rotate-45 bg-current" />
            </span>
            Close
          </button>
        </div>

        <nav className={`${shell} mt-4 flex flex-col pb-16`} aria-label="Menu">
          {groups.map((group) => (
            <div key={group.label} className="border-t border-hairline">
              <button
                type="button"
                onClick={() =>
                  setMobileGroup(mobileGroup === group.label ? null : group.label)
                }
                className="flex w-full items-center justify-between py-5 text-left"
                aria-expanded={mobileGroup === group.label}
              >
                <span className="display-md text-white/90">{group.label}</span>
                <span className="label-xs text-white/55">
                  {mobileGroup === group.label ? "Close" : "View"}
                </span>
              </button>

              {mobileGroup === group.label ? (
                <ul className="pb-4">
                  <li>
                    <Link
                      href={group.href}
                      onClick={() => setOpen(false)}
                      className="label-xs block border-t border-hairline py-3.5 text-silver"
                    >
                      Overview
                    </Link>
                  </li>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="label-xs block border-t border-hairline py-3.5 text-white/70"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="display-md border-t border-hairline py-5 text-white/90"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href={routes.quote}
            onClick={() => setOpen(false)}
            className="display-md border-y border-hairline py-5 text-white"
          >
            Request a quote
          </Link>

          <div className="mt-10 flex flex-col gap-3">
            <a href={business.tel} className="label-sm flex items-center gap-3 text-silver">
              <PhoneIcon className="h-4 w-4" />
              {business.phoneDisplay}
            </a>
            <a
              href={business.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="label-sm flex items-center gap-3 text-silver"
            >
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp {business.whatsappDisplay}
            </a>
            <a href={business.mailto} className="label-sm text-silver">
              {business.email}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
