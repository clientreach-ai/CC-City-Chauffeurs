"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@CC-City-Chauffeurs/ui/components/dropdown-menu";
import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

export type MenuAction =
  | {
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      tone?: "default" | "danger";
      disabled?: boolean;
      /** Why it is disabled, read after the label. */
      reason?: string;
    }
  | "separator";

/**
 * Row actions behind a single "…" button. Keyboard and screen-reader
 * behaviour (arrow keys, Escape, focus return) comes from Base UI's menu.
 */
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="inline-flex size-9 items-center justify-center rounded-[2px] text-white/65 transition-colors duration-300 hover:bg-white/7.000000000000001 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[popup-open]:bg-white/7.000000000000001 data-[popup-open]:text-white"
      >
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-52 rounded-none border border-hairline-strong bg-graphite p-1 text-white shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-0"
      >
        {actions.map((action, i) =>
          action === "separator" ? (
            <DropdownMenuSeparator key={`sep-${i}`} className="mx-0 my-1 bg-hairline" />
          ) : (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              onClick={action.onSelect}
              className={`gap-2.5 px-3 py-2.5 font-ui text-[0.8125rem] focus:bg-white/8 ${
                action.tone === "danger"
                  ? "text-alert focus:text-alert [&_svg]:text-alert"
                  : "text-white/85 focus:text-white [&_svg]:text-white/60"
              }`}
            >
              {action.icon}
              <span className="flex flex-col">
                <span>{action.label}</span>
                {action.disabled && action.reason ? (
                  <span className="text-[0.6875rem] text-white/55">{action.reason}</span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
