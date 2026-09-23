"use client";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Children, createContext, Fragment, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/

type Cell = { left: number; top: number; width: number; height: number };
type Drag = { id: string; from: string[]; phase: "dragging" | "settling" };
type Lift = { id: string; from: string[] };

type GridContext = {
  order: string[];
  drag: Drag | null;
  lift: Lift | null;
  pressed: string | null;
  focusId: string | null;
  disabled: boolean;
  reduce: boolean;
  hintId: string;
  onPointerDown: (e: React.PointerEvent<HTMLElement>, id: string, disabled: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, id: string, label: string, disabled: boolean) => void;
  onFocus: (id: string) => void;
  onBlur: (e: React.FocusEvent<HTMLElement>, id: string, label: string) => void;
};

const GridCtx = createContext<GridContext | null>(null);

// Mouse and pen start dragging after a few pixels, so a click stays a click. Touch waits for a
// short hold instead, so a swipe over the grid still scrolls the page.
const THRESHOLD = 5;
const HOLD_MS = 240;
const HOLD_SLOP = 8;

const tileClass = cn(
  "relative h-full min-w-0 select-none rounded-xl border border-line bg-raised p-3 text-left text-fg shadow-[var(--shadow)]",
  "[-webkit-touch-callout:none]",
);

/* -------------------------------------------------------------------------------------------------
 * SortableGrid
 * -----------------------------------------------------------------------------------------------*/

export type SortableGridProps = Omit<
  React.ComponentProps<"ul">,
  "children" | "defaultValue" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  /** The order, as item values. Controlled. */
  value?: string[];
  /** The starting order when uncontrolled. Defaults to the order the children are written in. */
  defaultValue?: string[];
  /** Called whenever the order changes, including live while a tile is dragged. */
  onValueChange?: (value: string[]) => void;
  /** Called once when a tile is dropped somewhere new. The place to save. */
  onValueCommitted?: (value: string[]) => void;
  /** Stops every tile from being picked up. */
  disabled?: boolean;
  /** SortableGridItem elements, each with a unique value. */
  children: React.ReactNode;
};

/** A grid of tiles that are reordered by dragging them anywhere, or with the keyboard. */
export function SortableGrid({
  value,
  defaultValue,
  onValueChange,
  onValueCommitted,
  disabled = false,
  className,
  children,
  ...rest
}: SortableGridProps) {
  const items = Children.toArray(children).filter((c) => isValidElement<SortableGridItemProps>(c));
  const childIds = items.map((c) => c.props.value);
  const [stored, setStored] = useControllableState({ value, defaultValue: defaultValue ?? childIds, onChange: onValueChange });
  const order = [...stored.filter((id) => childIds.includes(id)), ...childIds.filter((id) => !stored.includes(id))];
  const byId = new Map(items.map((c) => [c.props.value, c]));

  const reduce = !!useReducedMotion();
  const hintId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // The ghost that follows the pointer, in the list's own coordinates.
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const gScale = useMotionValue(1);
  const [ghostSize, setGhostSize] = useState({ width: 0, height: 0 });

  // Everything a live gesture needs, kept out of render.
  const session = useRef<{
    id: string;
    label: string;
    pointerId: number;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    cells: Cell[];
    from: string[];
    order: string[];
    started: boolean;
    hold?: number;
    cleanup: () => void;
  } | null>(null);

  const at = (ids: string[], id: string) => `position ${ids.indexOf(id) + 1} of ${ids.length}`;
  const labelOf = (id: string) => byId.get(id)?.props.label ?? id;

  // Every slot's box, read from layout (offsets ignore the springs in flight) in DOM order.
  const measureCells = (): Cell[] => {
    const list = listRef.current;
    if (!list) return [];
    return Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-slot]")).map((el) => ({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    }));
  };

  const columns = (cells: Cell[]) => Math.max(1, cells.filter((c) => Math.abs(c.top - cells[0]?.top) < 2).length);

  const reorder = (ids: string[], id: string, to: number) => {
    const next = [...ids];
    next.splice(to, 0, next.splice(next.indexOf(id), 1)[0]);
    return next;
  };

  const endSession = () => {
    const s = session.current;
    if (!s) return;
    window.clearTimeout(s.hold);
    s.cleanup();
    session.current = null;
  };

  // Clean up a gesture that's still live when the grid unmounts.
  useEffect(
    () => () => {
      const s = session.current;
      if (!s) return;
      window.clearTimeout(s.hold);
      s.cleanup();
    },
    [],
  );

  useGrabbingCursor(drag?.phase === "dragging");

  const beginDrag = () => {
    const s = session.current;
    if (!s) return;
    s.started = true;
    const cell = s.cells[s.from.indexOf(s.id)];
    setGhostSize({ width: cell.width, height: cell.height });
    gx.set(cell.left);
    gy.set(cell.top);
    gScale.set(1);
    if (!reduce) animate(gScale, 1.04, spring.snappy);
    setPressed(null);
    setDrag({ id: s.id, from: s.from, phase: "dragging" });
    setMessage(`${s.label} picked up, ${at(s.from, s.id)}.`);
  };

  const settle = (finalOrder: string[], canceled: boolean) => {
    const s = session.current;
    if (!s) return;
    const { id, label, cells, from } = s;
    endSession();
    const target = cells[finalOrder.indexOf(id)];
    setDrag({ id, from, phase: "settling" });
    const done = () => setDrag((d) => (d?.id === id ? null : d));
    if (reduce || !target) {
      done();
    } else {
      animate(gx, target.left, spring.soft);
      animate(gScale, 1, spring.soft);
      animate(gy, target.top, spring.soft).then(done);
    }
    if (canceled) {
      setMessage(`Move canceled. ${label} is back at ${at(finalOrder, id)}.`);
    } else {
      setMessage(`${label} dropped, ${at(finalOrder, id)}.`);
      if (from.join() !== finalOrder.join()) onValueCommitted?.(finalOrder);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string, itemDisabled: boolean) => {
    if (disabled || itemDisabled || drag || lift || session.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const list = listRef.current;
    const slot = e.currentTarget.closest<HTMLElement>("[data-slot]");
    if (!list || !slot) return;
    const rect = list.getBoundingClientRect();
    const touch = e.pointerType === "touch";

    const onMove = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      const dx = ev.clientX - s.startX;
      const dy = ev.clientY - s.startY;
      if (!s.started) {
        if (touch) {
          // Moved before the hold finished: that was a scroll, not a pick-up.
          if (Math.hypot(dx, dy) > HOLD_SLOP) {
            endSession();
            setPressed(null);
          }
          return;
        }
        if (Math.hypot(dx, dy) < THRESHOLD) return;
        beginDrag();
      }
      const box = list.getBoundingClientRect();
      const x = ev.clientX - box.left - s.grabX;
      const y = ev.clientY - box.top - s.grabY;
      gx.set(x);
      gy.set(y);
      // The slot under the ghost's center wins. The gutters belong to nobody, so the order holds
      // steady while the ghost crosses them instead of flickering between neighbors.
      const cx = x + s.cells[0].width / 2;
      const cy = y + s.cells[0].height / 2;
      const over = s.cells.findIndex((c) => cx >= c.left && cx <= c.left + c.width && cy >= c.top && cy <= c.top + c.height);
      if (over >= 0 && s.order.indexOf(s.id) !== over) {
        s.order = reorder(s.order, s.id, over);
        setStored(s.order);
      }
    };
    const onUp = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.started) {
        endSession();
        setPressed(null);
        return;
      }
      settle(s.order, false);
    };
    const onCancel = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.started) {
        endSession();
        setPressed(null);
        return;
      }
      setStored(s.from);
      settle(s.from, true);
    };
    const onKey = (ev: KeyboardEvent) => {
      const s = session.current;
      if (ev.key !== "Escape" || !s?.started) return;
      ev.preventDefault();
      setStored(s.from);
      settle(s.from, true);
    };
    // Once a touch drag has started, the page must not scroll under the finger.
    const onTouchMove = (ev: TouchEvent) => {
      if (session.current?.started) ev.preventDefault();
    };
    const onContext = (ev: Event) => {
      if (session.current) ev.preventDefault();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("contextmenu", onContext);

    session.current = {
      id,
      label: labelOf(id),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - rect.left - slot.offsetLeft,
      grabY: e.clientY - rect.top - slot.offsetTop,
      cells: measureCells(),
      from: order,
      order,
      started: false,
      hold: touch ? window.setTimeout(beginDrag, HOLD_MS) : undefined,
      cleanup: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("contextmenu", onContext);
      },
    };
    setPressed(id);
  };

  const focusTile = (id: string) => {
    setFocusId(id);
    listRef.current?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(id)}"] [data-tile]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>, id: string, label: string, itemDisabled: boolean) => {
    if (drag) return;
    const cells = measureCells();
    const cols = columns(cells);
    const index = order.indexOf(id);
    const lifted = lift?.id === id;
    const delta =
      e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -cols : e.key === "ArrowDown" ? cols : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? order.length - 1 : null;

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lifted) {
        setLift(null);
        setMessage(`${label} dropped, ${at(order, id)}.`);
        if (lift.from.join() !== order.join()) onValueCommitted?.(order);
      } else if (!disabled && !itemDisabled) {
        setLift({ id, from: order });
        setMessage(`${label} picked up, ${at(order, id)}. Arrow keys move it, Space drops it, Escape cancels.`);
      }
    } else if (lifted && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setStored(lift.from);
      setLift(null);
      setMessage(`Move canceled. ${label} is back at ${at(lift.from, id)}.`);
    } else if (delta || jump !== null) {
      e.preventDefault();
      const to = jump ?? index + delta;
      if (to < 0 || to >= order.length || to === index) return;
      if (lifted) {
        const next = reorder(order, id, to);
        setStored(next);
        setMessage(`${label}, ${at(next, id)}.`);
      } else {
        focusTile(order[to]);
      }
    }
  };

  // Reordering moves the focused node in the DOM, which can drop focus. Put it back on the lifted tile.
  useLayoutEffect(() => {
    if (!lift) return;
    const tile = listRef.current?.querySelector<HTMLElement>(`[data-slot="${CSS.escape(lift.id)}"] [data-tile]`);
    if (tile && document.activeElement !== tile) tile.focus({ preventScroll: true });
  });

  const ctx: GridContext = {
    order,
    drag,
    lift,
    pressed,
    focusId: focusId && order.includes(focusId) ? focusId : (order[0] ?? null),
    disabled,
    reduce,
    hintId,
    onPointerDown,
    onKeyDown,
    onFocus: setFocusId,
    onBlur(e, id, label) {
      const node = e.currentTarget;
      // Blur caused by the reorder itself is refocused above; a real Tab away drops the tile.
      window.setTimeout(() => {
        if (document.activeElement === node || lift?.id !== id) return;
        setLift(null);
        setMessage(`${label} dropped, ${at(order, id)}.`);
        if (lift.from.join() !== order.join()) onValueCommitted?.(order);
      }, 0);
    },
  };

  const ghost = drag ? byId.get(drag.id) : undefined;

  return (
    <GridCtx.Provider value={ctx}>
      <ul
        ref={listRef}
        data-dragging={drag ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        // Default columns and gap only when the caller hasn't set their own, so theirs never fight ours.
        className={cn("relative grid", !/\bgap-/.test(className ?? "") && "gap-2", !className?.includes("grid-cols") && "grid-cols-2 sm:grid-cols-3", className)}
        {...rest}
      >
        {/* Keyed by value, so unkeyed children still keep their identity as they move. */}
        {order.map((id) => (
          <Fragment key={id}>{byId.get(id)}</Fragment>
        ))}
        {ghost && (
          <motion.li
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 list-none"
            style={{ x: gx, y: gy, scale: gScale, width: ghostSize.width, height: ghostSize.height }}
          >
            <div
              data-phase={drag?.phase}
              className={cn(
                tileClass,
                "cursor-grabbing border-line-2 shadow-pop transition-[box-shadow,border-color] duration-200",
                "data-[phase=settling]:border-line data-[phase=settling]:shadow-[var(--shadow)]",
                ghost.props.className,
              )}
            >
              {ghost.props.children}
            </div>
          </motion.li>
        )}
      </ul>
      <span id={hintId} className="sr-only">
        Press Space to pick up a tile, the arrow keys to move it, Space again to drop it and Escape to cancel.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </GridCtx.Provider>
  );
}

// While something is in the air the cursor stays a closed hand everywhere, and text can't be selected.
function useGrabbingCursor(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const style = document.body.style;
    const prev = { cursor: style.cursor, userSelect: style.userSelect };
    style.cursor = "grabbing";
    style.userSelect = "none";
    return () => {
      style.cursor = prev.cursor;
      style.userSelect = prev.userSelect;
    };
  }, [on]);
}

/* -------------------------------------------------------------------------------------------------
 * SortableGridItem
 * -----------------------------------------------------------------------------------------------*/

export type SortableGridItemProps = Omit<
  React.ComponentProps<"div">,
  "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  /** Unique within the grid. */
  value: string;
  /** Plain-text name, used as the tile's accessible name and in announcements. */
  label: string;
  /** This tile can't be picked up. Others can still move past it. */
  disabled?: boolean;
  /** Display content. The whole tile is the drag handle, so keep other controls out of it. */
  children?: React.ReactNode;
};

export function SortableGridItem({ value, label, disabled = false, className, children, ...rest }: SortableGridItemProps) {
  const grid = useContext(GridCtx);
  if (!grid) throw new Error("SortableGridItem must be used inside SortableGrid");
  const off = disabled || grid.disabled;
  const dragged = grid.drag?.id === value;
  const lifted = grid.lift?.id === value;
  const pressed = grid.pressed === value;

  return (
    <motion.li
      data-slot={value}
      layout={grid.reduce ? false : "position"}
      transition={grid.lift ? spring.snappy : spring.soft}
      className={cn("relative list-none", lifted && "z-10")}
    >
      {/* The slot the tile will land in: a quiet outline while its tile is in the air. */}
      {dragged && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-xl border border-dashed border-line-2 bg-fg/[0.02]"
        />
      )}
      <motion.div
        data-tile=""
        role="button"
        tabIndex={grid.focusId === value ? 0 : -1}
        aria-roledescription="sortable tile"
        aria-label={label}
        aria-describedby={grid.hintId}
        aria-pressed={lifted}
        aria-disabled={off || undefined}
        data-lifted={lifted ? "" : undefined}
        data-pressed={pressed ? "" : undefined}
        data-disabled={off ? "" : undefined}
        onPointerDown={(e) => grid.onPointerDown(e, value, off)}
        onKeyDown={(e) => grid.onKeyDown(e, value, label, off)}
        onFocus={() => grid.onFocus(value)}
        onBlur={(e) => grid.onBlur(e, value, label)}
        animate={{ scale: grid.reduce ? 1 : lifted ? 1.04 : pressed ? 0.98 : 1 }}
        transition={spring.snappy}
        className={cn(
          tileClass,
          "outline-none transition-[border-color,box-shadow] duration-200 ease-out-quart",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          !off && "cursor-grab touch-manipulation",
          "data-lifted:border-line-2 data-lifted:shadow-pop",
          "data-disabled:cursor-default data-disabled:opacity-60",
          dragged && "opacity-0",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.div>
    </motion.li>
  );
}
