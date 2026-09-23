"use client";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Key = string | number;

type Row<T> = { kind: "header"; group: number; label: string; count: number } | { kind: "item"; item: T; index: number; group: number; inGroup: number; key: Key };

type Layout<T> = {
  rows: Row<T>[];
  /** offsets[i] is the top of row i; offsets[rows.length] is the total height. */
  offsets: Float64Array;
  /** Row index of each item, by item index. */
  rowOf: Int32Array;
  /** Row indexes of the group headers, in order. */
  headers: number[];
};

export type VirtualListItemState = { index: number; active: boolean; selected: boolean };

export type VirtualListProps<T> = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  items: readonly T[];
  renderItem: (item: T, state: VirtualListItemState) => React.ReactNode;
  /** Stable key per item. Defaults to its index. */
  getKey?: (item: T, index: number) => Key;
  /** Fixed row height in px. Leave it out to measure rows as they render. */
  itemHeight?: number;
  /** Starting guess for measured rows. Closer guesses mean a steadier scrollbar. */
  estimateHeight?: number;
  /** Rows rendered beyond each edge of the viewport. */
  overscan?: number;
  /** Groups consecutive items under a sticky header. Items must already be sorted by group. */
  groupBy?: (item: T) => string;
  headerHeight?: number;
  renderGroupHeader?: (label: string, count: number) => React.ReactNode;
  /** Text for type-to-jump. Defaults to the item itself when items are strings. */
  getTextValue?: (item: T) => string;
  value?: Key | null;
  defaultValue?: Key | null;
  onValueChange?: (key: Key, item: T) => void;
  /** Fires as the active (keyboard) row changes. */
  onActiveChange?: (index: number, item: T) => void;
  /** Fires when the first and last visible items change. */
  onRangeChange?: (first: number, last: number) => void;
  /** Shown in place of the rows when items is empty. */
  empty?: React.ReactNode;
};

function useLayout<T>(items: readonly T[], getKey: (item: T, i: number) => Key, groupBy: ((item: T) => string) | undefined, size: (row: Row<T>) => number): Layout<T> {
  const rows = useMemo(() => {
    const out: Row<T>[] = [];
    let group = -1;
    let label: string | null = null;
    let header: Extract<Row<T>, { kind: "header" }> | null = null;
    let inGroup = 0;
    items.forEach((item, index) => {
      if (groupBy) {
        const next = groupBy(item);
        if (next !== label) {
          label = next;
          group++;
          inGroup = 0;
          header = { kind: "header", group, label: next, count: 0 };
          out.push(header);
        }
        header!.count++;
      }
      out.push({ kind: "item", item, index, group: Math.max(group, 0), inGroup: inGroup++, key: getKey(item, index) });
    });
    return out;
  }, [items, getKey, groupBy]);

  return useMemo(() => {
    const offsets = new Float64Array(rows.length + 1);
    const rowOf = new Int32Array(items.length);
    const headers: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.kind === "header") headers.push(i);
      else rowOf[r.index] = i;
      offsets[i + 1] = offsets[i] + size(r);
    }
    return { rows, offsets, rowOf, headers };
  }, [rows, items.length, size]);
}

/** First row whose bottom edge is below y. */
function rowAt(offsets: Float64Array, count: number, y: number) {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1] <= y) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo);
}

export function VirtualList<T>({
  items,
  renderItem,
  getKey = defaultKey,
  itemHeight,
  estimateHeight = 40,
  overscan = 6,
  groupBy,
  headerHeight = 28,
  renderGroupHeader = defaultHeader,
  getTextValue,
  value,
  defaultValue = null,
  onValueChange,
  onActiveChange,
  onRangeChange,
  empty,
  className,
  onKeyDown,
  onFocus,
  ...rest
}: VirtualListProps<T>) {
  const reduce = useReducedMotion();
  const id = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  // A row reached by keyboard stays in view while the rows around it are
  // measured, until anything else scrolls the list.
  const pinned = useRef<number | null>(null);
  const expected = useRef<number | null>(null);
  const measuring = itemHeight === undefined;
  const grouped = !!groupBy;
  const stickyHeight = grouped ? headerHeight : 0;

  // Measured heights by key, so a row keeps its size when the list is filtered or sorted.
  const [measured, setMeasured] = useState<ReadonlyMap<Key, number>>(() => new Map());
  const size = useCallback(
    (row: Row<T>) => (row.kind === "header" ? headerHeight : (itemHeight ?? measured.get(row.key) ?? estimateHeight)),
    [headerHeight, itemHeight, measured, estimateHeight],
  );
  const layout = useLayout(items, getKey, groupBy, size);
  const total = layout.offsets[layout.rows.length];

  const [range, setRange] = useState({ start: 0, end: Math.min(layout.rows.length, 24) });
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(-1);
  const [innerValue, setInnerValue] = useState<Key | null>(defaultValue);
  const selectedKey = value !== undefined ? value : innerValue;

  // Handlers run outside render; they read the latest layout from here.
  const live = useRef({ layout, active, stickyHeight, overscan });
  useEffect(() => {
    live.current = { layout, active, stickyHeight, overscan };
  });
  const cb = useRef({ onActiveChange, onRangeChange });
  useEffect(() => {
    cb.current = { onActiveChange, onRangeChange };
  });

  // Reads the scroll position once per frame. React only re-renders when the
  // window of rows or the current group actually changes.
  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const { layout: l, overscan: o, stickyHeight: sh } = live.current;
    const n = l.rows.length;
    if (!n) return;
    const top = el.scrollTop;
    const first = rowAt(l.offsets, n, top);
    const last = rowAt(l.offsets, n, top + el.clientHeight - 1);
    const start = Math.max(0, first - o);
    const end = Math.min(n, last + 1 + o);
    setRange((r) => (r.start === start && r.end === end ? r : { start, end }));

    const firstItem = l.rows.slice(first, last + 1).find((r) => r.kind === "item");
    const lastItem = l.rows.slice(first, last + 1).findLast((r) => r.kind === "item");
    if (firstItem?.kind === "item" && lastItem?.kind === "item") cb.current.onRangeChange?.(firstItem.index, lastItem.index);

    if (sh) {
      // The group whose header has scrolled under the top edge owns the sticky slot;
      // the next header pushes it up and out as it arrives.
      let g = 0;
      for (let i = 0; i < l.headers.length; i++) if (l.offsets[l.headers[i]] <= top + 0.5) g = i;
      setCurrent(g);
      const next = l.headers[g + 1];
      const push = next === undefined ? 0 : Math.min(0, l.offsets[next] - top - sh);
      if (sticky.current) sticky.current.style.transform = push ? `translateY(${push}px)` : "";
    }
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      // A scroll this list didn't make (wheel, scrollbar, find-in-page) hands control back.
      if (expected.current !== null && Math.abs(el.scrollTop - expected.current) > 1) pinned.current = null;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const release = () => (pinned.current = null);
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", release);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", release);
    };
  }, [sync]);

  // Re-window whenever the layout changes (new items, new measurements).
  useEffect(() => {
    sync();
  }, [layout, sync]);

  // Measured mode: one observer for every rendered row. A row above the
  // viewport that changes height moves the scroll by the same amount, so the
  // row being read never jumps.
  const anchor = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (!measuring) return;
    const ro = new ResizeObserver((entries) => {
      const el = scroller.current;
      const { layout: l } = live.current;
      const changes: [Key, number][] = [];
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const rowIndex = Number(target.dataset.row);
        const row = l.rows[rowIndex];
        if (!row || row.kind !== "item") continue;
        const h = entry.borderBoxSize?.[0]?.blockSize ?? target.offsetHeight;
        const was = l.offsets[rowIndex + 1] - l.offsets[rowIndex];
        if (Math.abs(h - was) < 0.5) continue;
        changes.push([row.key, h]);
        if (el && l.offsets[rowIndex] < el.scrollTop) anchor.current += h - was;
      }
      if (!changes.length) return;
      setMeasured((prev) => {
        const next = new Map(prev);
        for (const [k, h] of changes) next.set(k, h);
        return next;
      });
    });
    observer.current = ro;
    // Rows that mounted before this observer existed.
    scroller.current?.querySelectorAll("[role=option]").forEach((n) => ro.observe(n));
    return () => {
      ro.disconnect();
      observer.current = null;
    };
  }, [measuring]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current) {
      el.scrollTop += anchor.current;
      expected.current = el.scrollTop;
    }
    anchor.current = 0;
    if (pinned.current !== null && pinned.current < items.length) reveal(layout.rowOf[pinned.current]);
    // reveal only reads the layout it is given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);



  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !observer.current) return;
    observer.current.observe(node);
    return () => observer.current?.unobserve(node);
  }, []);

  // Keyboard moves render instantly and scroll only as far as needed, keeping
  // the row clear of the sticky header.
  function reveal(rowIndex: number) {
    const el = scroller.current;
    if (!el) return;
    const top = layout.offsets[rowIndex];
    const bottom = layout.offsets[rowIndex + 1];
    if (top < el.scrollTop + stickyHeight) el.scrollTop = top - stickyHeight;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    expected.current = el.scrollTop;
  }

  const moveTo = (index: number) => {
    if (!items.length) return;
    const i = Math.max(0, Math.min(items.length - 1, index));
    setActive(i);
    cb.current.onActiveChange?.(i, items[i]);
    pinned.current = i;
    reveal(layout.rowOf[i]);
  };

  const select = (index: number) => {
    const item = items[index];
    if (item === undefined) return;
    const key = getKey(item, index);
    if (value === undefined) setInnerValue(key);
    onValueChange?.(key, item);
  };

  // Type to jump: letters typed within half a second build one query.
  const typed = useRef({ text: "", at: 0 });
  const textOf = (item: T) => (getTextValue ? getTextValue(item) : typeof item === "string" ? item : "");
  const typeahead = (ch: string, now: number) => {
    const t = typed.current;
    const fresh = now - t.at > 500;
    t.text = fresh ? ch : t.text + ch;
    t.at = now;
    const q = t.text.toLowerCase();
    // A repeated single letter cycles through matches; a longer query refines in place.
    const from = t.text.length === 1 ? active + 1 : Math.max(0, active);
    for (let k = 0; k < items.length; k++) {
      const i = (from + k) % items.length;
      if (textOf(items[i]).toLowerCase().startsWith(q)) return moveTo(i);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !items.length) return;
    const el = scroller.current;
    const at = active < 0 ? 0 : active;
    const pageBy = (dir: 1 | -1) => {
      if (!el) return at;
      const row = layout.rowOf[at];
      const y = layout.offsets[row] + dir * (el.clientHeight - stickyHeight);
      let r = rowAt(layout.offsets, layout.rows.length, Math.max(0, y));
      while (layout.rows[r]?.kind === "header") r += dir > 0 ? 1 : -1;
      const target = layout.rows[r];
      return target?.kind === "item" ? target.index : dir > 0 ? items.length - 1 : 0;
    };
    const map: Record<string, () => number> = {
      ArrowDown: () => (active < 0 ? 0 : at + 1),
      ArrowUp: () => (active < 0 ? 0 : at - 1),
      PageDown: () => pageBy(1),
      PageUp: () => pageBy(-1),
      Home: () => 0,
      End: () => items.length - 1,
    };
    if (map[e.key]) {
      e.preventDefault();
      moveTo(map[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      if (active < 0) return;
      e.preventDefault();
      select(active);
    } else if (e.key.length === 1 && e.key !== " ") {
      // Letters belong to the list while it has focus, not to app-wide shortcuts.
      e.preventDefault();
      e.stopPropagation();
      typeahead(e.key, e.timeStamp);
    }
  };

  // The active row is always rendered, even when scrolled away, so
  // aria-activedescendant never points at nothing.
  const visible: number[] = [];
  for (let r = range.start; r < Math.min(range.end, layout.rows.length); r++) visible.push(r);
  const activeRow = active >= 0 && active < items.length ? layout.rowOf[active] : -1;
  if (activeRow >= 0 && (activeRow < range.start || activeRow >= range.end)) visible.push(activeRow);

  const optionId = (index: number) => `${id}-o${index}`;
  const header = grouped ? layout.rows[layout.headers[current] ?? -1] : undefined;

  const renderRow = (r: number) => {
    const row = layout.rows[r];
    const top = layout.offsets[r];
    if (row.kind === "header") {
      return (
        <div key={`h${row.group}`} aria-hidden className="absolute inset-x-0 top-0" style={{ transform: `translateY(${top}px)`, height: headerHeight }}>
          {renderGroupHeader(row.label, row.count)}
        </div>
      );
    }
    const isActive = row.index === active;
    const isSelected = selectedKey !== null && row.key === selectedKey;
    return (
      <div
        key={row.key}
        ref={measuring ? measureRef : undefined}
        id={optionId(row.index)}
        role="option"
        aria-selected={isSelected}
        aria-posinset={(grouped ? row.inGroup : row.index) + 1}
        aria-setsize={grouped ? (layout.rows[layout.headers[row.group]] as { count: number }).count : items.length}
        data-row={r}
        data-active={isActive || undefined}
        data-selected={isSelected || undefined}
        onPointerDown={(e) => {
          // Keep focus on the list: the rows are descendants, not tab stops.
          e.preventDefault();
          scroller.current?.focus({ preventScroll: true });
          setActive(row.index);
          cb.current.onActiveChange?.(row.index, row.item);
        }}
        onClick={() => select(row.index)}
        className={cn(
          "group/row absolute inset-x-0 top-0 flex cursor-default select-none items-center pr-9",
          "before:pointer-events-none before:absolute before:inset-x-1 before:inset-y-px before:rounded-md before:content-[''] before:transition-colors before:duration-100",
          "hover:before:bg-hover group-focus/vl:data-active:before:bg-hover active:before:bg-fg/[0.07]",
          // Only keyboard focus draws the ring, and only on the active row.
          "group-focus-visible/vl:data-active:before:outline-solid group-focus-visible/vl:data-active:before:outline-1 group-focus-visible/vl:data-active:before:-outline-offset-1 group-focus-visible/vl:data-active:before:outline-fg-4",
        )}
        style={{ transform: `translateY(${top}px)`, height: itemHeight }}
      >
        <div className="relative min-w-0 flex-1">{renderItem(row.item, { index: row.index, active: isActive, selected: isSelected })}</div>
        {isSelected && (
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fg">
            <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.24, ease: ease.out }} />
          </svg>
        )}
      </div>
    );
  };

  // Rows sit inside role="group" wrappers per group so screen readers hear the
  // group name; the wrappers have no box, so positioning is unaffected.
  const body = () => {
    if (!grouped) return visible.map(renderRow);
    const byGroup = new Map<number, number[]>();
    for (const r of visible) {
      const g = layout.rows[r].group;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(r);
    }
    return [...byGroup].map(([g, rs]) => {
      const h = layout.rows[layout.headers[g]] as { label: string };
      return (
        <div key={`g${g}`} role="group" aria-label={h.label}>
          {rs.map(renderRow)}
        </div>
      );
    });
  };

  return (
    <div
      ref={scroller}
      role="listbox"
      tabIndex={0}
      aria-activedescendant={active >= 0 && items.length ? optionId(active) : undefined}
      onKeyDown={handleKey}
      onFocus={(e) => {
        onFocus?.(e);
        // Arriving by Tab lands on the selected row, else the first visible one.
        if (e.target !== e.currentTarget || active >= 0 || !items.length) return;
        const selectedIndex = selectedKey === null ? -1 : items.findIndex((it, i) => getKey(it, i) === selectedKey);
        if (selectedIndex >= 0) return moveTo(selectedIndex);
        const firstVisible = layout.rows.slice(range.start).find((r) => r.kind === "item" && layout.offsets[layout.rowOf[r.index]] >= (scroller.current?.scrollTop ?? 0) + stickyHeight - 1);
        if (firstVisible?.kind === "item") setActive(firstVisible.index);
      }}
      className={cn("group/vl relative overflow-y-auto overscroll-contain outline-none [overflow-anchor:none]", className)}
      {...rest}
    >
      {items.length === 0 ? (
        <div className="grid h-full min-h-32 place-items-center p-6 text-center text-[12.5px] text-fg-3">{empty ?? "Nothing to show"}</div>
      ) : (
        <>
          {grouped && header?.kind === "header" && (
            // Zero-height and sticky: pinned to the top of the viewport without taking space.
            <div aria-hidden className="pointer-events-none sticky top-0 z-(--z-sticky) h-0">
              <div ref={sticky} className="absolute inset-x-0 top-0" style={{ height: headerHeight }}>
                {renderGroupHeader(header.label, header.count)}
              </div>
            </div>
          )}
          <div className="relative w-full" style={{ height: total }}>
            {body()}
          </div>
        </>
      )}
    </div>
  );
}

function defaultKey(_: unknown, index: number) {
  return index;
}

function defaultHeader(label: string, count: number) {
  return (
    <div className="flex h-full items-center justify-between border-b border-line bg-frame pl-3.5 pr-9 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
      <span className="truncate">{label}</span>
      <span className="tabular" suppressHydrationWarning>
        {count.toLocaleString()}
      </span>
    </div>
  );
}
