import { Cormorant_Garamond, Manrope } from "next/font/google";

import "../index.css";
import { siteMetadata } from "@/lib/metadata";

/** Display face — light weight, high contrast, set uppercase at large sizes. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
});

/** UI face — navigation, labels and body copy. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Base URL, default title and description, and share card — from the admin's SEO settings. */
export const generateMetadata = siteMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      // Smooth scrolling is for in-page anchors; page changes jump to the top.
      data-scroll-behavior="smooth"
      // The inline script below adds "js" before React hydrates.
      suppressHydrationWarning
      // One theme: the site is designed on black and has no light variant, so
      // the shared UI tokens are pinned to their dark values.
      className={`dark ${cormorant.variable} ${manrope.variable}`}
    >
      <head>
        {/*
          Marks the document as scripted before first paint, so scroll-reveal
          styles only ever hide content that JavaScript can bring back.

          "Scripted" is a promise the bundle still has to keep. If it never
          runs — a chunk that failed on a weak signal, a blocked script — the
          hidden sections would stay hidden, the enquiry form among them. So
          once the page has loaded, a reveal that has not reported in (see
          `Reveal`) takes the class back off and everything simply shows.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("js");addEventListener("load",function(){setTimeout(function(){if(!window.__revealReady)document.documentElement.classList.remove("js")},3000)})`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
