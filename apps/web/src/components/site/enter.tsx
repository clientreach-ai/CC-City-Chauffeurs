import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * A CSS-only entrance for content that is on screen at first paint — the hero.
 * Unlike `Reveal` it does not wait for hydration, so the display typography is
 * never held back by JavaScript.
 */
export function Enter({
  children,
  delay = 0,
  variant = "lift",
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  variant?: "lift" | "image";
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag
      className={`${variant === "image" ? "enter-image" : "enter"} ${className}`}
      style={{ "--enter-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
