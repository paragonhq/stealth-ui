"use client";
import NumberFlow from "@number-flow/react";
import { Tooltip } from "@base-ui/react/tooltip";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";
import { createContext, useContext, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Maximize, Minus, Plus } from "@/lib/icons";
import { ease } from "@/lib/motion";

export type CanvasView = { x: number; y: number; scale: number };

type Api = {
  zoomIn: () => void;
  zoomOut: () => void;
  /** Back to 100%, keeping the middle of the view where it is. */
  reset: () => void;
  /** Frame everything on the canvas. */
  fit: (animated?: boolean) => void;
  zoomTo: (scale: number, focal?: { x: number; y: number }, animated?: boolean) => void;
  panBy: (dx: number, dy: number, animated?: boolean) => void;
  scale: number;
  minScale: number;
  maxScale: number;
};

const CanvasContext = createContext<Api | null>(null);

/** Zoom and pan actions for custom controls rendered inside the canvas. */
export function usePanZoom() {
  const api = useContext(CanvasContext);
  if (!api) throw new Error("usePanZoom must be used inside <PanZoomCanvas>");
  return api;
}

export type PanZoomCanvasProps = Omit<React.ComponentProps<"div">, "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"> & {
  children?: React.ReactNode;
  view?: CanvasView;
  /** A starting view, or "fit" to frame the content on mount. */
  defaultView?: CanvasView | "fit";
  onViewChange?: (view: CanvasView) => void;
  minScale?: number;
  maxScale?: number;
  /** "auto" zooms with a mouse wheel and pans with a trackpad; pinch and ⌘/Ctrl + scroll always zoom. */
  wheel?: "auto" | "zoom" | "pan";
  grid?: boolean;
  /** World units between grid dots. */
  gridSize?: number;
  /** The zoom controls in the corner. Pass false to render your own with usePanZoom. */
  controls?: boolean;
  /** Padding in px around the content when fitting. */
  fitPadding?: number;
  /** Height of the viewport. Pass "100%" to fill a sized parent. */
  height?: number | string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pointer velocity in px/s over the last 90ms of samples, or null if there's too little to tell. */
function releaseVelocity(samples: { t: number; x: number; y: number }[]) {
  const now = performance.now();
  const recent = samples.filter((p) => now - p.t < 90);
  if (recent.length < 2) return null;
  const a = recent[0];
  const b = recent[recent.length - 1];
  const dt = Math.max(1, b.t - a.t);
  return { x: ((b.x - a.x) / dt) * 1000, y: ((b.y - a.y) / dt) * 1000 };
}
const STEP = 1.25;
const isEditable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function PanZoomCanvas({
  children,
  view,
  defaultView = { x: 0, y: 0, scale: 1 },
  onViewChange,
  minScale = 0.1,
  maxScale = 4,
  wheel = "auto",
  grid = true,
  gridSize = 24,
  controls = true,
  fitPadding = 48,
  height = 420,
  className,
  style,
  onKeyDown,
  "aria-label": ariaLabel = "Canvas",
  ...rest
}: PanZoomCanvasProps) {
  const reduce = useReducedMotion();
  const start = typeof defaultView === "object" ? defaultView : { x: 0, y: 0, scale: 1 };
  const x = useMotionValue(view?.x ?? start.x);
  const y = useMotionValue(view?.y ?? start.y);
  const scale = useMotionValue(view?.scale ?? start.scale);
  // Fitting happens after layout, so the content waits hidden for that first frame.
  const shown = useMotionValue(defaultView === "fit" && !view ? 0 : 1);

  const [pct, setPct] = useState(Math.round((view?.scale ?? start.scale) * 100));
  const [gesturing, setGesturing] = useState(false);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const [announce, setAnnounce] = useState("");
  const hintId = useId();

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const glide = useRef(0);
  // Where an eased zoom is heading, so quick wheel notches build on each other instead of stalling.
  const aim = useRef<number | null>(null);
  const hovered = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef({
    mode: "none" as "none" | "pending" | "pan" | "pinch",
    x0: 0,
    y0: 0,
    bx: 0,
    by: 0,
    d0: 1,
    m0: { x: 0, y: 0 },
    s0: 1,
    samples: [] as { t: number; x: number; y: number }[],
    moved: false,
  });

  // ---- view math -------------------------------------------------------------------------

  const stopAll = () => {
    aim.current = null;
    anim.current?.stop();
    cancelAnimationFrame(glide.current);
  };

  const rect = () => viewportRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1);
  const center = () => {
    const r = rect();
    return { x: r.width / 2, y: r.height / 2 };
  };

  /** Keeps the world point under `focal` (viewport px) fixed while the scale changes. */
  const setScaleAt = (next: number, focal: { x: number; y: number }, from = { x: x.get(), y: y.get(), scale: scale.get() }) => {
    const s = clamp(next, minScale, maxScale);
    x.set(focal.x - (focal.x - from.x) * (s / from.scale));
    y.set(focal.y - (focal.y - from.y) * (s / from.scale));
    scale.set(s);
  };

  /**
   * Eases to a view. Scale moves in log space so 25%→400% feels as even as 100%→200%, and with a
   * focal point the world under it stays pinned the whole way, not just at the end.
   */
  const tweenTo = (target: CanvasView, duration = 0.32, focal?: { x: number; y: number }) => {
    stopAll();
    const from = { x: x.get(), y: y.get(), scale: scale.get() };
    if (reduce) {
      x.set(target.x);
      y.set(target.y);
      scale.set(target.scale);
      return;
    }
    const l0 = Math.log(from.scale);
    const l1 = Math.log(target.scale);
    aim.current = target.scale;
    anim.current = animate(0, 1, {
      duration,
      ease: ease.out,
      onComplete: () => (aim.current = null),
      onUpdate: (t) => {
        const s = Math.exp(l0 + (l1 - l0) * t);
        if (focal) setScaleAt(s, focal, from);
        else {
          x.set(from.x + (target.x - from.x) * t);
          y.set(from.y + (target.y - from.y) * t);
          scale.set(s);
        }
      },
    });
  };

  const zoomTo = (next: number, focal = center(), animated = true) => {
    const s = clamp(next, minScale, maxScale);
    const from = { x: x.get(), y: y.get(), scale: scale.get() };
    const target = { x: focal.x - (focal.x - from.x) * (s / from.scale), y: focal.y - (focal.y - from.y) * (s / from.scale), scale: s };
    if (animated) tweenTo(target, 0.24, focal);
    else {
      stopAll();
      x.set(target.x);
      y.set(target.y);
      scale.set(s);
    }
  };

  const fit = (animated = true) => {
    const content = contentRef.current;
    if (!content) return;
    const r = rect();
    // Read the transform the DOM is actually painted with; the motion values can be a frame ahead of it.
    const m = new DOMMatrix(getComputedStyle(content).transform === "none" ? undefined : getComputedStyle(content).transform);
    const origin = content.getBoundingClientRect();
    const s = m.a || 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of Array.from(content.children) as HTMLElement[]) {
      const b = el.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      // Screen rect back to world units.
      minX = Math.min(minX, (b.left - origin.left) / s);
      minY = Math.min(minY, (b.top - origin.top) / s);
      maxX = Math.max(maxX, (b.right - origin.left) / s);
      maxY = Math.max(maxY, (b.bottom - origin.top) / s);
    }
    if (!Number.isFinite(minX)) return;
    const w = maxX - minX;
    const h = maxY - minY;
    const pad = Math.min(fitPadding, r.width / 8, r.height / 8);
    const next = clamp(Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / h, 1), minScale, maxScale);
    const target = { scale: next, x: r.width / 2 - (minX + w / 2) * next, y: r.height / 2 - (minY + h / 2) * next };
    if (animated) tweenTo(target, 0.4);
    else {
      stopAll();
      x.set(target.x);
      y.set(target.y);
      scale.set(target.scale);
    }
  };

  const panBy = (dx: number, dy: number, animated = false) => {
    if (animated) tweenTo({ x: x.get() + dx, y: y.get() + dy, scale: scale.get() }, 0.24);
    else {
      stopAll();
      x.set(x.get() + dx);
      y.set(y.get() + dy);
    }
  };

  // ---- first frame, controlled view, change events ---------------------------------------

  const mountFit = useEffectEvent(() => {
    if (defaultView === "fit" && !view) {
      fit(false);
      if (reduce) shown.set(1);
      else animate(shown, 1, { duration: 0.2 });
    }
  });
  useEffect(() => {
    mountFit();
    return () => {
      anim.current?.stop();
      cancelAnimationFrame(glide.current);
    };
  }, []);

  useEffect(() => {
    if (!view) return;
    if (Math.abs(view.x - x.get()) > 0.01) x.set(view.x);
    if (Math.abs(view.y - y.get()) > 0.01) y.set(view.y);
    if (Math.abs(view.scale - scale.get()) > 0.0001) scale.set(view.scale);
  }, [view, x, y, scale]);

  const emit = useRef(0);
  const report = () => {
    if (emit.current) return;
    emit.current = requestAnimationFrame(() => {
      emit.current = 0;
      onViewChange?.({ x: x.get(), y: y.get(), scale: scale.get() });
    });
  };
  useEffect(() => () => cancelAnimationFrame(emit.current), []);
  useMotionValueEvent(x, "change", report);
  useMotionValueEvent(y, "change", report);
  useMotionValueEvent(scale, "change", (s) => {
    report();
    setPct(Math.round(s * 100));
  });

  // ---- grid: two dot lattices, the finer fading out as it gets dense ----------------------

  const level = useTransform(() => {
    let spacing = gridSize * scale.get();
    while (spacing < 16) spacing *= 2;
    while (spacing >= 32) spacing /= 2;
    return spacing;
  });
  const fineSize = useTransform(() => `${level.get()}px ${level.get()}px`);
  const coarseSize = useTransform(() => `${level.get() * 2}px ${level.get() * 2}px`);
  const gridPos = useTransform(() => `${x.get()}px ${y.get()}px`);
  const fineOpacity = useTransform(() => clamp((level.get() - 16) / 12, 0, 1));

  // ---- pointer: drag the background (or anything with Space held), pinch with two fingers --

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement;
    const onItem = !!el.closest("[data-canvas-item]") && !space;
    const middle = e.pointerType === "mouse" && e.button === 1;
    if (e.pointerType === "mouse" && e.button !== 0 && !middle) return;
    if (el.closest("[data-canvas-controls]")) return;
    // A mouse on an item is working with the item. A finger on an item may still pan once it moves.
    if (onItem && e.pointerType === "mouse" && !middle) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopAll();
    const s = g.current;
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const r = rect();
      s.mode = "pinch";
      s.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      s.m0 = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      s.s0 = scale.get();
      s.bx = x.get();
      s.by = y.get();
      s.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setGesturing(true);
      setPanning(false);
      return;
    }
    if (pointers.current.size > 2) return;
    Object.assign(s, { mode: "pending", x0: e.clientX, y0: e.clientY, bx: x.get(), by: y.get(), samples: [], moved: false });
    if (middle || space || !onItem) {
      // Middle-button autoscroll would fight the pan.
      if (middle) e.preventDefault();
      s.mode = "pan";
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanning(true);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current;
    if (s.mode === "pinch" && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const r = rect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const next = clamp(s.s0 * (d / s.d0), minScale, maxScale);
      // The world point that was under the fingers stays under them, wherever they go.
      x.set(m.x - (s.m0.x - s.bx) * (next / s.s0));
      y.set(m.y - (s.m0.y - s.by) * (next / s.s0));
      scale.set(next);
      return;
    }
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.mode === "pending") {
      if (Math.hypot(dx, dy) < 4) return;
      s.mode = "pan";
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanning(true);
    }
    if (s.mode !== "pan") return;
    if (!s.moved && Math.hypot(dx, dy) >= 4) {
      s.moved = true;
      setGesturing(true);
    }
    x.set(s.bx + dx);
    y.set(s.by + dy);
    s.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (s.samples.length > 8) s.samples.shift();
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const s = g.current;
    if (s.mode === "pinch") {
      // One finger left: carry on panning with the other from where it is.
      const rest = Array.from(pointers.current.entries())[0];
      if (rest) Object.assign(s, { mode: "pan", x0: rest[1].x, y0: rest[1].y, bx: x.get(), by: y.get(), samples: [] });
      else end();
      return;
    }
    if (s.mode === "pan" && s.moved && e.type !== "pointercancel" && !reduce) {
      const v = releaseVelocity(s.samples);
      if (v) coast(v.x, v.y);
    }
    end();
  }

  function end() {
    g.current.mode = "none";
    setPanning(false);
    setGesturing(false);
  }

  /** Momentum after a flick: exponential decay, the way a scroll view coasts. */
  function coast(vx: number, vy: number) {
    if (Math.hypot(vx, vy) < 120) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 1000;
      last = now;
      const k = Math.exp(-dt / 0.28);
      vx *= k;
      vy *= k;
      x.set(x.get() + vx * dt);
      y.set(y.get() + vy * dt);
      if (Math.hypot(vx, vy) > 12) glide.current = requestAnimationFrame(tick);
    };
    glide.current = requestAnimationFrame(tick);
  }

  // ---- wheel ------------------------------------------------------------------------------

  const wheelSettle = useRef(0);
  const onWheel = useEffectEvent((e: WheelEvent) => {
    e.preventDefault();
    const r = rect();
    const focal = { x: e.clientX - r.left, y: e.clientY - r.top };
    const pinch = e.ctrlKey || e.metaKey;
    // A mouse wheel moves in whole lines or big even steps with no sideways component.
    const mouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
    const zoom = pinch || wheel === "zoom" || (wheel === "auto" && mouseWheel);
    setGesturing(true);
    window.clearTimeout(wheelSettle.current);
    wheelSettle.current = window.setTimeout(() => setGesturing(false), 160);
    if (!zoom) {
      stopAll();
      x.set(x.get() - e.deltaX);
      y.set(y.get() - e.deltaY);
      return;
    }
    const lines = e.deltaMode === 1 ? 16 : 1;
    const factor = Math.exp(-e.deltaY * lines * (pinch ? 0.01 : 0.0022));
    if (pinch || reduce) {
      stopAll();
      setScaleAt(scale.get() * factor, focal);
    } else {
      // Notched wheels step, so each notch eases in instead of jumping.
      zoomTo((aim.current ?? scale.get()) * factor, focal, true);
    }
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => onWheel(e);
    el.addEventListener("wheel", h, { passive: false });
    // Safari's trackpad pinch arrives as gesture events; the wheel path covers everyone else.
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", block);
    return () => {
      el.removeEventListener("wheel", h);
      el.removeEventListener("gesturestart", block);
      window.clearTimeout(wheelSettle.current);
    };
  }, []);

  // ---- keyboard ---------------------------------------------------------------------------

  const onSpace = useEffectEvent((e: KeyboardEvent, down: boolean) => {
    if (e.code !== "Space") return;
    const vp = viewportRef.current;
    const focus = document.activeElement;
    // A focused button or link inside the canvas keeps Space for itself.
    if (vp && focus && focus !== vp && vp.contains(focus) && !space) return;
    const inside = hovered.current || vp?.contains(focus);
    if (down) {
      if (!inside || isEditable(e.target) || e.repeat) {
        if (inside && e.repeat && space) e.preventDefault();
        return;
      }
      e.preventDefault();
      setSpace(true);
    } else if (space) {
      e.preventDefault();
      setSpace(false);
    }
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => onSpace(e, true);
    const up = (e: KeyboardEvent) => onSpace(e, false);
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const say = (s: number) => setAnnounce(`Zoom ${Math.round(clamp(s, minScale, maxScale) * 100)}%`);

  const api: Api = {
    zoomIn: () => {
      const next = (aim.current ?? scale.get()) * STEP;
      zoomTo(next);
      say(next);
    },
    zoomOut: () => {
      const next = (aim.current ?? scale.get()) / STEP;
      zoomTo(next);
      say(next);
    },
    reset: () => {
      zoomTo(1);
      say(1);
    },
    fit: (animated = true) => {
      fit(animated);
      setAnnounce("Zoomed to fit");
    },
    zoomTo,
    panBy,
    scale: pct / 100,
    minScale,
    maxScale,
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented || isEditable(e.target) || e.altKey) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "+" || e.key === "=") api.zoomIn();
    else if (e.key === "-" || e.key === "_") api.zoomOut();
    else if (e.key === "0" && !mod) api.reset();
    else if (e.key === "1" && !mod) api.fit();
    else if (e.target === e.currentTarget && e.key.startsWith("Arrow")) {
      // Arrows pan the view itself; they stay out of the way once focus is on an item.
      const d = e.shiftKey ? 200 : 40;
      panBy(e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0, e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0);
    } else return;
    // The canvas owns these keys while it has focus; nothing further up should also act on them.
    e.preventDefault();
    e.stopPropagation();
  }

  // Tabbing to an item that's out of view brings it into view.
  function handleFocus(e: React.FocusEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (t === e.currentTarget || !t.closest("[data-canvas-item]") || !t.matches(":focus-visible")) return;
    const r = rect();
    const b = t.getBoundingClientRect();
    const m = 24;
    let dx = 0;
    let dy = 0;
    if (b.left < r.left + m) dx = r.left + m - b.left;
    else if (b.right > r.right - m) dx = r.right - m - b.right;
    if (b.top < r.top + m) dy = r.top + m - b.top;
    else if (b.bottom > r.bottom - m - 48) dy = r.bottom - m - 48 - b.bottom;
    if (dx || dy) panBy(dx, dy, true);
  }

  return (
    <CanvasContext.Provider value={api}>
      <div
        ref={viewportRef}
        tabIndex={0}
        role="region"
        aria-roledescription="canvas"
        aria-label={ariaLabel}
        aria-describedby={hintId}
        data-panning={panning || undefined}
        data-space={space || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerEnter={() => (hovered.current = true)}
        onPointerLeave={() => (hovered.current = false)}
        onClickCapture={(e) => {
          // A pan that started on an item ends without clicking it.
          if (g.current.moved && !(e.target as HTMLElement).closest("[data-canvas-controls]")) {
            e.preventDefault();
            e.stopPropagation();
          }
          g.current.moved = false;
        }}
        onAuxClick={(e) => e.button === 1 && e.preventDefault()}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        style={{ ...style, height }}
        className={cn(
          "relative isolate touch-none select-none overflow-hidden overscroll-contain rounded-xl border border-line bg-frame outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          panning ? "cursor-grabbing [&_*]:cursor-grabbing" : space ? "cursor-grab [&_*]:cursor-grab" : "cursor-grab",
          className,
        )}
        {...rest}
      >
        {grid && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "radial-gradient(circle, var(--fg-4) 1px, transparent 1.25px)", backgroundSize: coarseSize, backgroundPosition: gridPos, opacity: 0.7 }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "radial-gradient(circle, var(--line-2) 1px, transparent 1.25px)", backgroundSize: fineSize, backgroundPosition: gridPos, opacity: fineOpacity }}
            />
          </>
        )}

        <motion.div
          ref={contentRef}
          data-canvas-content=""
          style={{ x, y, scale, opacity: shown, transformOrigin: "0 0" }}
          className={cn("absolute left-0 top-0 h-0 w-0 cursor-auto", space && "pointer-events-none")}
        >
          {children}
        </motion.div>

        {controls && <Controls gesturing={gesturing} />}

        <p id={hintId} className="sr-only">
          Drag the background or hold Space and drag to pan. Use plus and minus to zoom, 0 for 100%, 1 to fit, and the arrow keys to move.
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>
    </CanvasContext.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Items and controls
 * -----------------------------------------------------------------------------------------------*/

export type CanvasItemProps = React.ComponentProps<"div"> & {
  /** Position in world units. */
  x: number;
  y: number;
};

/** Anything placed on the canvas at world coordinates. Pointer presses on it don't pan with a mouse. */
export function CanvasItem({ x, y, className, style, ...rest }: CanvasItemProps) {
  return <div data-canvas-item="" style={{ ...style, left: x, top: y }} className={cn("absolute", className)} {...rest} />;
}

function Controls({ gesturing }: { gesturing: boolean }) {
  const api = usePanZoom();
  const pct = Math.round(api.scale * 100);
  return (
    <Tooltip.Provider delay={500}>
      <div
        data-canvas-controls=""
        role="toolbar"
        aria-label="Zoom"
        className="absolute bottom-3 left-3 z-10 flex cursor-auto items-center gap-0.5 rounded-lg border border-line-2 bg-raised p-0.5 shadow-pop"
      >
        <ControlButton label="Zoom out" keys="−" disabled={api.scale <= api.minScale + 1e-6} onClick={api.zoomOut}>
          <Minus />
        </ControlButton>
        <ControlButton label="Reset to 100%" keys="0" wide onClick={api.reset}>
          {/* Rolls on discrete steps; tracks the pinch frame by frame without animating. */}
          <NumberFlow value={pct} suffix="%" animated={!gesturing} className="tabular text-[12px] font-medium" />
        </ControlButton>
        <ControlButton label="Zoom in" keys="+" disabled={api.scale >= api.maxScale - 1e-6} onClick={api.zoomIn}>
          <Plus />
        </ControlButton>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-line-2" />
        <ControlButton label="Zoom to fit" keys="1" onClick={() => api.fit()}>
          <Maximize />
        </ControlButton>
      </div>
    </Tooltip.Provider>
  );
}

function ControlButton({ label, keys, wide, disabled, onClick, children }: { label: string; keys: string; wide?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "grid h-7 place-items-center rounded-md text-fg-2 outline-none",
              "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.94] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
              "disabled:pointer-events-none disabled:opacity-40",
              // Grows the hit area to 44px on touch without changing the drawing.
              "relative before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
              wide ? "w-[52px]" : "w-7",
            )}
          />
        }
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex origin-(--transform-origin) items-center gap-2 rounded-lg border border-line-2 bg-raised py-[3px] pl-2 pr-1 text-[12px] leading-5 text-fg shadow-pop",
              "transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-instant:transition-none",
            )}
          >
            {label}
            <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 font-mono text-[10.5px] leading-none text-fg-2">{keys}</kbd>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
