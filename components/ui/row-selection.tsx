"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Loader, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* The selection model on its own                                      */
/* ------------------------------------------------------------------ */

export type RowSelectionOptions = {
  /** Every selectable id, in the order the rows are shown. Ranges follow this order. */
  ids: string[];
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (selected: string[]) => void;
};

/**
 * Selection with ranges. Shift-toggling a row applies that row's new state to
 * every row between it and the last row toggled, the way file lists behave.
 */
export function useRowSelection({ ids, selected: selectedProp, defaultSelected = [], onSelectedChange }: RowSelectionOptions) {
  const [selected, setSelected] = useControllableState({ value: selectedProp, defaultValue: defaultSelected, onChange: onSelectedChange });
  const set = useMemo(() => new Set(selected), [selected]);
  const anchor = useRef<string | null>(null);
  // The rows a shift-range just touched, in sweep order, so their ticks can draw one after another.
  const [sweep, setSweep] = useState<Map<string, number>>(() => new Map());

  // Selection only ever holds rows that still exist.
  const present = useMemo(() => ids.filter((id) => set.has(id)), [ids, set]);
  const count = present.length;
  const all: boolean | "mixed" = count === 0 ? false : count === ids.length ? true : "mixed";

  const commit = useCallback(
    (next: Set<string>) => setSelected(ids.filter((id) => next.has(id))),
    [ids, setSelected],
  );

  const toggle = useCallback(
    (id: string, { range = false }: { range?: boolean } = {}) => {
      const next = new Set(present);
      const value = !next.has(id);
      const from = anchor.current != null ? ids.indexOf(anchor.current) : -1;
      const to = ids.indexOf(id);
      if (range && from >= 0 && to >= 0 && from !== to) {
        const step = to > from ? 1 : -1;
        const order = new Map<string, number>();
        for (let i = from, n = 0; i !== to + step; i += step, n++) {
          if (value) next.add(ids[i]);
          else next.delete(ids[i]);
          order.set(ids[i], n);
        }
        setSweep(order);
      } else {
        if (value) next.add(id);
        else next.delete(id);
        setSweep(new Map());
      }
      anchor.current = id;
      commit(next);
    },
    [present, ids, commit],
  );

  const toggleAll = useCallback(() => {
    anchor.current = null;
    setSweep(new Map());
    // Mixed goes to all, as a tri-state checkbox should; only a full selection clears.
    commit(all === true ? new Set() : new Set(ids));
  }, [all, ids, commit]);

  const clear = useCallback(() => {
    anchor.current = null;
    setSweep(new Map());
    commit(new Set());
  }, [commit]);

  return { selected: present, count, all, isSelected: (id: string) => set.has(id), toggle, toggleAll, clear, sweep };
}

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

export type SelectionColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  numeric?: boolean;
  width?: number | string;
  className?: string;
};

export type RowSelectionTableProps<T> = Omit<React.ComponentProps<"div">, "children" | "defaultValue"> & {
  columns: SelectionColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Names each row's checkbox: "Select {label}". Defaults to the row id. */
  getRowLabel?: (row: T) => string;
  caption: string;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (selected: string[]) => void;
  /** Pressing anywhere on a row toggles it. Links and buttons inside the row keep their own click. */
  rowClickSelects?: boolean;
  /** The bulk actions, shown in the bar that rises while anything is selected. */
  actions?: (selection: { selected: string[]; clear: () => void }) => React.ReactNode;
  /** The noun in the bar and announcements, e.g. { one: "invoice", other: "invoices" }. Defaults to "selected" alone. */
  noun?: { one: string; other: string };
  empty?: React.ReactNode;
  size?: "sm" | "md";
  minWidth?: number;
};

const interactive = "a,button,input,select,textarea,label,[role=checkbox],[data-row-select-ignore]";

export function RowSelectionTable<T>({
  columns,
  rows,
  getRowId,
  getRowLabel,
  caption,
  selected: selectedProp,
  defaultSelected,
  onSelectedChange,
  rowClickSelects = true,
  actions,
  noun,
  empty = "Nothing here yet",
  size = "md",
  minWidth,
  className,
  onKeyDown,
  ...rest
}: RowSelectionTableProps<T>) {
  const ids = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const sel = useRowSelection({ ids, selected: selectedProp, defaultSelected, onSelectedChange });
  const reduce = useReducedMotion();
  const captionId = useId();
  const shift = useRef(false);
  const open = sel.count > 0;
  const allBox = useRef<HTMLSpanElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Which sides hide more columns, for the edge fades when the table scrolls sideways.
  const measure = (el: HTMLDivElement) => {
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const barFocus = useRef(false);

  // When the bar closes with focus inside it (an action ran, or Esc), focus lands on select-all
  // instead of falling to the page.
  useEffect(() => {
    if (!open && barFocus.current) {
      barFocus.current = false;
      allBox.current?.focus({ preventScroll: true });
    }
  }, [open]);
  const h = size === "sm" ? "h-8" : "h-10";

  const phrase = (n: number) => `${n} ${noun ? (n === 1 ? noun.one : noun.other) + " " : ""}selected`;

  return (
    <div
      data-size={size}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const typing = (e.target as HTMLElement).closest("input:not([type=checkbox]),textarea,[contenteditable=true]");
        if (typing) return;
        // Escape lets go of the selection; ⌘A / Ctrl+A takes every row, without selecting the page's text.
        if (e.key === "Escape" && open) {
          e.preventDefault();
          sel.clear();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && ids.length) {
          e.preventDefault();
          if (sel.all !== true) sel.toggleAll();
        }
      }}
      className={cn("@container relative flex flex-col overflow-hidden rounded-xl border border-line bg-frame", className)}
      {...rest}
    >
      <div
        ref={scroller}
        onScroll={(e) => measure(e.currentTarget)}
        // Leave room under the last row so the bar never covers a row you can't scroll to.
        className={cn("max-h-[inherit] min-h-0 flex-1 overflow-auto overscroll-contain transition-[padding] duration-200", open && actions && "pb-14")}
      >
        <table aria-labelledby={captionId} style={{ minWidth }} className="w-full border-separate border-spacing-0 text-[13px]">
          <caption id={captionId} className="sr-only">
            {caption}
          </caption>
          <colgroup>
            <col style={{ width: 44 }} />
            {columns.map((c) => (
              <col key={c.key} style={c.width != null ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-(--z-sticky) border-b border-line bg-frame p-0">
                <span className={cn("flex items-center justify-center", size === "sm" ? "h-8" : "h-9")}>
                  <SelectBox
                    boxRef={allBox}
                    checked={sel.all === true}
                    indeterminate={sel.all === "mixed"}
                    disabled={!ids.length}
                    onToggle={sel.toggleAll}
                    label="Select all rows"
                  />
                </span>
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-(--z-sticky) whitespace-nowrap border-b border-line bg-frame px-3 text-[12px] font-medium text-fg-3",
                    size === "sm" ? "h-8" : "h-9",
                    col.numeric ? "text-right" : "text-left",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((row) => {
                const id = getRowId(row);
                const on = sel.isSelected(id);
                return (
                  <motion.tr
                    key={id}
                    layout={reduce ? false : "position"}
                    // Removed rows fade where they stand; the rows below then close the gap. Restored rows fade back in.
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.2, ease: ease.out } }}
                    exit={{ opacity: 0, transition: { duration: reduce ? 0.1 : 0.14, ease: ease.in } }}
                    transition={spring.soft}
                    data-selected={on || undefined}
                    onMouseDown={(e) => {
                      // A shift-click is a range, not a text selection.
                      if (e.shiftKey) e.preventDefault();
                    }}
                    onClick={(e) => {
                      if (!rowClickSelects || (e.target as HTMLElement).closest(interactive)) return;
                      if (window.getSelection()?.toString()) return;
                      sel.toggle(id, { range: e.shiftKey });
                      // Keep focus with the row, so Space, Shift+Space and Esc carry on from where the pointer was.
                      e.currentTarget.querySelector<HTMLElement>("[role=checkbox]")?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
                    }}
                    className={cn(
                      "group/row relative bg-frame transition-colors duration-150",
                      rowClickSelects && "cursor-default",
                      on ? "bg-hover hover:bg-hover" : "hover:bg-hover",
                    )}
                  >
                    <td className={cn("relative border-b border-line p-0 group-last/row:border-b-0", h)}>
                      {/* A hairline down the leading edge marks selected rows even where the wash is faint. */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-0 left-0 w-0.5 origin-center bg-fg transition-[scale,opacity] duration-200 ease-out-expo motion-reduce:transition-none",
                          on ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
                        )}
                      />
                      <span className="flex h-full items-center justify-center">
                        <SelectBox
                          checked={on}
                          onToggle={() => sel.toggle(id, { range: shift.current })}
                          onShift={(v) => (shift.current = v)}
                          delay={sel.sweep.get(id)}
                          label={`Select ${getRowLabel ? getRowLabel(row) : id}`}
                        />
                      </span>
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "border-b border-line px-3 text-fg group-last/row:border-b-0",
                          h,
                          col.numeric ? "whitespace-nowrap text-right tabular" : "text-left",
                          col.className,
                        )}
                      >
                        {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="h-32 px-4 text-center text-[13px] text-fg-3">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 z-(--z-sticky) w-4 bg-linear-to-r from-overlay to-transparent transition-opacity duration-200", edges.left ? "opacity-50" : "opacity-0")} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 right-0 z-(--z-sticky) w-4 bg-linear-to-l from-overlay to-transparent transition-opacity duration-200", edges.right ? "opacity-50" : "opacity-0")} />

      {/* A selection that exists on first paint shows its bar in place; only later selections slide it up. */}
      <AnimatePresence initial={false}>
        {open && actions && (
          <BulkBar
            key="bar"
            count={sel.count}
            noun={noun}
            onClear={sel.clear}
            onFocus={() => (barFocus.current = true)}
            onBlur={(e) => {
              if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) barFocus.current = false;
            }}
          >
            {actions({ selected: sel.selected, clear: sel.clear })}
          </BulkBar>
        )}
      </AnimatePresence>

      <span role="status" aria-live="polite" className="sr-only">
        {sel.count ? phrase(sel.count) : ""}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The bar                                                             */
/* ------------------------------------------------------------------ */

function BulkBar({
  count,
  noun,
  onClear,
  onFocus,
  onBlur,
  children,
}: {
  count: number;
  noun?: { one: string; other: string };
  onClear: () => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="toolbar"
      aria-label="Bulk actions"
      onFocus={onFocus}
      onBlur={onBlur}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.14, ease: ease.in } }}
      transition={reduce ? { duration: 0.15 } : spring.snappy}
      className="absolute inset-x-0 bottom-2.5 z-(--z-dropdown) mx-auto flex h-10 w-max max-w-[calc(100%-20px)] origin-bottom items-center gap-0.5 rounded-xl border border-line-2 bg-raised pl-3 pr-1 shadow-pop"
    >
      <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap pr-2 text-[12.5px] text-fg">
        <NumberFlow value={count} className="font-medium tabular" />
        <span className="text-fg-2">
          {noun ? (count === 1 ? noun.one : noun.other) + " " : ""}selected
        </span>
      </span>
      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line-2" />
      <div className="flex min-w-0 items-center gap-0.5">{children}</div>
      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line-2" />
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection (Esc)"
        className="relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.92] pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export type BulkActionProps = Omit<React.ComponentProps<"button">, "onClick"> & {
  /** Runs the action. Return a promise and the button holds a spinner, at the same width, until it settles. */
  onAction?: () => void | Promise<unknown>;
  icon?: React.ReactNode;
  variant?: "default" | "danger";
};

/** A button sized and styled for the bulk action bar. */
export function BulkAction({ onAction, icon, variant = "default", disabled, className, children, ...rest }: BulkActionProps) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  return (
    <button
      type="button"
      data-variant={variant}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={async () => {
        if (busy) return;
        const result = onAction?.();
        if (result && typeof (result as Promise<unknown>).then === "function") {
          setBusy(true);
          try {
            await result;
          } finally {
            if (alive.current) setBusy(false);
          }
        }
      }}
      className={cn(
        "relative inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium outline-none",
        // On touch the target grows to the bar's full height and a 36px minimum width.
        "pointer-coarse:min-w-9 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2 pointer-coarse:after:content-['']",
        "transition-[background-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "danger" ? "text-danger hover:bg-danger-soft" : "text-fg hover:bg-hover",
        busy && "pointer-events-none",
        className,
      )}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-1.5 transition-opacity duration-150", busy && "opacity-0")}>
        {icon}
        {/* In a narrow table the bar keeps the icons and the labels go to screen readers only. */}
        <span className={cn(icon != null && "@max-[26rem]:sr-only")}>{children}</span>
      </span>
      {busy && (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <Loader size={14} className="motion-safe:animate-spin" />
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The checkbox                                                        */
/* ------------------------------------------------------------------ */

function SelectBox({
  boxRef,
  checked,
  indeterminate = false,
  disabled,
  onToggle,
  onShift,
  delay,
  label,
}: {
  boxRef?: React.Ref<HTMLSpanElement>;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onShift?: (shift: boolean) => void;
  /** Position in a shift-range sweep; the tick draws a beat after the one before it. */
  delay?: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  const shape = indeterminate ? "dash" : checked ? "check" : "none";
  const wait = reduce || delay == null ? 0 : Math.min(delay, 8) * 0.018;

  return (
    <Checkbox.Root
      ref={boxRef}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => onShift?.(e.shiftKey)}
      onKeyDown={(e) => onShift?.(e.shiftKey)}
      onCheckedChange={() => onToggle()}
      // In a shift-range the fill waits for its turn too, so the sweep reads as one motion.
      style={{ transitionDelay: checked && wait ? `${wait}s` : undefined }}
      className={(state) =>
        cn(
          "relative grid size-4 shrink-0 cursor-default place-items-center rounded-[4.5px] border outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 ease-out-expo motion-safe:active:scale-[0.86] active:duration-100",
          // The box draws at 16px; the target reaches the full cell.
          "after:absolute after:-inset-3 after:content-['']",
          state.checked || state.indeterminate ? "border-fg bg-fg text-frame" : "border-fg-4 bg-raised hover:border-fg-3",
          state.disabled && "opacity-40",
        )
      }
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden className="pointer-events-none size-full">
        <motion.path
          d="M3.75 8.25 6.75 11.25 12.25 4.75"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: shape === "check" ? 1 : 0, opacity: shape === "check" ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : shape === "check"
                ? { pathLength: { duration: 0.22, ease: ease.out, delay: 0.03 + wait }, opacity: { duration: 0.01, delay: 0.03 + wait } }
                : { duration: 0.1, ease: ease.in }
          }
        />
        <motion.path
          d="M4.5 8h7"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: shape === "dash" ? 1 : 0, opacity: shape === "dash" ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: shape === "dash" ? 0.18 : 0.08, ease: ease.out }}
        />
      </svg>
    </Checkbox.Root>
  );
}
