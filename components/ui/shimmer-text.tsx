"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type ShimmerTextProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The status to show: "Thinking…", "Searching the web…". Changing it crossfades to the new label. */
  children: string;
  /** Sweep a sheen across the text. Turn it off when the work is done and the label becomes a plain record. */
  active?: boolean;
  /** Seconds for one full sweep, pause included. */
  duration?: number;
};

// currentColor is the resting tone; the soft band in the middle is the foreground.
// At 250% size the band crosses the text in about a third of each cycle, which
// leaves a beat of rest between sweeps. It runs the other way in right-to-left text.
// Reduced motion drops the sweep and shows the plain label.
const sheen = cn(
  "bg-[linear-gradient(90deg,currentColor_0%,currentColor_40%,var(--fg)_50%,currentColor_60%,currentColor_100%)]",
  "[background-size:250%_100%] bg-clip-text [-webkit-text-fill-color:transparent] animate-shine rtl:[animation-direction:reverse]",
  "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:[-webkit-text-fill-color:currentColor]",
);

/**
 * A one-line status label with a sheen moving across the letters. The sheen is a
 * gradient clipped to the text: the resting colour is the element's own colour
 * (set it with a text class), the highlight is the foreground. Only the label
 * shimmers, never a paragraph.
 */
export function ShimmerText({ children, active = true, duration = 2, className, style, ref, ...rest }: ShimmerTextProps) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();
  const [visible, setVisible] = useState(true);

  // The width follows the current label so whatever sits after it (a timer, a
  // chevron) glides to its new place instead of jumping. An invisible copy that
  // never wraps is measured, so the animation can't feed back into the reading.
  useEffect(() => {
    const el = sizerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The sweep repaints every frame, so it stops while the label is off screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !active) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [active]);

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)" };

  return (
    <span
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      data-state={active ? "active" : "idle"}
      className={cn(
        "relative inline-grid max-w-full overflow-x-clip whitespace-nowrap text-fg-2",
        "transition-[width] duration-300 ease-in-out-quart motion-reduce:transition-none",
        className,
      )}
      style={{ width, ...style }}
      {...rest}
    >
      <span ref={sizerRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 w-max">
        {children}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={children}
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 min-w-0 truncate",
            active && sheen,
          )}
          style={active ? { animationDuration: `${duration}s`, animationPlayState: visible ? "running" : "paused" } : undefined}
          initial={enter}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ ...leave, transition: { duration: reduce ? 0.12 : 0.16, ease: ease.in } }}
          transition={{ duration: reduce ? 0.16 : 0.26, ease: ease.out }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
      {/* The visible labels are decorative copies; this is what assistive tech reads and announces. */}
      <span className="sr-only">{children}</span>
    </span>
  );
}
