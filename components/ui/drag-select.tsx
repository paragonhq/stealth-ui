"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/

type Ctx = {
  selected: string[];
  setSelected: (next: string[]) => void;
  focusId: string | null;
  setFocusId: (id: string | null) => void;
  disabled: boolean;
  reduce: boolean;
  onOpenItem?: (id: string) => void;
  areaRef: React.RefObject<HTMLDivElement | null>;
  anchorRef: React.RefObject<string | null>;
  total: number;
  first: string | null;
  setInfo: React.Dispatch<React.SetStateAction<{ total: number; first: string | null }>>;
};

const SelectCtx = createContext<Ctx | null>(null);
const useCtx = (part: string) => {
  const ctx = useContext(SelectCtx);
  if (!ctx) throw new Error(`${part} must be used inside DragSelect`);
  return ctx;
};

// A press only becomes a marquee after the pointer travels this far, so clicks stay clicks.
const THRESHOLD = 4;
// Within this distance of the top or bottom edge, the area scrolls itself while you drag.
const EDGE = 36;

const itemsIn = (area: HTMLElement | null) => Array.from(area?.querySelectorAll<HTMLElement>("[data-select-id]") ?? []);
const idOf = (el: Element) => (el as HTMLElement).dataset.selectId!;
const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/* -------------------------------------------------------------------------------------------------
 * DragSelect
 * -----------------------------------------------------------------------------------------------*/

export type DragSelectProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** Selected item values. Controlled. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Double-click or Enter on an item. */
  onOpenItem?: (value: string) => void;
  disabled?: boolean;
};

/** Holds the selection. Put a DragSelectArea (and optionally a DragSelectCount) inside. */
export function DragSelect({ value, defaultValue, onValueChange, onOpenItem, disabled = false, className, children, ...rest }: DragSelectProps) {
  const [selected, setSelected] = useControllableState({ value, defaultValue: defaultValue ?? [], onChange: onValueChange });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [{ total, first }, setInfo] = useState<{ total: number; first: string | null }>({ total: 0, first: null });
  const reduce = !!useReducedMotion();
  const areaRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<string | null>(null);

  return (
    <SelectCtx.Provider
      value={{ selected, setSelected, focusId, setFocusId, disabled, reduce, onOpenItem, areaRef, anchorRef, total, first, setInfo }}
    >
      <div data-disabled={disabled ? "" : undefined} className={cn("flex min-h-0 flex-col", className)} {...rest}>
        {children}
      </div>
    </SelectCtx.Provider>
  );
}

/** The selection and helpers, for toolbars that act on it. */
export function useDragSelect() {
  const ctx = useCtx("useDragSelect");
  return {
    selected: ctx.selected,
    total: ctx.total,
    clear: () => ctx.setSelected([]),
    selectAll: () => ctx.setSelected(itemsIn(ctx.areaRef.current).map(idOf)),
  };
}

/* -------------------------------------------------------------------------------------------------
 * DragSelectArea
 * -----------------------------------------------------------------------------------------------*/

type Rect = { x: number; y: number; w: number; h: number };

export type DragSelectAreaProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Names the list for assistive tech, e.g. "Files in Q3 planning". */
  label: string;
  /** Classes for the inner grid that lays out the items. */
  gridClassName?: string;
  children: React.ReactNode;
};

/** The scrolling surface you drag across. Items go inside. */
export function DragSelectArea({ label, gridClassName, className, children, onPointerDown, onKeyDown, ...rest }: DragSelectAreaProps) {
  const ctx = useCtx("DragSelectArea");
  const { selected, setSelected, setFocusId, disabled, reduce, areaRef, anchorRef, setInfo } = ctx;
  const hintId = useId();
  const [box, setBox] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);

  const session = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
    item: string | null;
    mode: "replace" | "add" | "toggle";
    base: string[];
    rects: { id: string; x: number; y: number; w: number; h: number }[];
    started: boolean;
    last: string[];
    frame?: number;
    cleanup: () => void;
  } | null>(null);

  // Keep the item count (for DragSelectCount) and the first item (the default tab stop) in step with the DOM.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const sync = () => {
      const els = itemsIn(area);
      const total = els.length;
      const first = els[0] ? idOf(els[0]) : null;
      setInfo((prev) => (prev.total === total && prev.first === first ? prev : { total, first }));
    };
    const mo = new MutationObserver(sync);
    mo.observe(area, { childList: true, subtree: true });
    const raf = requestAnimationFrame(sync);
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [areaRef, setInfo]);

  useEffect(
    () => () => {
      const s = session.current;
      if (!s) return;
      if (s.frame) cancelAnimationFrame(s.frame);
      s.cleanup();
    },
    [],
  );

  // A point in the area's scrollable content, so the marquee stays pinned to the content as it scrolls.
  const toContent = (clientX: number, clientY: number) => {
    const area = areaRef.current!;
    const r = area.getBoundingClientRect();
    return { x: clientX - r.left - area.clientLeft + area.scrollLeft, y: clientY - r.top - area.clientTop + area.scrollTop };
  };

  const update = () => {
    const s = session.current;
    if (!s) return;
    const p = toContent(s.clientX, s.clientY);
    const rect = { x: Math.min(s.startX, p.x), y: Math.min(s.startY, p.y), w: Math.abs(p.x - s.startX), h: Math.abs(p.y - s.startY) };
    setBox(rect);
    const hits = s.rects
      .filter((r) => r.x < rect.x + rect.w && r.x + r.w > rect.x && r.y < rect.y + rect.h && r.y + r.h > rect.y)
      .map((r) => r.id);
    const order = s.rects.map((r) => r.id);
    const next =
      s.mode === "replace"
        ? hits
        : s.mode === "add"
          ? order.filter((id) => s.base.includes(id) || hits.includes(id))
          : order.filter((id) => s.base.includes(id) !== hits.includes(id));
    if (!same(next, s.last)) {
      s.last = next;
      setSelected(next);
    }
  };

  const autoScroll = () => {
    const s = session.current;
    const area = areaRef.current;
    if (!s?.started || !area) return;
    const r = area.getBoundingClientRect();
    const speed = (d: number) => Math.ceil((1 - Math.max(0, d) / EDGE) * 16);
    const max = area.scrollHeight - area.clientHeight;
    const dy =
      s.clientY < r.top + EDGE && area.scrollTop > 0 ? -speed(s.clientY - r.top) : s.clientY > r.bottom - EDGE && area.scrollTop < max ? speed(r.bottom - s.clientY) : 0;
    if (dy) {
      area.scrollTop += dy;
      update();
    }
    s.frame = requestAnimationFrame(autoScroll);
  };

  const finish = (cancel: boolean) => {
    const s = session.current;
    if (!s) return;
    if (s.frame) cancelAnimationFrame(s.frame);
    s.cleanup();
    session.current = null;
    setBox(null);
    setDragging(false);
    if (cancel) setSelected(s.base);
  };

  const clickItem = (id: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }, touch: boolean) => {
    const order = itemsIn(areaRef.current).map(idOf);
    const toggle = e.metaKey || e.ctrlKey || touch;
    if (e.shiftKey && anchorRef.current && order.includes(anchorRef.current)) {
      const [a, b] = [order.indexOf(anchorRef.current), order.indexOf(id)].sort((x, y) => x - y);
      const range = order.slice(a, b + 1);
      setSelected(toggle ? order.filter((v) => selected.includes(v) || range.includes(v)) : range);
    } else if (toggle) {
      setSelected(selected.includes(id) ? selected.filter((v) => v !== id) : order.filter((v) => v === id || selected.includes(v)));
      anchorRef.current = id;
    } else {
      setSelected([id]);
      anchorRef.current = id;
    }
    setFocusId(id);
    itemsIn(areaRef.current)
      .find((el) => idOf(el) === id)
      ?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={areaRef}
      data-dragging={dragging ? "" : undefined}
      data-has-selection={selected.length ? "" : undefined}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.defaultPrevented || disabled) return;
        const touch = e.pointerType === "touch";
        if (!touch && e.button !== 0) return;
        // Leave the scrollbar alone.
        const area = e.currentTarget;
        const r = area.getBoundingClientRect();
        if (e.clientX > r.left + area.clientLeft + area.clientWidth) return;
        const itemEl = (e.target as Element).closest<HTMLElement>("[data-select-id]");
        const item = itemEl ? idOf(itemEl) : null;
        const start = toContent(e.clientX, e.clientY);
        const mode = e.shiftKey ? "add" : e.metaKey || e.ctrlKey ? "toggle" : "replace";
        if (!touch) e.preventDefault();

        const onMove = (ev: PointerEvent) => {
          const s = session.current;
          if (!s || ev.pointerId !== s.pointerId) return;
          s.clientX = ev.clientX;
          s.clientY = ev.clientY;
          if (!s.started) {
            // A finger dragging over the grid is a scroll; marquee is for mouse and pen.
            if (touch) return;
            const p = toContent(ev.clientX, ev.clientY);
            if (Math.hypot(p.x - s.startX, p.y - s.startY) < THRESHOLD) return;
            s.started = true;
            setDragging(true);
            s.frame = requestAnimationFrame(autoScroll);
          }
          update();
        };
        const onUp = (ev: PointerEvent) => {
          const s = session.current;
          if (!s || ev.pointerId !== s.pointerId) return;
          const wasClick = !s.started;
          finish(false);
          if (!wasClick) return;
          if (s.item) clickItem(s.item, ev, touch);
          else if (!touch && s.mode === "replace") setSelected([]);
        };
        const onCancel = (ev: PointerEvent) => {
          if (session.current?.pointerId === ev.pointerId) finish(true);
        };
        const onKey = (ev: KeyboardEvent) => {
          if (ev.key !== "Escape" || !session.current?.started) return;
          ev.preventDefault();
          ev.stopPropagation();
          finish(true);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKey, true);

        // Item boxes in content coordinates, read once: nothing moves while you drag.
        const rects = itemsIn(area).map((el) => {
          const b = el.getBoundingClientRect();
          const p = toContent(b.left, b.top);
          return { id: idOf(el), x: p.x, y: p.y, w: b.width, h: b.height };
        });
        session.current = {
          pointerId: e.pointerId,
          startX: start.x,
          startY: start.y,
          clientX: e.clientX,
          clientY: e.clientY,
          item,
          mode,
          base: selected,
          rects,
          started: false,
          last: selected,
          cleanup: () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onCancel);
            window.removeEventListener("keydown", onKey, true);
          },
        };
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || disabled) return;
        handleKey(e, ctx);
      }}
      className={cn(
        "relative min-h-0 flex-1 select-none overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-touch-callout:none]",
        "data-dragging:cursor-crosshair",
        className,
      )}
      {...rest}
    >
      <div
        role="listbox"
        aria-multiselectable
        aria-label={label}
        aria-describedby={hintId}
        aria-disabled={disabled || undefined}
        className={cn("grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1 p-2", gridClassName)}
      >
        {children}
      </div>
      <AnimatePresence>
        {box && (box.w > 0 || box.h > 0) && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 rounded-[3px] border border-fg-3/60 bg-fg/[0.06]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12, ease: ease.out } }}
            transition={{ duration: reduce ? 0 : 0.08 }}
            style={{ x: box.x, y: box.y, width: box.w, height: box.h }}
          />
        )}
      </AnimatePresence>
      <span id={hintId} className="sr-only">
        Arrow keys move, Space selects, Shift with an arrow extends the selection, Control or Command A selects all, Escape clears.
      </span>
    </div>
  );
}

// The listbox keyboard model, in a grid: arrows move in two dimensions and Shift extends from the anchorRef.
function handleKey(e: React.KeyboardEvent, ctx: Ctx) {
  const { selected, setSelected, focusId, setFocusId, anchorRef, onOpenItem, areaRef } = ctx;
  const els = itemsIn(areaRef.current);
  if (!els.length) return;
  const order = els.map(idOf);
  const current = focusId && order.includes(focusId) ? order.indexOf(focusId) : 0;
  const top = els[0].offsetTop;
  const cols = Math.max(1, els.filter((el) => Math.abs(el.offsetTop - top) < 2).length);
  const focus = (i: number) => {
    const id = order[i];
    setFocusId(id);
    els[i].focus({ preventScroll: true });
    els[i].scrollIntoView({ block: "nearest" });
    return id;
  };

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
    e.preventDefault();
    setSelected(order);
    return;
  }
  const delta =
    e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? cols : e.key === "ArrowUp" ? -cols : 0;
  const jump = e.key === "Home" ? 0 : e.key === "End" ? order.length - 1 : null;
  if (delta || jump !== null) {
    e.preventDefault();
    const to = jump ?? Math.max(0, Math.min(order.length - 1, current + delta));
    const id = focus(to);
    if (e.shiftKey) {
      const from = anchorRef.current && order.includes(anchorRef.current) ? order.indexOf(anchorRef.current) : current;
      if (!anchorRef.current) anchorRef.current = order[current];
      const [a, b] = [from, to].sort((x, y) => x - y);
      setSelected(order.slice(a, b + 1));
    } else {
      anchorRef.current = id;
    }
  } else if (e.key === " ") {
    e.preventDefault();
    const id = order[current];
    anchorRef.current = id;
    setSelected(selected.includes(id) ? selected.filter((v) => v !== id) : order.filter((v) => v === id || selected.includes(v)));
  } else if (e.key === "Enter" && onOpenItem) {
    e.preventDefault();
    onOpenItem(order[current]);
  } else if (e.key === "Escape" && selected.length) {
    e.preventDefault();
    e.stopPropagation();
    setSelected([]);
  }
}

/* -------------------------------------------------------------------------------------------------
 * DragSelectItem
 * -----------------------------------------------------------------------------------------------*/

export type DragSelectItemProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Unique within the area. */
  value: string;
  /** Accessible name, e.g. the file name. */
  label: string;
  children: React.ReactNode;
};

export function DragSelectItem({ value, label, className, children, onDoubleClick, ...rest }: DragSelectItemProps) {
  const ctx = useCtx("DragSelectItem");
  const checked = ctx.selected.includes(value);
  // Before anything has focus, the first item holds the tab stop.
  const tabbable = ctx.focusId ? ctx.focusId === value : ctx.first === value;

  return (
    <div
      role="option"
      aria-selected={checked}
      aria-label={label}
      tabIndex={tabbable ? 0 : -1}
      data-select-id={value}
      data-selected={checked ? "" : undefined}
      onFocus={() => ctx.setFocusId(value)}
      onDoubleClick={(e) => {
        onDoubleClick?.(e);
        ctx.onOpenItem?.(value);
      }}
      className={cn(
        "group/item relative min-w-0 rounded-lg p-2 outline-none",
        "transition-[background-color,box-shadow] duration-150 ease-out-quart",
        "hover:bg-fg/[0.04] in-data-dragging:hover:bg-transparent",
        "data-selected:bg-fg/[0.07] data-selected:shadow-[inset_0_0_0_1px_var(--line-2)] data-selected:hover:bg-fg/[0.08]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <Check checked={checked} reduce={ctx.reduce} />
      {children}
    </div>
  );
}

// The corner check: present on hover, focus and whenever anything is selected; always there on touch.
function Check({ checked, reduce }: { checked: boolean; reduce: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-1.5 top-1.5 z-1 grid size-4 place-items-center rounded-full border transition-[opacity,background-color,border-color,scale] duration-150",
        checked
          ? "scale-100 border-fg bg-fg text-frame opacity-100"
          : "border-fg-4 bg-raised text-transparent opacity-0 group-hover/item:opacity-100 group-focus-visible/item:opacity-100 pointer-coarse:opacity-100 in-[[data-has-selection]]:opacity-100",
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <motion.path
          d="M2.25 5.25 4.25 7.25 7.75 3"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : checked ? 0.22 : 0.08, ease: ease.out }}
        />
      </svg>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DragSelectCount
 * -----------------------------------------------------------------------------------------------*/

export type DragSelectCountProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** What's being counted, singular and plural. */
  noun?: [string, string];
};

/** "3 files selected", rolling as the marquee grows. Falls back to the total when nothing is selected. */
export function DragSelectCount({ noun = ["item", "items"], className, ...rest }: DragSelectCountProps) {
  const ctx = useCtx("DragSelectCount");
  const n = ctx.selected.length;
  const shown = n || ctx.total;
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-baseline gap-1 text-[12.5px] tabular", className)} {...rest}>
      <NumberFlow value={shown} animated={!ctx.reduce} className={n ? "font-medium text-fg" : "text-fg-2"} />
      <span className={n ? "text-fg-2" : "text-fg-3"}>
        {shown === 1 ? noun[0] : noun[1]}
        {n ? " selected" : ""}
      </span>
    </span>
  );
}
