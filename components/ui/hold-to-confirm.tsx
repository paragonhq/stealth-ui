"use client";
import { Button } from "@base-ui/react/button";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type HoldState = "idle" | "holding" | "hint" | "armed" | "done";

export type HoldToConfirmProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> & {
  /** The action, as a verb: "Delete project". Also the accessible name. */
  children: React.ReactNode;
  /** Called once the hold completes. */
  onConfirm: () => void;
  /** Milliseconds the press must be held. */
  duration?: number;
  /** Shown after a tap that was too short, so people learn the gesture. */
  hint?: string;
  /** Shown when a screen reader or switch sends a plain click: a second click confirms. */
  armedLabel?: string;
  confirmedLabel?: string;
  icon?: React.ReactNode;
  tone?: "danger" | "neutral";
  size?: "sm" | "md";
  /** Milliseconds before returning to rest after confirming. `null` keeps the confirmed state. */
  resetAfter?: number | null;
};

export function HoldToConfirm({
  children,
  onConfirm,
  duration = 1200,
  hint = "Hold to confirm",
  armedLabel = "Press again to confirm",
  confirmedLabel = "Done",
  icon,
  tone = "danger",
  size = "md",
  resetAfter = 2000,
  disabled,
  className,
  ref,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...rest
}: HoldToConfirmProps) {
  const [state, setState] = useState<HoldState>("idle");
  const reduce = useReducedMotion();
  const hintId = useId();
  const progress = useMotionValue(0);
  // The fill is a second copy of the face, clipped from the right, so the label flips color exactly under the edge.
  const clip = useTransform(progress, (p) => `inset(0 ${(1 - p) * 100}% 0 0)`);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const startedAt = useRef(0);
  const holdingRef = useRef(false);
  const timer = useRef<number>(undefined);

  useEffect(
    () => () => {
      anim.current?.stop();
      window.clearTimeout(timer.current);
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };

  const confirm = () => {
    holdingRef.current = false;
    anim.current?.stop();
    progress.set(1);
    setState("done");
    onConfirm();
    if (resetAfter != null)
      later(() => {
        setState("idle");
        anim.current = animate(progress, 0, { duration: 0.4, ease: ease.inOut });
      }, resetAfter);
  };

  const start = () => {
    if (disabled || holdingRef.current || state === "done") return;
    holdingRef.current = true;
    window.clearTimeout(timer.current);
    startedAt.current = performance.now();
    setState("holding");
    anim.current?.stop();
    // Continues from wherever a drain left it, so a quick re-press picks up the progress.
    anim.current = animate(progress, 1, {
      duration: ((1 - progress.get()) * duration) / 1000,
      ease: "linear",
      onComplete: confirm,
    });
  };

  const release = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    anim.current?.stop();
    const tapped = performance.now() - startedAt.current < 250;
    // Drains faster than it fills, from wherever it is.
    anim.current = animate(progress, 0, { duration: Math.max(0.18, progress.get() * 0.5), ease: ease.out });
    if (tapped) {
      setState("hint");
      later(() => setState("idle"), 1800);
    } else setState("idle");
  };

  const isKey = (k: string) => k === " " || k === "Enter";

  const shown: Exclude<HoldState, "holding"> = state === "holding" ? "idle" : state;
  function label(k: Exclude<HoldState, "holding">) {
    return k === "hint" ? hint : k === "armed" ? armedLabel : k === "done" ? confirmedLabel : children;
  }

  const face = (filled: boolean) => (
    <span className="grid place-items-center">
      {(["idle", "hint", "armed", "done"] as const).map((k) => (
        <Row key={k} icon={k === "done" || (k === "idle" && icon) ? <span /> : null} size={size} className="invisible col-start-1 row-start-1">
          {label(k)}
        </Row>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={shown}
          className="col-start-1 row-start-1 flex"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
          transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
        >
          <Row icon={shown === "done" ? <Tick reduce={!!reduce} animated={filled} /> : shown === "idle" ? icon : null} size={size}>
            {label(shown)}
          </Row>
        </motion.span>
      </AnimatePresence>
    </span>
  );

  const danger = tone === "danger";

  return (
    <>
      <Button
        ref={ref as React.Ref<HTMLElement>}
        type="button"
        data-state={state}
        data-tone={tone}
        data-size={size}
        disabled={disabled}
        aria-describedby={hintId}
        onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
          onPointerDown?.(e);
          if (e.button === 0 && !e.defaultPrevented) start();
        }}
        onPointerUp={(e: React.PointerEvent<HTMLButtonElement>) => {
          onPointerUp?.(e);
          release();
        }}
        // Dragging off the button is how people change their mind.
        onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
          onPointerLeave?.(e);
          release();
        }}
        onPointerCancel={(e: React.PointerEvent<HTMLButtonElement>) => {
          onPointerCancel?.(e);
          release();
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          onKeyDown?.(e);
          if (!isKey(e.key)) return;
          // Hold is the only way in by keyboard; swallow the native click.
          e.preventDefault();
          if (!e.repeat) start();
        }}
        onKeyUp={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          onKeyUp?.(e);
          if (!isKey(e.key)) return;
          e.preventDefault();
          release();
        }}
        onBlur={(e: React.FocusEvent<HTMLButtonElement>) => {
          onBlur?.(e);
          release();
        }}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          // Pointer and key presses are handled above. A click with no pointer
          // behind it comes from a screen reader or switch, which can't hold:
          // fall back to press-twice.
          if (e.detail !== 0 || state === "done") return;
          if (state === "armed") confirm();
          else {
            setState("armed");
            later(() => setState("idle"), 4000);
          }
        }}
        onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
        className={cn(
          "group/hold relative inline-flex shrink-0 touch-manipulation select-none items-center justify-center overflow-hidden whitespace-nowrap border font-medium tracking-[-0.005em] [-webkit-touch-callout:none]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "shadow-[var(--shadow)] transition-[background-color,border-color,color,scale] duration-150 ease-out",
          size === "sm" ? "h-7 rounded-md px-2.5 text-[12px]" : "h-8 rounded-lg px-3 text-[12.5px]",
          // Once done the border takes the fill's color, so the button reads as one solid shape.
          state === "done"
            ? danger ? "border-danger bg-danger text-frame" : "border-fg bg-fg text-frame"
            : state === "armed"
            ? danger ? "border-danger/50 bg-danger-soft text-danger" : "border-fg-4 bg-hover text-fg"
            : danger ? "border-line-2 bg-raised text-danger hover:border-danger/40 hover:bg-danger-soft" : "border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover",
          // Held down: the button stays pressed for the whole hold, then eases back on release.
          state === "holding" && !reduce && "scale-[0.97]",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...rest}
      >
        <span className="sr-only">{children}</span>
        <span aria-hidden className="contents">
          {face(false)}
          <motion.span
            className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", size === "sm" ? "px-2.5" : "px-3", danger ? "bg-danger text-frame" : "bg-fg text-frame")}
            style={{ clipPath: clip }}
          >
            {face(true)}
          </motion.span>
        </span>
      </Button>
      <span id={hintId} className="sr-only">
        Press and hold for {Math.round(duration / 100) / 10} seconds
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "done" ? confirmedLabel : state === "armed" ? armedLabel : ""}
      </span>
    </>
  );
}

function Row({ icon, size, className, children }: { icon: React.ReactNode; size: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center", size === "sm" ? "gap-1.5" : "gap-2", className)}>
      {icon && <span className={cn("grid shrink-0 place-items-center", size === "sm" ? "size-3.5 [&_svg]:size-3.5" : "size-4")}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

function Tick({ reduce, animated }: { reduce: boolean; animated: boolean }) {
  const draw = animated && !reduce;
  return (
    <motion.svg
      width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      initial={draw ? { scale: 0.6 } : false}
      animate={{ scale: 1 }}
      transition={spring.pop}
    >
      <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.34, ease: ease.out, delay: 0.05 }} />
    </motion.svg>
  );
}
