"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type StickyColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  /** Right-aligned tabular figures. */
  numeric?: boolean;
  /** Pixel width. Required for pinned columns, since their offsets are sums of widths. */
  width?: number;
  /** Keep this column in view while the rest scroll sideways. */
  pin?: "start" | "end";
  /** A cell in the sticky footer row, e.g. a total. */
  footer?: (rows: T[]) => React.ReactNode;
  className?: string;
};

export type StickyColumnsProps<T> = Omit<React.ComponentProps<"div">, "children"> & {
  columns: StickyColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Names the table and its scroll region for assistive tech. */
  caption: string;
  size?: "sm" | "md";
  empty?: React.ReactNode;
};

type Edges = { start: boolean; end: boolean; top: boolean; bottom: boolean };

/**
 * Where the scroller is, so pinned edges only cast a shadow when something is actually
 * hidden beneath them. At rest a pinned column reads as part of the table.
 */
export function useScrollEdges<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [edges, setEdges] = useState<Edges>({ start: false, end: false, top: false, bottom: false });
  const [width, setWidth] = useState<number>();
  const measure = (el: HTMLElement) => {
    setWidth(el.clientWidth);
    // scrollLeft is negative in right-to-left layouts; the magnitude is what matters.
    const x = Math.abs(el.scrollLeft);
    const next = {
      // A pixel of slack: fractional widths leave the scroll position a hair short of its end.
      start: x > 1,
      end: x + el.clientWidth < el.scrollWidth - 1,
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    };
    setEdges((e) => (e.start === next.start && e.end === next.end && e.top === next.top && e.bottom === next.bottom ? e : next));
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return { ref, edges, width, onScroll: (e: React.UIEvent<E>) => measure(e.currentTarget) };
}

export function StickyColumns<T>({ columns, rows, getRowId, caption, size = "md", empty = "Nothing here yet", className, style, onScroll, ...rest }: StickyColumnsProps<T>) {
  const { ref, edges, width, onScroll: track } = useScrollEdges<HTMLDivElement>();
  const captionId = useId();

  // Pinned columns must leave room to scroll. When they'd take more than 60% of the visible width
  // (a phone), end pins let go first, then every start pin after the first.
  const effective = useMemo(() => {
    if (!width) return columns;
    const room = width * 0.6;
    const pinnedWidth = (cols: StickyColumn<T>[]) => cols.reduce((sum, c) => sum + (c.pin ? (c.width ?? 0) : 0), 0);
    let cols = columns;
    if (pinnedWidth(cols) > room) cols = cols.map((c) => (c.pin === "end" ? { ...c, pin: undefined } : c));
    if (pinnedWidth(cols) > room) {
      const first = cols.find((c) => c.pin === "start")?.key;
      cols = cols.map((c) => (c.pin === "start" && c.key !== first ? { ...c, pin: undefined } : c));
    }
    return cols;
  }, [columns, width]);

  // Offsets for pinned columns: each start column sits after the ones pinned before it,
  // each end column before the ones pinned after it.
  const layout = useMemo(() => {
    const offsets = new Map<string, number>();
    let start = 0;
    for (const c of effective) if (c.pin === "start") offsets.set(c.key, (start += c.width ?? 0) - (c.width ?? 0));
    let end = 0;
    for (const c of [...effective].reverse()) if (c.pin === "end") offsets.set(c.key, (end += c.width ?? 0) - (c.width ?? 0));
    const lastStart = [...effective].reverse().find((c) => c.pin === "start")?.key;
    const firstEnd = effective.find((c) => c.pin === "end")?.key;
    const total = effective.reduce((sum, c) => sum + (c.width ?? 120), 0);
    return { offsets, lastStart, firstEnd, start, end, total };
  }, [effective]);

  const hasFooter = effective.some((c) => c.footer);
  const h = size === "sm" ? "h-8" : "h-10";

  // Shared classes for a cell in a pinned column, whichever row it sits in.
  const pinned = (col: StickyColumn<T>) => {
    if (!col.pin) return "";
    const isEdge = col.key === layout.lastStart || col.key === layout.firstEnd;
    return cn(
      "sticky",
      isEdge &&
        cn(
          // The edge: a hairline and a soft shadow, one pseudo-element, present only while columns are hidden
          // beneath it. Drawn outside the cell so the row dividers never get notched at the corner.
          "after:pointer-events-none after:absolute after:inset-y-0 after:w-3 after:opacity-0 after:transition-opacity after:duration-200 after:content-['']",
          col.pin === "start"
            ? "after:left-[calc(100%-1px)] after:border-l after:border-line after:bg-linear-to-r after:from-overlay/60 after:to-transparent in-data-scroll-start:after:opacity-100"
            : "after:right-[calc(100%-1px)] after:border-r after:border-line after:bg-linear-to-l after:from-overlay/60 after:to-transparent in-data-scroll-end:after:opacity-100",
        ),
    );
  };
  const pinStyle = (col: StickyColumn<T>): React.CSSProperties | undefined =>
    col.pin === "start" ? { left: layout.offsets.get(col.key) } : col.pin === "end" ? { right: layout.offsets.get(col.key) } : undefined;

  return (
    <div
      ref={ref}
      role="region"
      aria-labelledby={captionId}
      // Focusable so the table can be scrolled sideways from the keyboard.
      tabIndex={0}
      data-scroll-start={edges.start || undefined}
      data-scroll-end={edges.end || undefined}
      data-scroll-top={edges.top || undefined}
      data-scroll-bottom={edges.bottom || undefined}
      onScroll={(e) => {
        onScroll?.(e);
        track(e);
      }}
      style={{
        // Anything scrolled into view (a focused link, a found word) lands clear of the pinned columns.
        scrollPaddingInlineStart: layout.start,
        scrollPaddingInlineEnd: layout.end,
        ...style,
      }}
      className={cn(
        "relative overflow-auto overscroll-contain rounded-xl border border-line bg-frame outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <table style={{ minWidth: layout.total }} className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <colgroup>
          {effective.map((c) => (
            <col key={c.key} style={c.width != null ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {effective.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={pinStyle(col)}
                className={cn(
                  "sticky top-0 whitespace-nowrap border-b border-line bg-frame px-3 text-[12px] font-medium text-fg-3",
                  size === "sm" ? "h-8" : "h-9",
                  col.numeric ? "text-right" : "text-left",
                  // Corners sit above both the header row and the pinned body cells.
                  col.pin ? "z-[calc(var(--z-sticky)+1)]" : "z-(--z-sticky)",
                  pinned(col),
                  // Rows scrolled beneath the header: a short shade under it, drawn per cell so the seams meet cleanly.
                  "before:pointer-events-none before:absolute before:inset-x-0 before:top-full before:h-2 before:bg-linear-to-b before:from-overlay before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] in-data-scroll-top:before:opacity-40",
                )}
              >
                <span className="block truncate">{col.header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} className="group/row">
              {effective.map((col, i) => {
                // The first column names the row, so it is the row's header for screen readers.
                const Cell = i === 0 ? "th" : "td";
                return (
                  <Cell
                    key={col.key}
                    scope={i === 0 ? "row" : undefined}
                    style={pinStyle(col)}
                    className={cn(
                      "border-b border-line bg-frame px-3 font-normal text-fg transition-colors duration-150 group-hover/row:bg-hover",
                      !hasFooter && "group-last/row:border-b-0",
                      h,
                      col.numeric ? "whitespace-nowrap text-right tabular" : "text-left",
                      col.pin && "z-[1]",
                      pinned(col),
                      col.className,
                    )}
                  >
                    {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </Cell>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={effective.length} className="h-32 p-0">
                {/* The empty message stays in view however far the empty table is scrolled. */}
                <span className="sticky left-0 flex h-full w-max items-center px-4 text-[13px] text-fg-3">
                  {empty}
                </span>
              </td>
            </tr>
          )}
        </tbody>
        {hasFooter && rows.length > 0 && (
          <tfoot>
            <tr>
              {effective.map((col) => (
                <td
                  key={col.key}
                  style={pinStyle(col)}
                  className={cn(
                    "sticky bottom-0 border-t border-line bg-frame px-3 font-medium text-fg",
                    h,
                    col.numeric ? "whitespace-nowrap text-right tabular" : "text-left",
                    col.pin ? "z-[calc(var(--z-sticky)+1)]" : "z-(--z-sticky)",
                    pinned(col),
                    "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-2 before:bg-linear-to-t before:from-overlay before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] in-data-scroll-bottom:before:opacity-40",
                  )}
                >
                  {col.footer?.(rows)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
