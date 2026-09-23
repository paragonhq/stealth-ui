"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type BoxRect = { x: number; y: number; width: number; height: number };
export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type ResizableBoxProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"> & {
  children?: React.ReactNode;
  /** Position inside the parent and size, in px. */
  value?: BoxRect;
  defaultValue?: BoxRect;
  /** Called at most once a frame while resizing, and once more when it settles. */
  onValueChange?: (rect: BoxRect) => void;
  /** Called once when a resize ends, with the final rect. */
  onResizeEnd?: (rect: BoxRect) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Keep the box inside its offset parent. */
  bounded?: boolean;
  /** Always keep the proportions, not only while Shift is held. */
  lockAspect?: boolean;
  handles?: ResizeHandle[];
  /** Show the width × height readout while resizing. */
  readout?: boolean;
  disabled?: boolean;
};

const ALL: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const cursors: Record<ResizeHandle, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
/** Past a limit the edge gives a little, and never more than `dim` px. */
const rubber = (over: number, dim = 14) => (over * dim * 0.55) / (dim + over * 0.55);

export function ResizableBox({
  children,
  value,
  defaultValue = { x: 0, y: 0, width: 240, height: 160 },
  onValueChange,
  onResizeEnd,
  minWidth = 48,
  minHeight = 48,
  maxWidth = Infinity,
  maxHeight = Infinity,
  bounded = true,
  lockAspect = false,
  handles = ALL,
  readout = true,
  disabled = false,
  className,
  style,
  onKeyDown,
  "aria-label": ariaLabel = "Resizable box",
  ...rest
}: ResizableBoxProps) {
  const reduce = useReducedMotion();
  const start = value ?? defaultValue;
  const x = useMotionValue(start.x);
  const y = useMotionValue(start.y);
  const w = useMotionValue(start.width);
  const h = useMotionValue(start.height);
  const initial = useRef(start);

  const [active, setActive] = useState<ResizeHandle | null>(null);
  const [locked, setLocked] = useState(false);
  const [limit, setLimit] = useState<"min" | "max" | null>(null);
  const [announce, setAnnounce] = useState("");
  const hintId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const anims = useRef<AnimationPlaybackControls[]>([]);
  const d = useRef({ id: -1, handle: "se" as ResizeHandle, x0: 0, y0: 0, px: 0, py: 0, r0: start, bounds: { w: Infinity, h: Infinity }, shift: false, alt: false });
  // The parent's height, for deciding where the readout fits. Kept as a motion value so render never reads a ref.
  const room = useMotionValue(Infinity);
  const announceTimer = useRef(0);
  const emit = useRef(0);

  const rect = (): BoxRect => ({ x: x.get(), y: y.get(), width: w.get(), height: h.get() });
  const stop = () => {
    anims.current.forEach((a) => a.stop());
    anims.current = [];
  };

  useEffect(
    () => () => {
      anims.current.forEach((a) => a.stop());
      window.clearTimeout(announceTimer.current);
      cancelAnimationFrame(emit.current);
    },
    [],
  );

  // A controlled value that changes from outside moves the box there, unless a hand is on it.
  useEffect(() => {
    if (!value || d.current.id !== -1) return;
    x.set(value.x);
    y.set(value.y);
    w.set(value.width);
    h.set(value.height);
  }, [value, x, y, w, h]);

  const report = () => {
    if (emit.current) return;
    emit.current = requestAnimationFrame(() => {
      emit.current = 0;
      onValueChange?.(rect());
    });
  };

  const parentSize = () => {
    const p = rootRef.current?.offsetParent as HTMLElement | null;
    return bounded && p ? { w: p.clientWidth, h: p.clientHeight } : { w: Infinity, h: Infinity };
  };

  /**
   * The geometry. Moves the dragged edges by (dx, dy), keeps the opposite edges fixed (or the
   * center, with Alt), holds the ratio when asked, then clamps: hard at the parent, soft at min/max.
   */
  function solve(handle: ResizeHandle, dx: number, dy: number, r0: BoxRect, bounds: { w: number; h: number }, keepRatio: boolean, fromCenter: boolean, soft: boolean) {
    const hasE = handle.includes("e");
    const hasW = handle.includes("w");
    const hasN = handle.includes("n");
    const hasS = handle.includes("s");
    const k = fromCenter ? 2 : 1;
    let width = r0.width + (hasE ? dx * k : hasW ? -dx * k : 0);
    let height = r0.height + (hasS ? dy * k : hasN ? -dy * k : 0);
    const ratio = r0.width / r0.height;

    if (keepRatio) {
      const horizontal = hasE || hasW;
      const vertical = hasN || hasS;
      // On a corner the axis that moved further (relative to size) leads; on an edge, that edge leads.
      if (horizontal && (!vertical || Math.abs(width / r0.width - 1) >= Math.abs(height / r0.height - 1))) height = width / ratio;
      else width = height * ratio;
    }

    // How much room each side has before it meets the parent.
    const cx = r0.x + r0.width / 2;
    const cy = r0.y + r0.height / 2;
    const roomW = fromCenter ? 2 * Math.min(cx, bounds.w - cx) : hasW ? r0.x + r0.width : hasE ? bounds.w - r0.x : keepRatio ? 2 * Math.min(cx, bounds.w - cx) : Infinity;
    const roomH = fromCenter ? 2 * Math.min(cy, bounds.h - cy) : hasN ? r0.y + r0.height : hasS ? bounds.h - r0.y : keepRatio ? 2 * Math.min(cy, bounds.h - cy) : Infinity;
    let loW = minWidth;
    let loH = minHeight;
    let hiW = Math.min(maxWidth, roomW);
    let hiH = Math.min(maxHeight, roomH);
    if (keepRatio) {
      loW = Math.max(loW, loH * ratio);
      hiW = Math.min(hiW, hiH * ratio);
      loH = loW / ratio;
      hiH = hiW / ratio;
    }

    let hit: "min" | "max" | null = null;
    const fit = (v: number, lo: number, hi: number, wall: number) => {
      if (v < lo) {
        hit = "min";
        return soft ? lo - rubber(lo - v) : lo;
      }
      if (v > hi) {
        hit = "max";
        // The parent is a wall; a max size is a limit you can lean on.
        return soft && hi < wall ? hi + rubber(v - hi) : hi;
      }
      return v;
    };
    width = fit(width, loW, hiW, roomW);
    height = keepRatio ? width / ratio : fit(height, loH, hiH, roomH);

    let nx = r0.x;
    let ny = r0.y;
    if (fromCenter) {
      nx = cx - width / 2;
      ny = cy - height / 2;
    } else {
      if (hasW) nx = r0.x + r0.width - width;
      else if (!hasE && keepRatio) nx = cx - width / 2;
      if (hasN) ny = r0.y + r0.height - height;
      else if (!hasS && keepRatio) ny = cy - height / 2;
    }
    return { rect: { x: nx, y: ny, width, height }, hit: hit as "min" | "max" | null };
  }

  const apply = (r: BoxRect) => {
    x.set(r.x);
    y.set(r.y);
    w.set(r.width);
    h.set(r.height);
    report();
  };

  const settle = (target: BoxRect) => {
    stop();
    if (reduce) apply(target);
    else anims.current = [animate(x, target.x, spring.snappy), animate(y, target.y, spring.snappy), animate(w, target.width, spring.snappy), animate(h, target.height, spring.snappy)];
    const unsub = w.on("change", report);
    const done = () => {
      unsub();
      onValueChange?.(target);
      onResizeEnd?.(target);
    };
    if (reduce || !anims.current.length) done();
    else Promise.all(anims.current.map((a) => a.finished)).then(done, done);
  };

  const recompute = () => {
    const s = d.current;
    if (s.id === -1) return;
    const { rect: r, hit } = solve(s.handle, s.px, s.py, s.r0, s.bounds, lockAspect || s.shift, s.alt, true);
    apply(r);
    setLimit(hit);
    setLocked(lockAspect || s.shift);
  };

  // ---- pointer on a handle -------------------------------------------------------------------

  function onHandleDown(handle: ResizeHandle, e: React.PointerEvent<HTMLSpanElement>) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    rootRef.current?.focus({ preventScroll: true });
    const bounds = parentSize();
    d.current = { id: e.pointerId, handle, x0: e.clientX, y0: e.clientY, px: 0, py: 0, r0: rect(), bounds, shift: e.shiftKey, alt: e.altKey };
    room.set(bounds.h);
    setActive(handle);
    setLocked(lockAspect || e.shiftKey);
    setLimit(null);
  }

  function onHandleMove(e: React.PointerEvent<HTMLSpanElement>) {
    const s = d.current;
    if (s.id !== e.pointerId) return;
    s.px = e.clientX - s.x0;
    s.py = e.clientY - s.y0;
    s.shift = e.shiftKey;
    s.alt = e.altKey;
    recompute();
  }

  function onHandleUp(e: React.PointerEvent<HTMLSpanElement>) {
    const s = d.current;
    if (s.id !== e.pointerId) return;
    s.id = -1;
    setActive(null);
    setLimit(null);
    setLocked(false);
    // Anything leaning past a limit springs back to it.
    const { rect: r } = solve(s.handle, s.px, s.py, s.r0, s.bounds, lockAspect || s.shift, s.alt, false);
    settle(r);
    say(r);
  }

  // Shift and Alt can change mid-drag without the pointer moving.
  const onModifier = useEffectEvent((e: KeyboardEvent) => {
    const s = d.current;
    if (s.id === -1) return;
    if (e.key === "Escape") {
      // Escape puts it back exactly where the drag began.
      s.id = -1;
      setActive(null);
      setLimit(null);
      setLocked(false);
      settle(s.r0);
      return;
    }
    if (e.key !== "Shift" && e.key !== "Alt") return;
    s.shift = e.shiftKey;
    s.alt = e.altKey;
    recompute();
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onModifier(e);
    window.addEventListener("keydown", h);
    window.addEventListener("keyup", h);
    return () => {
      window.removeEventListener("keydown", h);
      window.removeEventListener("keyup", h);
    };
  }, []);

  function onHandleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    // Back to the size it started at, keeping the top left corner where it is.
    const r0 = initial.current;
    const { rect: r } = solve("se", r0.width - w.get(), r0.height - h.get(), rect(), parentSize(), false, false, false);
    settle(r);
    say(r);
  }

  // ---- keyboard -----------------------------------------------------------------------------

  const say = (r: BoxRect) => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnounce(`${Math.round(r.width)} by ${Math.round(r.height)} pixels`), 350);
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled || e.target !== e.currentTarget || !e.key.startsWith("Arrow")) return;
    e.preventDefault();
    e.stopPropagation();
    stop();
    const step = e.shiftKey ? 10 : 1;
    const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? step : -step;
    // An arrow moves an edge in its direction: the right and bottom edges, or with Alt the left and top.
    const handle: ResizeHandle = horizontal ? (e.altKey ? "w" : "e") : e.altKey ? "n" : "s";
    const { rect: r, hit } = solve(handle, horizontal ? delta : 0, horizontal ? 0 : delta, rect(), parentSize(), lockAspect, false, false);
    apply(r);
    onValueChange?.(r);
    onResizeEnd?.(r);
    say(r);
    if (hit) {
      setLimit(hit);
      window.setTimeout(() => setLimit(null), 600);
    }
  }

  // ---- render -------------------------------------------------------------------------------

  const label = useTransform(() => `${Math.round(w.get())} × ${Math.round(h.get())}`);
  // The readout sits under the box, or inside its bottom edge when the parent has no room below.
  const below = useTransform(() => y.get() + h.get() + 40 < room.get());
  const readoutTop = useTransform(() => (below.get() ? h.get() + 10 : h.get() - 36));
  const dragging = active !== null;

  return (
    <motion.div
      ref={rootRef}
      tabIndex={disabled ? -1 : 0}
      role="group"
      aria-roledescription="resizable box"
      aria-label={ariaLabel}
      aria-describedby={hintId}
      data-state={dragging ? "resizing" : "idle"}
      data-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      style={{ ...style, left: x, top: y, width: w, height: h }}
      className={cn(
        "group/box absolute touch-none outline-none",
        // The frame: a hairline at rest, stronger when hovered, focused or held.
        "after:pointer-events-none after:absolute after:-inset-px after:rounded-[inherit] after:border after:border-transparent after:transition-[border-color] after:duration-150 after:content-['']",
        "hover:after:border-fg/40 focus-visible:after:border-fg/70 data-[state=resizing]:after:border-fg/70",
        className,
      )}
      {...rest}
    >
      {children}

      {/* Shift's ratio lock draws the diagonal it's holding. */}
      <AnimatePresence>
        {dragging && locked && (
          <motion.svg
            key="diagonal"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-fg/50"
          >
            <line
              x1={active === "ne" || active === "sw" ? "100%" : "0"}
              y1="0"
              x2={active === "ne" || active === "sw" ? "0" : "100%"}
              y2="100%"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {!disabled &&
        handles.map((hd) => (
          <Handle
            key={hd}
            handle={hd}
            active={active === hd}
            dimmed={dragging && active !== hd}
            onPointerDown={(e) => onHandleDown(hd, e)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onDoubleClick={onHandleDoubleClick}
          />
        ))}

      <AnimatePresence>
        {readout && dragging && (
          <motion.div
            key="readout"
            aria-hidden
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: ease.out }}
            style={{ top: readoutTop }}
            className="pointer-events-none absolute left-1/2 z-20 -ml-[60px] flex w-[120px] justify-center"
          >
            <span
              className={cn(
                "flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border border-line-2 bg-raised px-2 font-mono text-[11px] text-fg shadow-pop transition-colors duration-150",
                limit && "text-fg-2",
              )}
            >
              <motion.span className="tabular">{label}</motion.span>
              {locked && <LockGlyph />}
              {limit && <span className="text-2xs uppercase tracking-[0.08em] text-fg-3">{limit}</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <span id={hintId} className="sr-only">
        Drag a handle to resize. With the box focused, arrow keys resize from the right and bottom edges, Alt and arrows from the left and top, and Shift moves 10 pixels at a time.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </motion.div>
  );
}

function Handle({
  handle,
  active,
  dimmed,
  ...events
}: {
  handle: ResizeHandle;
  active: boolean;
  dimmed: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
}) {
  const corner = handle.length === 2;
  const pos: Record<ResizeHandle, string> = {
    nw: "left-0 top-0",
    n: "left-1/2 top-0",
    ne: "left-full top-0",
    e: "left-full top-1/2",
    se: "left-full top-full",
    s: "left-1/2 top-full",
    sw: "left-0 top-full",
    w: "left-0 top-1/2",
  };
  return (
    <span
      aria-hidden
      data-handle={handle}
      data-active={active || undefined}
      style={{ cursor: cursors[handle] }}
      {...events}
      className={cn(
        // The hit area is 20px on a mouse and 44px under a finger, centered on the edge or corner.
        "group/handle absolute z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center pointer-coarse:size-11",
        pos[handle],
        // Edge handles only take the middle of their edge; corners win where they meet.
        !corner && (handle === "n" || handle === "s" ? "w-[max(20px,calc(100%-40px))] pointer-coarse:w-[max(44px,calc(100%-88px))]" : "h-[max(20px,calc(100%-40px))] pointer-coarse:h-[max(44px,calc(100%-88px))]"),
        "transition-opacity duration-150",
        // Hidden until the box is hovered, focused or held, except on touch where there is no hover.
        "opacity-0 group-hover/box:opacity-100 group-focus-visible/box:opacity-100 group-data-[state=resizing]/box:opacity-100 pointer-coarse:opacity-100",
        dimmed && "opacity-40! group-hover/box:opacity-40!",
      )}
    >
      <span
        className={cn(
          "block border border-fg/70 bg-raised shadow-[var(--shadow)] transition-[scale,background-color] duration-150 ease-out-expo",
          corner ? "size-[9px] rounded-[3px]" : handle === "n" || handle === "s" ? "h-[5px] w-4 rounded-full" : "h-4 w-[5px] rounded-full",
          "group-hover/handle:scale-125 group-data-[active]/handle:scale-125 group-data-[active]/handle:bg-fg",
          "motion-reduce:group-hover/handle:scale-100 motion-reduce:group-data-[active]/handle:scale-100",
        )}
      />
    </span>
  );
}

function LockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg-3">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}
