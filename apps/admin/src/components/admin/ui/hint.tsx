"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@CC-City-Chauffeurs/ui/components/tooltip";
import type { ReactElement, ReactNode } from "react";

/**
 * A tooltip in the brand treatment. The trigger element is rendered as-is
 * (a link, a button) — it must already carry its own accessible name; the
 * tooltip only repeats it visually.
 */
export function Hint({
  content,
  children,
  side = "top",
  disabled,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}) {
  if (disabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger delay={250} render={children} />
      <TooltipContent
        side={side}
        sideOffset={8}
        className="rounded-none border border-hairline-strong bg-graphite px-2.5 py-1.5 font-ui text-[0.75rem] text-white [&>svg]:hidden"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
