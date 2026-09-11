import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { shareImage } from "@/content/seo";
import { site } from "@/content/site";

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

export const metadata: Metadata = {
  // Resolves every relative canonical and social URL against the live domain.
  metadataBase: new URL(site.url),
  title: "CC City Chauffeurs | Luxury Chauffeur Service, London",
  description:
    "A luxury, discreet way of travelling — without the hassle. Chauffeur services across London, the UK and Europe.",
  applicationName: site.legalName,
  openGraph: {
    siteName: site.legalName,
    locale: "en_GB",
    type: "website",
    images: [shareImage],
  },
  twitter: { card: "summary_large_image", images: [shareImage] },
  // Phone numbers on the page are real links already; stop iOS restyling them.
  formatDetection: { telephone: false },
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
      className={`${cormorant.variable} ${manrope.variable}`}
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
