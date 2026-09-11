"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { brand } from "@/content/media";
import {
  contact,
  navGroups,
  navLinks,
  routes,
  site,
  WHATSAPP_INTRO,
  whatsappUrl,
} from "@/content/site";
import { shell } from "./primitives";

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Image
      src={brand.logo}
      alt={site.legalName}
      priority
      sizes="300px"
      className={`h-7 w-auto sm:h-9 ${className}`}
    />
  );
}

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);

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
            ? "border-b border-hairline bg-obsidian/95 backdrop-blur-[2px]"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div
          className={`${shell} flex items-center justify-between transition-[padding] duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
            scrolled || openGroup ? "py-4" : "py-6 lg:py-7"
          }`}
        >
          <Link href={routes.home} aria-label={`${site.legalName} — home`} className="shrink-0">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-8 xl:flex" aria-label="Primary">
            {navGroups.map((group) => (
              <div
                key={group.label}
                onMouseEnter={() => setOpenGroup(group.label)}
                onFocus={() => setOpenGroup(group.label)}
              >
                <Link
                  href={group.href}
                  aria-expanded={openGroup === group.label}
                  className={`label-xs link-quiet transition-colors duration-500 hover:text-white ${
                    isActive(group.href) || openGroup === group.label
                      ? "text-white"
                      : "text-white/70"
                  }`}
                >
                  {group.label}
                </Link>
              </div>
            ))}

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onMouseEnter={() => setOpenGroup(null)}
                className={`label-xs link-quiet transition-colors duration-500 hover:text-white ${
                  isActive(link.href) ? "text-white" : "text-white/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <a
              href={contact.phoneHref}
              className="label-xs link-quiet hidden text-white/70 transition-colors duration-500 hover:text-white lg:inline-block"
            >
              {contact.phoneDisplay}
            </a>
            <Link href={routes.quote} className="btn-ghost btn-on-dark hidden !px-6 !py-3 sm:inline-flex">
              Request a quote
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="label-xs flex items-center gap-2.5 text-white xl:hidden"
              aria-label="Open menu"
              aria-expanded={open}
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
        {navGroups.map((group) => (
          <div
            key={`panel-${group.label}`}
            onMouseEnter={() => setOpenGroup(group.label)}
            className={`absolute inset-x-0 top-full hidden border-t border-hairline bg-obsidian/97 backdrop-blur-[2px] transition-[opacity,visibility] duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] xl:block ${
              openGroup === group.label
                ? "visible opacity-100"
                : "invisible opacity-0"
            }`}
          >
            <div className={`${shell} grid grid-cols-12 gap-x-12 py-10`}>
              <div className="col-span-3">
                <p className="label-xs text-white/35">{group.label}</p>
                <Link
                  href={group.href}
                  className="label-xs link-quiet mt-5 inline-block text-white"
                >
                  View overview
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
                        <span className="copy mt-1.5 block text-white/35">
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
        className={`fixed inset-0 z-60 overflow-y-auto bg-obsidian text-white transition-opacity duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] xl:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div className={`${shell} flex items-center justify-between py-6`}>
          <Wordmark />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="label-xs flex items-center gap-2.5"
            aria-label="Close menu"
          >
            <span className="relative block h-4 w-4" aria-hidden>
              <span className="absolute top-1/2 left-0 block h-px w-4 rotate-45 bg-current" />
              <span className="absolute top-1/2 left-0 block h-px w-4 -rotate-45 bg-current" />
            </span>
            Close
          </button>
        </div>

        <nav className={`${shell} mt-4 flex flex-col pb-16`} aria-label="Primary">
          {navGroups.map((group) => (
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
                <span className="label-xs text-white/40">
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
            <a href={contact.phoneHref} className="label-sm text-silver">
              {contact.phoneDisplay}
            </a>
            <a
              href={whatsappUrl(WHATSAPP_INTRO)}
              target="_blank"
              rel="noreferrer"
              className="label-sm text-silver"
            >
              WhatsApp {contact.mobileDisplay}
            </a>
            <a href={contact.emailHref} className="label-sm text-silver">
              {contact.email}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
