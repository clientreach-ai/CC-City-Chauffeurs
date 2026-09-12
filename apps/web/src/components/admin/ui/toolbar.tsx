"use client";

import { Search, X } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { controlClass, Select } from "./form";

/** The row of search and filters above a list. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 pb-5 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>
  );
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        className={cn(controlClass, "h-10 pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center text-white/55 hover:text-white focus-visible:outline-1 focus-visible:outline-white"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  label: string;
  value: T | "all";
  onChange: (value: T | "all") => void;
  options: readonly { value: T; label: string }[];
  allLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full sm:w-52", className)}>
      <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T | "all")}>
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Status filter as a row of pressed/unpressed buttons with counts — the
 * pipeline at a glance, and one tap to narrow it.
 */
export function SegmentedFilter<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <div className="flex min-w-max border-b border-hairline">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative -mb-px flex h-11 items-center gap-2 border-b px-3.5 text-[0.8125rem] transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
                active ? "border-white text-white" : "border-transparent text-white/60 hover:text-white",
              )}
            >
              {option.label}
              {option.count != null ? (
                <span className={cn("text-[0.75rem] tabular-nums", active ? "text-silver" : "text-white/45")}>
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "12 vehicles" — result count, announced when filters change. */
export function ResultCount({ count, noun, total }: { count: number; noun: [string, string]; total?: number }) {
  return (
    <p className="text-[0.8125rem] text-white/55 sm:ml-auto" aria-live="polite">
      {count} {count === 1 ? noun[0] : noun[1]}
      {total != null && total !== count ? ` of ${total}` : ""}
    </p>
  );
}

/** Bulk actions bar shown while rows are selected. */
export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 border border-hairline-strong bg-graphite px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
    >
      <p className="text-[0.8125rem] text-white">
        {count} selected
      </p>
      <button
        type="button"
        onClick={onClear}
        className="text-[0.8125rem] text-white/60 underline-offset-4 hover:text-white hover:underline"
      >
        Clear
      </button>
      <div className="flex flex-wrap gap-2 sm:ml-auto">{children}</div>
    </div>
  );
}
