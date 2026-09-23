"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type PullToRefreshPhase = "idle" | "pulling" | "armed" | "refreshing" | "done" | "error";
type Phase = PullToRefreshPhase;

export type PullToRefreshActions = {
  /** Run a refresh exactly as a pull would: the button equivalent of the gesture. */
  refresh: () => void;
};

export type PullToRefreshProps = Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  /** Called on release past the threshold. Return a promise; the spinner holds until it settles. */
  onRefresh: () => unknown;
  /** How far the content must travel before a release refreshes. */
  threshold?: number;
  /** The most the content can travel, however far the finger goes. */
  maxPull?: number;
  disabled?: boolean;
  /** Call refresh() from a button, a shortcut or a focus event. */
  actionsRef?: React.Ref<PullToRefreshActions>;
  /** Labels for each moment, in order: pulling, armed, refreshing, done, failed. */
  labels?: Partial<Record<Exclude<Phase, "idle">, string>>;
  /** Classes for the inner scroll container. */
  scrollClassName?: string;
};

const defaults: Record<Exclude<Phase, "idle">, string> = {
  pulling: "Pull to refresh",
  armed: "Release to refresh",
  refreshing: "Refreshing…",
  done: "Up to date",
  error: "Couldn’t refresh",
};

const HOLD = 52;
const ENGAGE = 6;

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 64,
  maxPull = 128,
  disabled = false,
  actionsRef,
  labels,
  scrollClassName,
  className,
  onClickCapture,
  ...rest
}: PullToRefreshProps) {
  const reduce = useReducedMotion();
  const text = { ...defaults, ...labels };
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const scroller = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls>(null);
  const alive = useRef(true);
  const dragged = useRef(false);

  // The indicator rides in the gap the content leaves, centered in it, and
  // fades in over the first 24px so a tiny tug doesn't flash it.
  const pillY = useTransform(y, (v) => v / 2 - 16);
  const pillOpacity = useTransform(y, [0, 24], [0, 1]);
  const progress = useTransform(y, [0, threshold], [0, 1], { clamp: true });

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const settle = (to: number) => {
    anim.current?.stop();
    anim.current = animate(y, to, reduce ? { duration: 0.15, ease: ease.out } : to === 0 ? spring.sheet : spring.snappy);
  };

  // Rubber band: the first pixels follow the finger almost 1:1, then each
  // extra pixel buys less, approaching maxPull and never passing it.
  const band = (dy: number) => maxPull * (1 - Math.exp(-Math.max(0, dy) / (maxPull * 1.1)));

  const refresh = async () => {
    const p = phaseRef.current;
    if (disabled || p === "refreshing" || p === "done" || p === "error") return;
    const el = scroller.current;
    if (el && el.scrollTop > 0) el.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    go("refreshing");
    settle(HOLD);
    const started = performance.now();
    let ok = true;
    try {
      await onRefresh();
    } catch {
      ok = false;
    }
    // A spinner that vanishes after 80ms reads as a glitch; hold it long enough to be seen.
    const rest = 500 - (performance.now() - started);
    if (rest > 0) await new Promise((r) => window.setTimeout(r, rest));
    if (!alive.current) return;
    go(ok ? "done" : "error");
    await new Promise((r) => window.setTimeout(r, ok ? 700 : 1600));
    if (!alive.current) return;
    go("idle");
    settle(0);
  };
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useImperativeHandle(actionsRef, () => ({ refresh: () => refreshRef.current() }), []);

  const busy = () => ["refreshing", "done", "error"].includes(phaseRef.current);

  // Shared by touch and mouse: start only at the very top, engage after a few
  // pixels downward, then follow the finger through the rubber band.
  const gesture = useRef<{ start: number; engaged: boolean } | null>(null);
  const begin = (clientY: number) => {
    if (disabled || busy() || (scroller.current?.scrollTop ?? 0) > 0) return false;
    gesture.current = { start: clientY, engaged: false };
    return true;
  };
  const move = (clientY: number) => {
    const g = gesture.current;
    if (!g) return false;
    const dy = clientY - g.start;
    if (!g.engaged) {
      if (dy < 0) {
        gesture.current = null;
        return false;
      }
      if (dy < ENGAGE) return false;
      g.engaged = true;
      g.start = clientY - ENGAGE;
      anim.current?.stop();
    }
    const pull = band(clientY - g.start);
    y.set(pull);
    const next = pull >= threshold ? "armed" : "pulling";
    if (phaseRef.current !== next) go(next);
    return true;
  };
  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.engaged) return;
    if (phaseRef.current === "armed") refreshRef.current();
    else {
      go("idle");
      settle(0);
    }
  };

  const beginRef = useRef(begin);
  const moveRef = useRef(move);
  const endRef = useRef(end);
  useEffect(() => {
    beginRef.current = begin;
    moveRef.current = move;
    endRef.current = end;
  });

  // Touch goes through native listeners: touchmove must be non-passive so the
  // page doesn't scroll (or run the browser's own refresh) while we pull.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) beginRef.current(e.touches[0].clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && moveRef.current(e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onEnd = () => endRef.current();
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      anim.current?.stop();
    };
  }, []);

  const shown = phase === "idle" ? "pulling" : phase;
  const armed = phase === "armed" || phase === "refreshing";

  return (
    <div
      data-state={phase}
      aria-busy={phase === "refreshing" || undefined}
      className={cn("relative isolate overflow-hidden", phase !== "idle" && "select-none", className)}
      onClickCapture={(e) => {
        onClickCapture?.(e);
        // A mouse pull ends with a click on whatever was under the pointer; swallow it.
        if (dragged.current) {
          dragged.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...rest}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex justify-center"
        style={{ y: pillY, opacity: pillOpacity }}
      >
        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line-2 bg-raised pl-2 pr-3 text-[12px] font-medium text-fg-2 shadow-[var(--shadow)]">
          <span className="relative grid size-4 place-items-center">
            <AnimatePresence initial={false}>
              <motion.span
                key={shown === "pulling" || shown === "armed" ? "arrow" : shown}
                className="absolute inset-0 grid place-items-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, transition: { duration: 0.1 } }}
                transition={reduce ? { duration: 0.12 } : spring.pop}
              >
                {shown === "refreshing" ? (
                  <Spinner />
                ) : shown === "done" ? (
                  <Tick reduce={!!reduce} />
                ) : shown === "error" ? (
                  <Cross reduce={!!reduce} />
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
                    <circle cx="8" cy="8" r="6.75" stroke="var(--line-2)" strokeWidth="1.4" />
                    {/* The ring fills as the pull approaches the point of no return. */}
                    <motion.path d="M8 1.25a6.75 6.75 0 1 1 0 13.5a6.75 6.75 0 1 1 0-13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ pathLength: progress }} />
                    <motion.path
                      d="M8 5v6M5.75 8.75 8 11l2.25-2.25"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      animate={{ rotate: armed ? 180 : 0 }}
                      transition={reduce ? { duration: 0 } : spring.snappy}
                    />
                  </svg>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="grid">
            {Object.values(text).map((l) => (
              <span key={l} className="invisible col-start-1 row-start-1">
                {l}
              </span>
            ))}
            <AnimatePresence initial={false}>
              <motion.span
                key={shown}
                className={cn("col-start-1 row-start-1", shown === "error" ? "text-danger" : shown === "armed" || shown === "done" ? "text-fg" : "")}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18, ease: ease.out }}
              >
                {text[shown]}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </motion.div>

      <div
        ref={scroller}
        className={cn("h-full overflow-y-auto overscroll-y-contain", scrollClassName)}
        onPointerDown={(e) => {
          // Touch is handled natively above; this is for mouse and pen.
          if (e.pointerType === "touch" || e.button !== 0) return;
          dragged.current = false;
          begin(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          if (move(e.clientY)) {
            // Capture only once it is really a pull, so plain clicks still land on their targets.
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
            dragged.current = true;
            e.preventDefault();
          }
        }}
        // Links and images start a native drag on mouse move, which would cancel the pull.
        onDragStart={(e) => {
          if (gesture.current) e.preventDefault();
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "touch") end();
        }}
        onPointerCancel={(e) => {
          if (e.pointerType !== "touch") end();
        }}
      >
        <motion.div style={{ y }}>{children}</motion.div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {phase === "refreshing" ? text.refreshing : phase === "done" ? text.done : phase === "error" ? text.error : ""}
      </span>
    </div>
  );
}

const svg = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "size-4" };

function Spinner() {
  return (
    <svg {...svg} className="size-4 animate-spin [animation-duration:0.8s]">
      <circle cx="8" cy="8" r="6.75" stroke="var(--line-2)" />
      <path d="M8 1.25A6.75 6.75 0 0 1 14.75 8" />
    </svg>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <svg {...svg} className="size-4 text-success">
      <circle cx="8" cy="8" r="6.75" />
      <motion.path d="m5.25 8.25 1.9 1.9 3.6-4.1" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }} />
    </svg>
  );
}

function Cross({ reduce }: { reduce: boolean }) {
  const draw = (delay: number) => (reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.24, ease: ease.out, delay } });
  return (
    <svg {...svg} className="size-4 text-danger">
      <circle cx="8" cy="8" r="6.75" />
      <motion.path d="m6 6 4 4" {...draw(0.05)} />
      <motion.path d="m10 6-4 4" {...draw(0.14)} />
    </svg>
  );
}
