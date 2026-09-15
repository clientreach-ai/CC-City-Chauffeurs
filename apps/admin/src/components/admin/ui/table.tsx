"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

/**
 * Admin table. A real <table> from `md` up — sortable headers, row actions,
 * optional selection — and a stacked card list below it, because a
 * seven-column table squeezed onto a phone helps nobody.
 */

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Present when the column can be sorted. */
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Hidden below this breakpoint (the card view covers phones). */
  minWidth?: "lg" | "xl";
  align?: "left" | "right";
  /** Visually hidden header (e.g. the image column), still read aloud. */
  hideHeader?: boolean;
};

export type SortState = { id: string; direction: "asc" | "desc" };

export function DataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  renderCard,
  actions,
  initialSort,
  selection,
  rowClassName,
}: {
  /** Describes the table for assistive technology. */
  caption: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  actions?: (row: T) => ReactNode;
  initialSort?: SortState;
  selection?: {
    selected: Set<string>;
    onChange: (selected: Set<string>) => void;
    label: (row: T) => string;
  };
  rowClassName?: (row: T) => string;
}) {
  const [sort, setSort] = useState<SortState | undefined>(initialSort);

  const sorted = (() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return rows;
    const value = column.sortValue;
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.direction === "asc" ? result : -result;
    });
  })();

  const toggleSort = (id: string) =>
    setSort((current) =>
      current?.id === id ? { id, direction: current.direction === "asc" ? "desc" : "asc" } : { id, direction: "asc" },
    );

  const allSelected = selection ? rows.length > 0 && rows.every((row) => selection.selected.has(rowKey(row))) : false;
  const hidden = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-y border-hairline">
              {selection ? (
                <th scope="col" className="w-10 py-3 pl-1">
                  <input
                    type="checkbox"
                    aria-label={allSelected ? "Deselect all" : "Select all"}
                    checked={allSelected}
                    onChange={(event) =>
                      selection.onChange(event.target.checked ? new Set(rows.map(rowKey)) : new Set())
                    }
                    className="size-4 cursor-pointer accent-white"
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "label-xs py-3 pr-4 font-medium text-white/55",
                      column.minWidth ? hidden[column.minWidth] : "",
                      column.align === "right" ? "text-right" : "",
                      column.className,
                    )}
                  >
                    {column.hideHeader ? (
                      <span className="sr-only">{column.header}</span>
                    ) : column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 uppercase transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                          active ? "text-white" : "",
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {actions ? (
                <th scope="col" className="w-12 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const key = rowKey(row);
              const selected = selection?.selected.has(key);
              return (
                <tr
                  key={key}
                  className={cn(
                    "group relative border-b border-hairline transition-colors duration-200 hover:bg-white/2.5",
                    selected ? "bg-white/4" : "",
                    rowClassName?.(row),
                  )}
                >
                  {selection ? (
                    <td className="relative z-10 py-3 pl-1 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Select ${selection.label(row)}`}
                        checked={selected}
                        onChange={(event) => {
                          const next = new Set(selection.selected);
                          if (event.target.checked) next.add(key);
                          else next.delete(key);
                          selection.onChange(next);
                        }}
                        className="size-4 cursor-pointer accent-white"
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "py-3 pr-4 align-middle text-[0.875rem] text-white/85",
                        column.minWidth ? hidden[column.minWidth] : "",
                        column.align === "right" ? "text-right" : "",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {actions ? <td className="relative z-10 py-2 text-right align-middle">{actions(row)}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col border-t border-hairline md:hidden" aria-label={caption}>
        {sorted.map((row) => (
          <li key={rowKey(row)} className="relative flex items-start gap-3 border-b border-hairline py-4">
            {selection ? (
              <input
                type="checkbox"
                aria-label={`Select ${selection.label(row)}`}
                checked={selection.selected.has(rowKey(row))}
                onChange={(event) => {
                  const next = new Set(selection.selected);
                  if (event.target.checked) next.add(rowKey(row));
                  else next.delete(rowKey(row));
                  selection.onChange(next);
                }}
                className="relative z-10 mt-1 size-4 shrink-0 cursor-pointer accent-white"
              />
            ) : null}
            <div className="min-w-0 flex-1">{renderCard(row)}</div>
            {actions ? <div className="relative z-10 -mt-1 shrink-0">{actions(row)}</div> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The primary link in a row. Its ::after stretches over the whole row, so
 * the row is one large click target while the markup stays a single link.
 */
export const rowLinkClass =
  "font-medium text-white after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-white";
