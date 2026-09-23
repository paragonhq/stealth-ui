"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type LiveCursor = {
  /** Stable id from your presence channel. */
  id: string;
  name: string;
  /** Horizontal position as a fraction of the layer, 0 at the left edge and 1 at the right. */
  x: number;
  /** Vertical position as a fraction of the layer, 0 at the top and 1 at the bottom. */
  y: number;
  /** Any CSS color for the arrow and label. Defaults to the foreground. */
  color?: string;
};

// Tuned for updates arriving 10–30 times a second: fast enough to keep up with a hand,
// soft enough that the gaps between network frames read as one continuous movement.
const glide = { stiffness: 320, damping: 32, mass: 0.6 };

export type LiveCursorsProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Everyone else's cursor. Never include the viewer's own. */
  cursors: LiveCursor[];
  /** Milliseconds without movement before a name tucks away to an initial. */
  idleAfter?: number;
};

/**
 * Other people's pointers over a shared surface. Positions are fractions of the layer, so a
 * cursor lands on the same spot however wide each person's window is. Place it inside the
 * element it covers; that element needs `position: relative`.
 */
export function LiveCursors({ cursors, idleAfter = 2500, className, ...rest }: LiveCursorsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} {...rest}>
      {size && (
        <AnimatePresence>
          {cursors.map((c) => (
            <Cursor key={c.id} cursor={c} width={size.w} height={size.h} idleAfter={idleAfter} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

function Cursor({ cursor: c, width, height, idleAfter }: { cursor: LiveCursor; width: number; height: number; idleAfter: number }) {
  const reduce = useReducedMotion();
  const x = useSpring(c.x * width, glide);
  const y = useSpring(c.y * height, glide);
  const label = useMotionValue(1);
  const badge = useMotionValue(0);
  const size = useRef({ width, height });

  // New positions glide; a resized layer jumps, because the person didn't move, the window did.
  useEffect(() => {
    const resized = size.current.width !== width || size.current.height !== height;
    size.current = { width, height };
    const tx = c.x * width;
    const ty = c.y * height;
    if (reduce || resized) {
      x.jump(tx);
      y.jump(ty);
    } else {
      x.set(tx);
      y.set(ty);
    }
  }, [c.x, c.y, width, height, reduce, x, y]);

  // Moving shows the name; stillness tucks it away to an initial so idle cursors stop shouting.
  useEffect(() => {
    const t = reduce ? { duration: 0.12 } : { duration: 0.18, ease: ease.out };
    animate(label, 1, t);
    animate(badge, 0, t);
    const timer = window.setTimeout(() => {
      animate(label, 0, reduce ? { duration: 0.2 } : { duration: 0.32, ease: ease.out });
      animate(badge, 1, reduce ? { duration: 0.2 } : { duration: 0.32, ease: ease.out, delay: 0.08 });
    }, idleAfter);
    return () => window.clearTimeout(timer);
  }, [c.x, c.y, idleAfter, reduce, label, badge]);

  const color = c.color ?? "var(--fg)";
  // Near the right edge the label swings to the left of the arrow instead of being clipped.
  const flip = width - c.x * width < 150;
  const initial = (Array.from(c.name.trim())[0] ?? "").toUpperCase();

  return (
    <motion.div className="absolute left-0 top-0 will-change-transform" style={{ x, y }}>
      <motion.div
        className="origin-top-left"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.6, transition: { duration: 0.16, ease: ease.out } }}
        transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 30, mass: 0.6 }}
      >
        {/* The tip sits exactly on the point. A frame-colored outline keeps it legible on any fill. */}
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none" className="-translate-x-[1.5px] -translate-y-[1.5px]">
          <path d="M1.5 1.5 14 7.6 8.4 9.2 5.9 14.9z" fill={color} stroke="var(--frame)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span className={cn("absolute left-[10px] top-[15px] grid w-max transition-[translate] duration-240 ease-in-out-quart motion-reduce:transition-none", flip && "-translate-x-[calc(100%+14px)]")}>
          <motion.span
            style={{ opacity: label, scale: label, backgroundColor: color, transformOrigin: flip ? "top right" : "top left" }}
            className={cn(
              "col-start-1 row-start-1 flex h-5 max-w-40 items-center truncate whitespace-nowrap rounded-md px-1.5 text-[11.5px] font-medium leading-none text-frame shadow-pop",
              flip ? "rounded-tr-[3px]" : "rounded-tl-[3px]",
            )}
          >
            {c.name}
          </motion.span>
          <motion.span
            style={{ opacity: badge, scale: badge, backgroundColor: color, transformOrigin: flip ? "top right" : "top left" }}
            className={cn("col-start-1 row-start-1 grid size-4 place-items-center rounded-full text-[9.5px] font-semibold leading-none text-frame", flip && "justify-self-end")}
          >
            {initial}
          </motion.span>
        </span>
      </motion.div>
    </motion.div>
  );
}
