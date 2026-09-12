import Link from "next/link";
import type { Route } from "next";

import { Reveal } from "./reveal";

type Tone = "dark" | "light";

const bodyTone = {
  dark: "text-white/65",
  light: "text-slate",
} as const;

/**
 * Numbered hairline rows — the site's alternative to a grid of cards.
 *
 * In a module of its own (no content imports) so the admin's service preview
 * renders with it too.
 */
export function IndexRows({
  rows,
  tone = "dark",
  columns = 1,
}: {
  rows: readonly { title: string; copy: string; index?: string; href?: string }[];
  tone?: Tone;
  columns?: 1 | 2;
}) {
  return (
    <ul className={columns === 2 ? "grid grid-cols-1 gap-x-16 md:grid-cols-2" : ""}>
      {rows.map((row, i) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <h3
                className={`display-sm transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-x-1.5 ${
                  tone === "dark" ? "text-white" : "text-ink"
                }`}
              >
                {row.title}
              </h3>
              {row.index ? (
                <span
                  className={`label-xs shrink-0 ${
                    tone === "dark" ? "text-white/50" : "text-slate/60"
                  }`}
                >
                  {row.index}
                </span>
              ) : null}
            </div>
            <p className={`copy mt-3 max-w-[56ch] ${bodyTone[tone]}`}>{row.copy}</p>
          </>
        );

        return (
          <Reveal
            as="li"
            key={row.title}
            delay={Math.min(i * 50, 250)}
            className={`group border-t last:border-b ${
              tone === "dark" ? "border-hairline" : "border-hairline-ink"
            }`}
          >
            {row.href ? (
              <Link href={row.href as Route} className="block py-7 sm:py-9">
                {inner}
              </Link>
            ) : (
              <div className="py-7 sm:py-9">{inner}</div>
            )}
          </Reveal>
        );
      })}
    </ul>
  );
}
