"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button, IconButton } from "./button";
import { TextArea, TextInput } from "./form";

/**
 * Editors for repeating content: lines, title/copy pairs and tags. Each item
 * can be reordered with buttons — keyboard-reachable and unambiguous, where
 * drag handles alone would not be.
 */

export function move<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ReorderButtons({
  index,
  count,
  onMove,
  itemLabel,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  itemLabel: string;
}) {
  return (
    <div className="flex shrink-0">
      <IconButton
        size="sm"
        label={`Move ${itemLabel} up`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp aria-hidden />
      </IconButton>
      <IconButton
        size="sm"
        label={`Move ${itemLabel} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown aria-hidden />
      </IconButton>
    </div>
  );
}

function ListFrame({
  legend,
  description,
  error,
  required,
  children,
}: {
  legend: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-error` : description ? `${id}-description` : undefined}>
      <legend className="label-xs text-white/70">
        {legend}
        {required ? (
          <>
            <span className="ml-1.5 text-silver" aria-hidden>
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </legend>
      {description ? (
        <p id={`${id}-description`} className="mt-2 text-[0.8125rem] leading-snug text-white/55">
          {description}
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex gap-2 text-[0.8125rem] leading-snug text-alert">
          <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-current" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** An ordered list of single lines (or paragraphs, with `multiline`). */
export function StringListEditor({
  legend,
  description,
  items,
  onChange,
  addLabel,
  itemLabel,
  placeholder,
  multiline,
  max,
  error,
  required,
}: {
  legend: string;
  description?: ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  /** Used in the accessible names: "Move line 2 up". */
  itemLabel: string;
  placeholder?: string;
  multiline?: boolean;
  max?: number;
  error?: string;
  required?: boolean;
}) {
  const update = (index: number, value: string) => onChange(items.map((item, i) => (i === index ? value : item)));
  return (
    <ListFrame legend={legend} description={description} error={error} required={required}>
      {items.length ? (
        <ol className="flex flex-col gap-2">
          {items.map((item, i) => {
            const name = `${itemLabel} ${i + 1}`;
            return (
              <li key={i} className="flex items-start gap-2">
                <span className="label-xs mt-3.5 w-6 shrink-0 text-right text-white/50 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  {multiline ? (
                    <TextArea
                      aria-label={name}
                      value={item}
                      rows={3}
                      placeholder={placeholder}
                      onChange={(event) => update(i, event.target.value)}
                    />
                  ) : (
                    <TextInput
                      aria-label={name}
                      value={item}
                      placeholder={placeholder}
                      onChange={(event) => update(i, event.target.value)}
                    />
                  )}
                </div>
                <div className="mt-1 flex">
                  <ReorderButtons
                    index={i}
                    count={items.length}
                    itemLabel={name}
                    onMove={(from, to) => onChange(move(items, from, to))}
                  />
                  <IconButton size="sm" label={`Remove ${name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                    <X aria-hidden />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="border border-dashed border-white/15 px-4 py-3 text-[0.8125rem] text-white/55">Nothing added yet.</p>
      )}
      {max == null || items.length < max ? (
        <Button size="sm" variant="ghost" className="mt-3 -ml-3" onClick={() => onChange([...items, ""])}>
          <Plus aria-hidden />
          {addLabel}
        </Button>
      ) : null}
    </ListFrame>
  );
}

type Pair = { title: string; copy: string };

/** Title + copy items — key benefits, principles, facts. */
export function PairListEditor<T extends Pair>({
  legend,
  description,
  items,
  onChange,
  addLabel,
  itemLabel,
  titleLabel = "Title",
  copyLabel = "Copy",
  make,
  max,
  error,
  itemErrors,
  required,
  compact,
}: {
  legend: string;
  description?: ReactNode;
  items: T[];
  onChange: (items: T[]) => void;
  addLabel: string;
  itemLabel: string;
  titleLabel?: string;
  copyLabel?: string;
  /** Creates a blank item. */
  make: () => T;
  max?: number;
  error?: string;
  /** Keyed by index: { "0.title": "…" }. */
  itemErrors?: Record<string, string>;
  required?: boolean;
  /** Single-line copy (facts) instead of a paragraph. */
  compact?: boolean;
}) {
  const update = (index: number, patch: Partial<Pair>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <ListFrame legend={legend} description={description} error={error} required={required}>
      {items.length ? (
        <ol className="flex flex-col gap-3">
          {items.map((item, i) => {
            const name = `${itemLabel} ${i + 1}`;
            const titleError = itemErrors?.[`${i}.title`];
            const copyError = itemErrors?.[`${i}.copy`];
            return (
              <li key={i} className="border border-white/12 bg-white/1.5 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="label-xs text-white/55">{name}</span>
                  <div className="flex">
                    <ReorderButtons
                      index={i}
                      count={items.length}
                      itemLabel={name}
                      onMove={(from, to) => onChange(move(items, from, to))}
                    />
                    <IconButton size="sm" label={`Remove ${name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                      <X aria-hidden />
                    </IconButton>
                  </div>
                </div>
                <div className={compact ? "mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2" : "mt-2 flex flex-col gap-3"}>
                  <div>
                    <TextInput
                      aria-label={`${name} — ${titleLabel}`}
                      placeholder={titleLabel}
                      value={item.title}
                      aria-invalid={titleError ? true : undefined}
                      onChange={(event) => update(i, { title: event.target.value })}
                    />
                    {titleError ? <p className="mt-1.5 text-[0.8125rem] text-alert">{titleError}</p> : null}
                  </div>
                  <div>
                    {compact ? (
                      <TextInput
                        aria-label={`${name} — ${copyLabel}`}
                        placeholder={copyLabel}
                        value={item.copy}
                        onChange={(event) => update(i, { copy: event.target.value })}
                      />
                    ) : (
                      <TextArea
                        aria-label={`${name} — ${copyLabel}`}
                        placeholder={copyLabel}
                        rows={3}
                        value={item.copy}
                        aria-invalid={copyError ? true : undefined}
                        onChange={(event) => update(i, { copy: event.target.value })}
                      />
                    )}
                    {copyError ? <p className="mt-1.5 text-[0.8125rem] text-alert">{copyError}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="border border-dashed border-white/15 px-4 py-3 text-[0.8125rem] text-white/55">Nothing added yet.</p>
      )}
      {max == null || items.length < max ? (
        <Button size="sm" variant="ghost" className="mt-3 -ml-3" onClick={() => onChange([...items, make()])}>
          <Plus aria-hidden />
          {addLabel}
        </Button>
      ) : null}
    </ListFrame>
  );
}

/** Free-text tags, added with Enter or a comma. */
export function TagInput({
  legend,
  description,
  value,
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
}: {
  legend: string;
  description?: ReactNode;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const id = useId();

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "");
    if (tag && !value.some((item) => item.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((item) => !value.some((tag) => tag.toLowerCase() === item.toLowerCase()));

  return (
    <div>
      <label htmlFor={id} className="label-xs text-white/70">
        {legend}
      </label>
      {description ? <p className="mt-2 text-[0.8125rem] leading-snug text-white/55">{description}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-[2px] border border-white/15 bg-obsidian p-1.5 focus-within:border-white focus-within:ring-1 focus-within:ring-white">
        {value.map((tag) => (
          <span key={tag} className="inline-flex h-7 items-center gap-1 border border-white/25 pr-1 pl-2.5 text-[0.8125rem] text-white">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="inline-flex size-5 items-center justify-center text-white/55 hover:text-white focus-visible:outline-1 focus-visible:outline-white"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-[0.875rem] text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>
      {unused.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[0.75rem] text-white/55">Add:</span>
          {unused.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => add(item)}
              className="text-[0.75rem] text-white/70 underline-offset-4 hover:text-white hover:underline focus-visible:outline-1 focus-visible:outline-white"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
