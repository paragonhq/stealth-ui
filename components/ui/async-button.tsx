"use client";
import { Button } from "@base-ui/react/button";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type AsyncStatus = "idle" | "pending" | "success" | "error";

type Options = {
  /** Milliseconds the success state holds before returning to idle. */
  successTimeout?: number;
  /** Milliseconds before an error returns to idle. Omit to keep it until the next press. */
  errorTimeout?: number;
  /** Wait this long before showing the busy state, so fast requests never flash a spinner. */
  pendingDelay?: number;
  /** Once the busy state is visible, keep it at least this long so it never flickers. */
  minPending?: number;
  onSuccess?: (result: unknown) => void;
  onError?: (error: unknown) => void;
};

const isThenable = (v: unknown): v is PromiseLike<unknown> =>
  !!v && (typeof v === "object" || typeof v === "function") && typeof (v as PromiseLike<unknown>).then === "function";

/**
 * The async lifecycle on its own: idle → pending → success | error → idle.
 * `status` is the truth (use it for aria-busy and blocking); `visible` is what
 * to draw, which stays idle through the first `pendingDelay` ms of a request.
 */
export function useAsyncAction({
  successTimeout = 1600,
  errorTimeout,
  pendingDelay = 150,
  minPending = 450,
  onSuccess,
  onError,
}: Options = {}) {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [shown, setShown] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };
  const clearAll = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const run = useCallback(
    async (task: () => unknown) => {
      // One request at a time: a second press while busy is a double submit.
      if (busy.current) return;
      let result: unknown;
      try {
        result = task();
      } catch (error) {
        result = Promise.reject(error);
      }
      // A plain synchronous handler is just a click; there is nothing to wait for.
      if (!isThenable(result)) return;

      busy.current = true;
      clearAll();
      setStatus("pending");
      setShown(false);
      let shownAt = 0;
      const reveal = later(() => {
        shownAt = performance.now();
        setShown(true);
      }, pendingDelay);

      let ok = false;
      let value: unknown;
      try {
        value = await result;
        ok = true;
      } catch (error) {
        value = error;
      }
      window.clearTimeout(reveal);
      if (shownAt) {
        const rest = minPending - (performance.now() - shownAt);
        if (rest > 0) await new Promise((r) => later(() => r(null), rest));
      }
      if (!alive.current) return;

      busy.current = false;
      setShown(false);
      if (ok) {
        setStatus("success");
        onSuccess?.(value);
        later(() => setStatus("idle"), successTimeout);
      } else {
        setStatus("error");
        onError?.(value);
        if (errorTimeout != null) later(() => setStatus("idle"), errorTimeout);
      }
    },
    [pendingDelay, minPending, successTimeout, errorTimeout, onSuccess, onError],
  );

  const reset = useCallback(() => {
    clearAll();
    setStatus("idle");
    setShown(false);
  }, []);

  const visible: AsyncStatus = status === "pending" && !shown ? "idle" : status;
  return { status, visible, run, reset };
}

export type AsyncButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "children"> &
  Options & {
    /** The resting label. Also the button's accessible name in every state. */
    children: React.ReactNode;
    /** Return a promise and the button tracks it. Return nothing and it behaves like a plain button. */
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
    pendingLabel?: string;
    successLabel?: string;
    /** Shown when the promise rejects. Pressing it runs the action again. */
    errorLabel?: string;
    /** Drive the state yourself, e.g. from a form action. The button stops running its own lifecycle. */
    status?: AsyncStatus;
    /** Optional icon shown before the resting label. */
    icon?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    variant?: "primary" | "secondary";
  };

export function AsyncButton({
  children,
  onClick,
  pendingLabel = "Saving…",
  successLabel = "Saved",
  errorLabel = "Try again",
  status: controlled,
  icon,
  size = "md",
  variant = "primary",
  successTimeout,
  errorTimeout,
  pendingDelay,
  minPending,
  onSuccess,
  onError,
  disabled,
  className,
  ref,
  ...rest
}: AsyncButtonProps) {
  const action = useAsyncAction({ successTimeout, errorTimeout, pendingDelay, minPending, onSuccess, onError });
  const reduce = useReducedMotion();
  const status = controlled ?? action.status;
  const visible = controlled ?? action.visible;
  const locked = status === "pending" || status === "success";

  const rows: Record<AsyncStatus, { glyph: React.ReactNode; text: React.ReactNode }> = {
    idle: { glyph: icon, text: children },
    pending: { glyph: <Spinner />, text: pendingLabel },
    success: { glyph: <Tick reduce={!!reduce} />, text: successLabel },
    error: { glyph: <RetryGlyph reduce={!!reduce} />, text: errorLabel },
  };
  const announce = status === "pending" ? pendingLabel : status === "success" ? successLabel : status === "error" ? errorLabel : "";

  return (
    <>
      <Button
        ref={ref as React.Ref<HTMLElement>}
        type="button"
        data-state={visible}
        data-size={size}
        data-variant={variant}
        aria-busy={status === "pending" || undefined}
        // Stays focusable while busy so focus never falls to the page mid-request.
        disabled={disabled || locked}
        focusableWhenDisabled={locked && !disabled}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (locked) return;
          if (controlled) {
            onClick?.(e);
            return;
          }
          action.run(() => onClick?.(e));
        }}
        className={cn(
          "group/async relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.005em]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale,box-shadow] duration-150 ease-out active:duration-75",
          size === "sm" ? "h-7 rounded-md px-2.5 text-[12px]" : size === "lg" ? "h-9 rounded-lg px-3.5 text-[13px]" : "h-8 rounded-lg px-3 text-[12.5px]",
          variant === "secondary" && "border shadow-[var(--shadow)]",
          variant === "primary" && "shadow-[var(--shadow)]",
          tone(variant, status, visible),
          // Busy and done have already been pressed; they don't press again.
          !locked && "active:scale-[0.97]",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...rest}
      >
        {/* The name never changes; the live region below says what is happening. */}
        <span className="sr-only">{children}</span>

        {/* Every row sits in one grid cell, so the button is as wide as its widest state and nothing shifts. */}
        <span aria-hidden className="grid place-items-center">
          {(Object.keys(rows) as AsyncStatus[]).map((k) => (
            <Row key={k} glyph={rows[k].glyph ? <span /> : null} size={size} className="invisible col-start-1 row-start-1">
              {rows[k].text}
            </Row>
          ))}
          <AnimatePresence initial={false}>
            <motion.span
              key={visible}
              className="col-start-1 row-start-1 flex"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
            >
              <Row glyph={rows[visible].glyph} size={size}>{rows[visible].text}</Row>
            </motion.span>
          </AnimatePresence>
        </span>
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </>
  );
}

// One set of colors per state, never stacked, so no two utilities fight over a property.
function tone(variant: "primary" | "secondary", status: AsyncStatus, visible: AsyncStatus) {
  const primary = variant === "primary";
  // Busy reads as held, not as unavailable: no dimming, no hover, the press already happened.
  if (status === "pending") return primary ? "bg-fg/85 text-frame" : "border-line-2 bg-hover text-fg";
  if (visible === "error")
    return primary ? "bg-danger text-frame hover:bg-danger/90" : "border-danger/40 bg-raised text-danger hover:border-danger/60 hover:bg-danger-soft";
  return primary ? "bg-fg text-frame hover:bg-fg/90" : "border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover";
}

function Row({ glyph, size, className, children }: { glyph: React.ReactNode; size: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center", size === "sm" ? "gap-1.5" : "gap-2", className)}>
      {glyph && <span className={cn("grid shrink-0 place-items-center", size === "sm" ? "size-3.5 [&_svg]:size-3.5" : "size-4")}>{glyph}</span>}
      <span>{children}</span>
    </span>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Spinner() {
  return (
    <svg {...svg} className="animate-spin [animation-duration:0.8s]">
      <circle cx="8" cy="8" r="5.75" opacity="0.22" />
      <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
    </svg>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg {...svg} initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={spring.pop}>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }}
      />
    </motion.svg>
  );
}

function RetryGlyph({ reduce }: { reduce: boolean }) {
  // Winds back a quarter turn as it arrives, and leans further on hover:
  // the icon says "again" before the label is read.
  return (
    <span className="grid place-items-center transition-transform duration-200 ease-out group-hover/async:-rotate-45">
      <motion.svg {...svg} initial={reduce ? false : { rotate: 90, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} transition={spring.pop}>
        <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
      </motion.svg>
    </span>
  );
}
