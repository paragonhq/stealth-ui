"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type SwapPhase = "waiting" | "skeleton" | "holding" | "content";

type Options = {
  /** Milliseconds before the skeleton appears. Data that lands sooner never shows one. */
  delay?: number;
  /** Once the skeleton is visible, keep it at least this long so it never flickers. */
  minDuration?: number;
  /** When loading starts again after content was shown: keep it (dimmed) or go back to the skeleton. */
  refetch?: "keep" | "skeleton";
};

/**
 * The timing on its own. waiting (skeleton reserved but invisible) → skeleton →
 * holding (data is in, the minimum hasn't passed) → content. Loading again with
 * refetch="keep" stays on content and reports refreshing instead.
 */
export function useSkeletonSwap(loading: boolean, { delay = 150, minDuration = 400, refetch = "keep" }: Options = {}) {
  const [phase, setPhase] = useState<SwapPhase>(loading ? "waiting" : "content");
  const [seen, setSeen] = useState(!loading);
  const [prev, setPrev] = useState(loading);
  const [swapping, setSwapping] = useState(false);
  const shownAt = useRef(0);

  // React to the loading prop on the same render it changes, so a fast answer
  // goes straight to content without an intermediate frame.
  if (loading !== prev) {
    setPrev(loading);
    if (loading) {
      if (phase === "holding") setPhase("skeleton");
      else if (!(seen && refetch === "keep")) setPhase("waiting");
    } else if (phase === "waiting") {
      setPhase("content");
      setSeen(true);
    } else if (phase === "skeleton") {
      setPhase("holding");
    }
  }

  useEffect(() => {
    if (phase === "waiting") {
      const id = window.setTimeout(() => {
        shownAt.current = performance.now();
        setPhase("skeleton");
      }, delay);
      return () => window.clearTimeout(id);
    }
    if (phase === "holding") {
      const left = Math.max(0, minDuration - (performance.now() - shownAt.current));
      const id = window.setTimeout(() => {
        setSwapping(true);
        setPhase("content");
        setSeen(true);
      }, left);
      return () => window.clearTimeout(id);
    }
  }, [phase, delay, minDuration]);

  // Height is only animated around a swap; the rest of the time it is plain auto.
  useEffect(() => {
    if (!swapping) return;
    const id = window.setTimeout(() => setSwapping(false), 700);
    return () => window.clearTimeout(id);
  }, [swapping]);

  const refreshing = loading && phase === "content";
  // While waiting after content was already shown, keep showing it: never blank the region.
  const showContent = phase === "content" || (phase === "waiting" && seen);
  return { phase, showContent, refreshing, swapping };
}

export type SkeletonSwapProps = Omit<React.ComponentProps<"div">, "children"> &
  Options & {
    loading: boolean;
    /** What to show while loading, shaped like the content. */
    skeleton: React.ReactNode;
    children: React.ReactNode;
  };

export function SkeletonSwap({ loading, skeleton, delay, minDuration, refetch, className, children, ...rest }: SkeletonSwapProps) {
  const { phase, showContent, refreshing, swapping } = useSkeletonSwap(loading, { delay, minDuration, refetch });
  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const animateHeight = swapping && !reduce && height !== null;

  return (
    <motion.div
      aria-busy={loading || undefined}
      data-phase={phase}
      data-refreshing={refreshing || undefined}
      className={cn("relative", animateHeight && "overflow-hidden", className)}
      initial={false}
      animate={{ height: animateHeight ? height : "auto" }}
      transition={{ duration: 0.28, ease: ease.inOut }}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {/* Both layers share one grid cell, so during the crossfade the box is as tall as the taller one. */}
      <div ref={inner} className="grid">
        <AnimatePresence initial={false}>
          {showContent ? (
            <motion.div
              key="content"
              className="col-start-1 row-start-1 min-w-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.15, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.32, ease: ease.out }}
            >
              {/* A refetch slower than 150ms dims the old data; a quick one changes nothing. */}
              <div className={cn("transition-opacity duration-200", refreshing && "opacity-60 delay-150")}>{children}</div>
            </motion.div>
          ) : (
            <motion.div
              key="skeleton"
              aria-hidden={phase === "waiting" || undefined}
              className="col-start-1 row-start-1 min-w-0"
              initial={{ opacity: 0 }}
              // Reserved but invisible while waiting: the space is held, nothing flashes.
              animate={{ opacity: phase === "waiting" ? 0 : 1 }}
              exit={{ opacity: 0, transition: { duration: reduce ? 0.12 : 0.18, ease: ease.in } }}
              transition={{ duration: 0.2, ease: ease.out }}
            >
              {skeleton}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
