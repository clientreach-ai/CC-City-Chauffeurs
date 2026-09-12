"use client";

import { Plus, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button, IconButton } from "./button";
import { Select } from "./form";
import { move, ReorderButtons } from "./list-editors";

/**
 * Choose items from a list and put them in order — the vehicles on a
 * service page, the services featured on the homepage. The order chosen here
 * is the order the website shows.
 */
export function OrderedPicker({
  legend,
  description,
  options,
  value,
  onChange,
  max,
  error,
  renderItem,
  itemNoun,
}: {
  legend: string;
  description?: ReactNode;
  options: readonly { value: string; label: string; note?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  error?: string;
  renderItem?: (id: string) => ReactNode;
  /** "vehicle", "service" — used in button labels. */
  itemNoun: string;
}) {
  const id = useId();
  const [adding, setAdding] = useState("");
  const available = options.filter((option) => !value.includes(option.value));
  const label = (item: string) => options.find((option) => option.value === item)?.label ?? "No longer listed";
  const full = max != null && value.length >= max;

  return (
    <fieldset aria-describedby={error ? `${id}-error` : description ? `${id}-description` : undefined}>
      <legend className="label-xs text-white/70">{legend}</legend>
      {description ? (
        <p id={`${id}-description`} className="mt-2 text-[0.8125rem] leading-snug text-white/55">
          {description}
        </p>
      ) : null}

      {value.length ? (
        <ol className="mt-3 border-t border-white/12">
          {value.map((item, i) => (
            <li key={item} className="flex items-center gap-3 border-b border-white/12 py-2">
              <span className="label-xs w-6 shrink-0 text-right text-white/45 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1 text-[0.875rem] text-white">{renderItem ? renderItem(item) : label(item)}</div>
              <ReorderButtons index={i} count={value.length} itemLabel={label(item)} onMove={(from, to) => onChange(move(value, from, to))} />
              <IconButton size="sm" label={`Remove ${label(item)}`} onClick={() => onChange(value.filter((entry) => entry !== item))}>
                <X aria-hidden />
              </IconButton>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 border border-dashed border-white/15 px-4 py-3 text-[0.8125rem] text-white/55">None chosen yet.</p>
      )}

      {error ? (
        <p id={`${id}-error`} className="mt-2 flex gap-2 text-[0.8125rem] leading-snug text-alert">
          <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-current" />
          {error}
        </p>
      ) : null}

      {available.length && !full ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="sm:w-80">
            <Select aria-label={`Choose a ${itemNoun} to add`} value={adding} onChange={(event) => setAdding(event.target.value)}>
              <option value="">Choose a {itemNoun}…</option>
              {available.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.note ? ` — ${option.note}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button
            disabled={!adding}
            onClick={() => {
              onChange([...value, adding]);
              setAdding("");
            }}
          >
            <Plus aria-hidden />
            Add {itemNoun}
          </Button>
        </div>
      ) : full ? (
        <p className="mt-3 text-[0.75rem] text-white/55">
          The page shows up to {max}. Remove one to add another.
        </p>
      ) : null}
    </fieldset>
  );
}
