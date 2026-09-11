"use client";

import { useEffect, useState } from "react";

import { contact, whatsappUrl } from "@/content/site";
import { WhatsAppIcon } from "./icons";

const WHATSAPP_INTRO =
  "Hello City Chauffeurs, I'd like to enquire about a chauffeur booking.";

/**
 * A single quiet contact affordance on small screens — the client loses
 * enquiries to slow contact, and on a phone the nav bar's Enquire link is the
 * first thing to disappear.
 */
export function ContactBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-obsidian/95 backdrop-blur-[2px] transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="grid grid-cols-2 divide-x divide-hairline">
        <a
          href={contact.phoneHref}
          className="label-xs flex items-center justify-center py-4 text-white/70"
        >
          Call the office
        </a>
        <a
          href={whatsappUrl(WHATSAPP_INTRO)}
          target="_blank"
          rel="noreferrer"
          className="label-xs flex items-center justify-center gap-2.5 py-4 text-white"
        >
          <WhatsAppIcon className="h-4 w-4" />
          WhatsApp us
        </a>
      </div>
    </div>
  );
}
