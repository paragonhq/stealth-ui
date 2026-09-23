"use client";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type LongPressPointer = "mouse" | "touch" | "pen" | "keyboard";

export type LongPressEvent = {
  /** Where the press happened, relative to the element. The element's center for keyboard. */
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  pointerType: LongPressPointer;
  /** True when a right click or the context menu key asked for it directly, with no hold. */
  immediate: boolean;
  target: HTMLElement;
};

export type LongPressState = "idle" | "pressing" | "fired";

export type UseLongPressOptions = {
  onLongPress: (event: LongPressEvent) => void;
  /** Milliseconds the press must be held. */
  duration?: number;
  /** Milliseconds before any feedback shows, so a tap never flashes a ring. */
  delay?: number;
  /** Pixels the pointer may wander before the press counts as a scroll or drag and cancels. */
  tolerance?: number;
  /** A right click, the context menu key or Shift+F10 also fire it, instantly. */
  contextMenu?: boolean;
  onStart?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
};

type Bind = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
};

/**
 * Press-and-hold on anything. Returns handlers to spread on the element, the press state,
 * a 0–1 progress value to draw from, and where the press began.
 */
export function useLongPress({
  onLongPress,
  duration = 500,
  delay = 120,
  tolerance = 10,
  contextMenu = true,
  onStart,
  onCancel,
  disabled = false,
}: UseLongPressOptions) {
  const [state, setState] = useState<LongPressState>("idle");
  const [origin, setOrigin] = useState<{ x: number; y: number; pointerType: LongPressPointer } | null>(null);
  const progress = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const p = useRef({ id: -1, x0: 0, y0: 0, type: "mouse" as LongPressPointer, fired: false, target: null as HTMLElement | null });
  const swallowClick = useRef(false);

  useEffect(() => () => anim.current?.stop(), []);

  const fire = (target: HTMLElement, clientX: number, clientY: number, pointerType: LongPressPointer, immediate: boolean) => {
    const r = target.getBoundingClientRect();
    onLongPress({ x: clientX - r.left, y: clientY - r.top, clientX, clientY, pointerType, immediate, target });
  };

  const reset = (drain: boolean) => {
    anim.current?.stop();
    // Drains faster than it fills, from wherever it got to.
    if (drain) anim.current = animate(progress, 0, { duration: Math.max(0.12, progress.get() * 0.25), ease: "easeOut" });
    else progress.set(0);
  };

  const cancel = () => {
    if (p.current.id === -1) return;
    p.current.id = -1;
    if (!p.current.fired) {
      reset(true);
      setState("idle");
      onCancel?.();
    }
  };

  const bind: Bind = {
    onPointerDown(e) {
      if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      const target = e.currentTarget;
      const r = target.getBoundingClientRect();
      const type = e.pointerType as LongPressPointer;
      p.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, type, fired: false, target };
      swallowClick.current = false;
      setOrigin({ x: e.clientX - r.left, y: e.clientY - r.top, pointerType: type });
      setState("pressing");
      onStart?.();
      anim.current?.stop();
      progress.set(0);
      anim.current = animate(progress, 1, {
        duration: duration / 1000,
        ease: "linear",
        onComplete: () => {
          if (p.current.id !== e.pointerId) return;
          p.current.fired = true;
          swallowClick.current = true;
          setState("fired");
          navigator.vibrate?.(10);
          fire(target, p.current.x0, p.current.y0, type, false);
        },
      });
    },
    onPointerMove(e) {
      if (p.current.id !== e.pointerId || p.current.fired) return;
      if (Math.hypot(e.clientX - p.current.x0, e.clientY - p.current.y0) > tolerance) cancel();
    },
    onPointerUp(e) {
      if (p.current.id !== e.pointerId) return;
      if (p.current.fired) {
        p.current.id = -1;
        reset(false);
        setState("idle");
      } else cancel();
    },
    onPointerCancel(e) {
      if (p.current.id === e.pointerId) cancel();
    },
    onContextMenu(e) {
      // Touch and pen raise their own context menu mid-hold; the timer owns that gesture.
      if (p.current.id !== -1 && p.current.type !== "mouse") {
        e.preventDefault();
        return;
      }
      if (!contextMenu || disabled || e.defaultPrevented) return;
      e.preventDefault();
      fire(e.currentTarget, e.clientX, e.clientY, "mouse", true);
    },
    onClickCapture(e) {
      // The release that ends a long press is not also a tap.
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onKeyDown(e) {
      if (!contextMenu || disabled) return;
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        fire(e.currentTarget, r.left + r.width / 2, r.top + r.height / 2, "keyboard", true);
      }
    },
  };

  return { bind, state, progress, origin, cancel };
}

/* -------------------------------------------------------------------------------------------------
 * The component: the hook plus a ring that fills under the press
 * -----------------------------------------------------------------------------------------------*/

type A11yProps = { "aria-describedby": string; "aria-keyshortcuts"?: string };

// The press handlers belong to the gesture; reach for useLongPress to compose your own.
export type LongPressProps = Omit<
  React.ComponentProps<"div">,
  | "children"
  | "contextMenu"
  | "onContextMenu"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onClickCapture"
  | "onKeyDown"
  // Motion owns these on the root.
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
> &
  Omit<UseLongPressOptions, "disabled"> & {
    /** The pressable thing. As a function it receives the hint's id and shortcut to put on your focusable element. */
    children: React.ReactNode | ((a11y: A11yProps) => React.ReactNode);
    /** Read by screen readers after the element's name. */
    hint?: string;
    /** The element sinks slightly while held, and springs back when it fires. */
    sink?: boolean;
    disabled?: boolean;
  };

export function LongPress({
  children,
  onLongPress,
  duration = 500,
  delay = 120,
  tolerance,
  contextMenu = true,
  onStart,
  onCancel,
  hint = "Press and hold for more options",
  sink = true,
  disabled = false,
  className,
  style,
  ...rest
}: LongPressProps) {
  const reduce = useReducedMotion();
  const hintId = useId();
  const { bind, state, progress, origin } = useLongPress({ onLongPress, duration, delay, tolerance, contextMenu, onStart, onCancel, disabled });
  const pop = useMotionValue(0);

  // Nothing shows until the delay has passed; then the ring grows in and fills with the time left.
  const lead = Math.min(0.6, delay / duration);
  const shown = useTransform(() => Math.min(1, Math.max(0, (progress.get() - lead) / 0.12)));
  const fill = useTransform(() => Math.max(0, (progress.get() - lead) / (1 - lead)));
  const depth = useMotionValue(1);

  useEffect(() => {
    const moves: AnimationPlaybackControls[] = [];
    if (state === "fired") {
      if (reduce) pop.set(1);
      else {
        // The completed ring flares out once, and the element springs back up to meet what opened.
        pop.set(0);
        moves.push(animate(pop, 1, { duration: 0.32, ease: ease.out }));
      }
    }
    if (!reduce && sink) {
      // Held, it sinks for the length of the hold; let go early and it rises straight back.
      if (state === "pressing") moves.push(animate(depth, 0.97, { duration: duration / 1000, ease: ease.outQuart }));
      else moves.push(animate(depth, 1, state === "fired" ? spring.pop : { duration: 0.15, ease: ease.out }));
    }
    return () => moves.forEach((m) => m.stop());
  }, [state, pop, depth, reduce, sink, duration]);

  const a11y: A11yProps = { "aria-describedby": hintId, ...(contextMenu ? { "aria-keyshortcuts": "Shift+F10" } : {}) };
  const touch = origin?.pointerType === "touch";

  return (
    <motion.div
      data-state={state}
      data-disabled={disabled || undefined}
      {...bind}
      style={{ ...style, scale: depth }}
      className={cn(
        "relative select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]",
        className,
      )}
      {...rest}
    >
      {typeof children === "function" ? children(a11y) : children}
      <span id={hintId} className="sr-only">
        {hint}
        {contextMenu ? ", or press Shift F10" : ""}
      </span>
      {origin && (
        <Ring
          key={`${origin.x},${origin.y}`}
          x={origin.x}
          y={origin.y}
          // A fingertip covers a small ring, so touch draws one wide enough to show around it.
          size={touch ? 72 : 40}
          shown={shown}
          fill={fill}
          pop={pop}
          fired={state === "fired"}
          reduce={!!reduce}
        />
      )}
    </motion.div>
  );
}

function Ring({
  x,
  y,
  size,
  shown,
  fill,
  pop,
  fired,
  reduce,
}: {
  x: number;
  y: number;
  size: number;
  shown: MotionValue<number>;
  fill: MotionValue<number>;
  pop: MotionValue<number>;
  fired: boolean;
  reduce: boolean;
}) {
  const stroke = size > 50 ? 3 : 2.5;
  const r = size / 2 - stroke;
  const scale = useTransform(() => (reduce ? 1 : fired ? 1 + 0.25 * pop.get() : 0.6 + 0.4 * shown.get()));
  const opacity = useTransform(() => (fired ? 1 - pop.get() : shown.get()));
  return (
    <motion.span
      aria-hidden
      style={{ left: x, top: y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, scale, opacity }}
      className="pointer-events-none absolute z-10 grid place-items-center"
    >
      <span className="absolute inset-0 rounded-full bg-raised/90 shadow-pop" />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-fg/20" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-fg" style={{ pathLength: fill }} />
      </svg>
    </motion.span>
  );
}
