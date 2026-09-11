import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

/**
 * Display face — an editorial serif set in sentence case.
 *
 * Newsreader is a broadsheet face: it reads considered and trustworthy rather
 * than decorative, which is what the brief asks for ("easiest to read",
 * "corporate and reliable", never "intimidating"). Optical sizing is on, so
 * large settings thin naturally without us shipping a second weight.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  display: "swap",
});

/** UI face — navigation, labels and body copy. Neutral by design. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CC City Chauffeurs",
  description:
    "A luxury, discreet way of travelling — without the hassle. Chauffeur services across London, the UK and Europe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${newsreader.variable} ${inter.variable}`}
    >
      <head>
        {/*
          Marks the document as scripted before first paint, so scroll-reveal
          styles only ever hide content that JavaScript can bring back.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("js")`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
