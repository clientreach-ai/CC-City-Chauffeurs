"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The site failed to load.", error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          backgroundColor: "#0b0b0c",
          color: "#ffffff",
          padding: "0 1.5rem",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif",
        }}
      >
        <main style={{ margin: "0 auto", width: "100%", maxWidth: "52ch" }}>
          <p
            style={{
              margin: 0,
              color: "#c9cbcd",
              fontSize: "0.6875rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            City Chauffeurs
          </p>

          <h1
            style={{
              margin: "1.25rem 0 0",
              fontFamily: "Cormorant Garamond, Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            The site is briefly unavailable
          </h1>

          <p style={{ margin: "1.5rem 0 0", color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            We are having trouble loading the page. Please try again in a moment. If you would rather
            speak to somebody, telephone the office and a member of the team will help.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              margin: "2.5rem 0 0",
              padding: 0,
              border: 0,
              background: "none",
              color: "#ffffff",
              font: "inherit",
              fontSize: "0.6875rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textUnderlineOffset: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
