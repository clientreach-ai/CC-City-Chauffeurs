"use client";

import { track } from "@vercel/analytics";
import { useEffect } from "react";

/**
 * Counts taps on the ways to reach the office — call, WhatsApp, email.
 *
 * Most enquiries never touch the form: they arrive as a phone call or a
 * WhatsApp message (PRD §10.14 asks for phone enquiries to be counted too).
 * One listener on the document covers every such link on every page — the
 * header, the contact bar, the footer, the contact page — without each of
 * them having to know about analytics. Only the channel and the page are
 * recorded; never the number or anything the visitor typed.
 */
function channelOf(href: string) {
  if (href.startsWith("tel:")) return "phone";
  if (href.startsWith("mailto:")) return "email";
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) return "whatsapp";
  return null;
}

export function ContactTracking() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      const channel = channelOf(link.getAttribute("href") ?? "");
      if (channel) track("Contact tap", { channel, page: window.location.pathname });
    };
    // Capture phase, so a link that stops propagation is still counted.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
