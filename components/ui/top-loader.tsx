"use client";
import { Progress } from "@base-ui/react/progress";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Phase = "idle" | "waiting" | "trickling" | "finishing" | "fading";

/**
 * start() / done() / fail() with a counter, so overlapping requests keep one bar
 * running until the last of them settles. track(promise) does both for you.
 */
export function useTopLoader() {
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);
  const start = useCallback(() => {
    setError(false);
    setCount((c) => c + 1);
  }, []);
  const done = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const fail = useCallback(() => {
    setError(true);
    setCount((c) => Math.max(0, c - 1));
  }, []);
  const track = useCallback(
    <T,>(promise: Promise<T>) => {
      start();
      promise.then(done, fail);
      return promise;
    },
    [start, done, fail],
  );
  const loading = count > 0;
  return useMemo(() => ({ loading, error, start, done, fail, track }), [loading, error, start, done, fail, track]);
}

export type TopLoaderProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** True while the page (or anything) is loading. Flip it back to false to finish. */
  loading: boolean;
  /** Finish in the danger color, for a navigation that failed. */
  error?: boolean;
  /** Milliseconds before the bar appears. Loads that finish sooner never show it. */
  delay?: number;
  /** fixed pins it to the top of the viewport; absolute to the top of the nearest positioned parent. */
  position?: "fixed" | "absolute";
  /** Accessible name while visible. */
  label?: string;
};

// Where the trickle heads: fast at first, slowing as it nears 94%, never arriving
// on its own. Each step covers a share of the remaining distance.
const nextTrickle = (p: number, step: number) => Math.min(0.94, p + (0.94 - p) * (0.1 + (step % 3) * 0.04));

export function TopLoader({ loading, error = false, delay = 120, position = "fixed", label = "Loading page", className, style, ...rest }: TopLoaderProps) {
  const [phase, setPhase] = useState<Phase>(loading ? "waiting" : "idle");
  const [p, setP] = useState(0);
  const [prev, setPrev] = useState(loading);
  const steps = useRef(0);

  // Follow the prop on the render it changes.
  if (loading !== prev) {
    setPrev(loading);
    if (loading) {
      if (phase === "idle") setPhase("waiting");
      else if (phase === "finishing" || phase === "fading") {
        // A new load while the last one is leaving: start again from the left, unanimated.
        setP(0);
        setPhase("waiting");
      }
    } else if (phase === "waiting") setPhase("idle");
    else if (phase === "trickling") {
      setP(1);
      setPhase("finishing");
    }
  }
  useEffect(() => {
    if (phase === "waiting") {
      const id = window.setTimeout(() => {
        steps.current = 0;
        setP(0.08);
        setPhase("trickling");
      }, delay);
      return () => window.clearTimeout(id);
    }
    if (phase === "trickling") {
      const id = window.setInterval(() => {
        // Don't creep forward in a hidden tab; nobody is watching and it would arrive stale.
        if (document.hidden) return;
        steps.current += 1;
        setP((x) => nextTrickle(x, steps.current));
      }, 480);
      return () => window.clearInterval(id);
    }
    if (phase === "finishing") {
      const id = window.setTimeout(() => setPhase("fading"), error ? 520 : 240);
      return () => window.clearTimeout(id);
    }
    if (phase === "fading") {
      const id = window.setTimeout(() => {
        setP(0);
        setPhase("idle");
      }, 320);
      return () => window.clearTimeout(id);
    }
  }, [phase, delay, error]);

  const visible = phase === "trickling" || phase === "finishing";
  // Reset to 0 happens while invisible, so it must not animate backwards.
  const moving = phase === "trickling" ? "duration-[600ms]" : phase === "finishing" ? "duration-200" : "duration-0";

  return (
    <Progress.Root
      value={visible ? Math.round(p * 100) : null}
      aria-label={label}
      aria-hidden={!visible || undefined}
      data-state={phase}
      data-error={error || undefined}
      className={cn(
        "pointer-events-none inset-x-0 top-0 z-(--z-toast) h-0.5 overflow-hidden transition-opacity ease-out",
        position === "fixed" ? "fixed" : "absolute",
        visible ? "opacity-100 duration-150" : "opacity-0 duration-300",
        className,
      )}
      style={style}
      {...rest}
    >
      <Progress.Indicator
        className={cn(
          "absolute inset-y-0 left-0 transition-[transform,background-color] ease-out-quart motion-reduce:duration-0",
          moving,
          error && phase !== "trickling" ? "bg-danger" : "bg-fg",
        )}
        // Full width, slid left: composited, and the head stays crisp.
        style={{ width: "100%", transform: `translateX(${(p - 1) * 100}%)` }}
      />
    </Progress.Root>
  );
}
