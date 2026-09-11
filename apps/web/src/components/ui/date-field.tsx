"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A date field with our own calendar.
 *
 * The native `<input type="date">` picker cannot be styled — it renders the
 * operating system's own panel, which on this site reads as a stray piece of
 * browser chrome dropped into an otherwise composed page. This replaces it
 * with a panel built from the site's own materials.
 *
 * No date library: the arithmetic here is a month grid and a day comparison,
 * which is not worth 12kb of dependency.
 *
 * Behaviour it keeps from the native control:
 *   · a real `<input type="hidden">` carrying `YYYY-MM-DD`, so it posts and
 *     pre-fills exactly as before
 *   · full keyboard control — arrows move by day/week, PageUp/Down by month,
 *     Enter selects, Escape closes and returns focus
 *   · past dates are unselectable; bookings cannot be made backwards
 */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => iso(a) === iso(b);
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

/** Monday-first grid covering the whole month, padded to complete weeks. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function DateField({
  id,
  name,
  value,
  onChange,
  label,
  className = "",
}: {
  id: string;
  name?: string;
  /** `YYYY-MM-DD`, or "" for empty. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = value ? startOfDay(new Date(`${value}T00:00:00`)) : null;

  // The day the keyboard is currently on — not necessarily the chosen one.
  const [cursor, setCursor] = useState<Date>(selected ?? today);
  const [month, setMonth] = useState<Date>(
    new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1),
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  const choose = useCallback(
    (day: Date) => {
      if (day < today) return;
      onChange(iso(day));
      close();
    },
    [onChange, today, close],
  );

  // Close on outside click, and on Escape from anywhere in the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Move focus into the grid when the panel opens.
  useEffect(() => {
    if (open) gridRef.current?.focus();
  }, [open]);

  const move = (next: Date) => {
    const day = next < today ? today : next;
    setCursor(day);
    if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    }
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(addDays(cursor, -1)),
      ArrowRight: () => move(addDays(cursor, 1)),
      ArrowUp: () => move(addDays(cursor, -7)),
      ArrowDown: () => move(addDays(cursor, 7)),
      PageUp: () => move(addMonths(cursor, -1)),
      PageDown: () => move(addMonths(cursor, 1)),
      Home: () => move(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      End: () => move(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
      Enter: () => choose(cursor),
      " ": () => choose(cursor),
    };
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  const days = monthGrid(month);
  const canGoBack = month > new Date(today.getFullYear(), today.getMonth(), 1);

  const display = selected
    ? selected.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Select a date";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label}: ${display}`}
        className={`flex w-full items-center justify-between gap-3 py-2 text-left font-[family-name:var(--font-ui)] text-[0.9375rem] transition-colors duration-500 ${
          selected ? "text-white" : "text-white/50"
        } hover:text-white`}
      >
        <span className="truncate">{display}</span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        >
          <path d="M3 6l5 5 5-5" strokeLinecap="square" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label={label}
          className="tile-in glow-edge glow-ring absolute top-full left-0 z-50 mt-3 w-[19rem] max-w-[calc(100vw-2rem)] bg-elevated/98 p-5 backdrop-blur-sm"
        >
          {/* Month header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="flex h-9 w-9 items-center justify-center text-white/55 transition-colors duration-400 hover:text-white disabled:pointer-events-none disabled:opacity-25"
            >
              <span aria-hidden>←</span>
            </button>

            <p aria-live="polite" className="label-sm text-white">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </p>

            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Next month"
              className="flex h-9 w-9 items-center justify-center text-white/55 transition-colors duration-400 hover:text-white"
            >
              <span aria-hidden>→</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 border-b border-hairline pb-2">
            {WEEKDAYS.map((d, i) => (
              <span
                key={`${d}-${i}`}
                aria-hidden
                className="label-xs text-center text-white/45"
              >
                {d}
              </span>
            ))}
          </div>

          {/*
            One tab stop for the whole grid, with a roving cursor inside it —
            the pattern screen-reader users expect from a date picker, and far
            less tabbing than 42 focusable cells.
          */}
          <div
            ref={gridRef}
            role="grid"
            aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
            tabIndex={0}
            onKeyDown={onGridKey}
            className="mt-2 grid grid-cols-7 gap-y-1 focus:outline-none"
          >
            {days.map((day) => {
              const outside = day.getMonth() !== month.getMonth();
              const past = day < today;
              const isSelected = selected ? sameDay(day, selected) : false;
              const isCursor = sameDay(day, cursor);
              const isToday = sameDay(day, today);

              return (
                <button
                  key={iso(day)}
                  type="button"
                  role="gridcell"
                  tabIndex={-1}
                  disabled={past}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => choose(day)}
                  onMouseEnter={() => !past && setCursor(day)}
                  className={[
                    "relative mx-auto flex h-9 w-9 items-center justify-center rounded-[2px]",
                    "font-[family-name:var(--font-ui)] text-[0.8125rem] transition-colors duration-300",
                    past
                      ? "cursor-not-allowed text-white/20"
                      : outside
                        ? "text-white/35 hover:text-white/70"
                        : "text-white/80 hover:text-white",
                    isSelected ? "!bg-white !text-ink" : "",
                    !isSelected && isCursor && !past
                      ? "bg-white/10"
                      : "",
                  ].join(" ")}
                >
                  {day.getDate()}
                  {isToday && !isSelected ? (
                    <span
                      aria-hidden
                      className="absolute bottom-1.5 h-px w-3 bg-silver"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => {
                onChange("");
                close();
              }}
              className="label-xs text-white/55 transition-colors duration-400 hover:text-white"
            >
              Clear
            </button>
            <p className="label-xs text-white/45">48 hours&rsquo; notice preferred</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
