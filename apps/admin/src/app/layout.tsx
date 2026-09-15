import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import "../index.css";
import { Providers } from "./providers";

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
  title: {
    template: "%s · Admin · City Chauffeurs",
    default: "Admin · City Chauffeurs",
  },
  // Internal tool: never indexed, never followed, never previewed.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" suppressHydrationWarning className={`${cormorant.variable} ${manrope.variable}`}>
      <body className="bg-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
