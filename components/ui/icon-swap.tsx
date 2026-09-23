"use client";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { spring, swap } from "@/lib/motion";

type Direction = 1 | -1;

export type IconSwapProps<K extends string> = Omit<React.ComponentProps<"span">, "children"> & {
  /** Which icon is showing. Changing it swaps. */
  value: K;
  /** Every icon it can show, by key. Their order sets which way "forward" turns or rolls. */
  icons: Record<K, React.ReactNode>;
  /**
   * blur: scale and blur through each other, for state changes (play, pause, copied).
   * rotate: turn a quarter as they swap, for toggles and cycles (menu, theme).
   * slide: roll through the box like a counter, for ordered values (sort direction).
   */
  variant?: "blur" | "rotate" | "slide";
  /** The box, in px. Nothing around it moves while icons swap, whatever their size. */
  size?: number;
  /** Force the turn or roll direction. Otherwise it follows the order of `icons`. */
  direction?: Direction;
  /** Give the icon a name (role="img") when it isn't inside a labelled control. */
  label?: string;
};

// Which way is forward: the shorter way round the list, so a three-state cycle
// that wraps from last to first keeps turning the same way.
function directionOf(keys: string[], from: string, to: string): Direction {
  const a = keys.indexOf(from);
  const b = keys.indexOf(to);
  if (a < 0 || b < 0) return 1;
  if (keys.length < 3) return b > a ? 1 : -1;
  const ahead = (b - a + keys.length) % keys.length;
  return ahead <= keys.length / 2 ? 1 : -1;
}

const variants: Record<"blur" | "rotate" | "slide", Variants> = {
  blur: { enter: swap.initial, center: swap.animate, exit: swap.exit },
  rotate: {
    enter: (d: Direction) => ({ opacity: 0, scale: 0.6, rotate: -90 * d, filter: "blur(2px)" }),
    center: { opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" },
    exit: (d: Direction) => ({ opacity: 0, scale: 0.6, rotate: 90 * d, filter: "blur(2px)" }),
  },
  slide: {
    enter: (d: Direction) => ({ opacity: 0, y: `${75 * d}%`, filter: "blur(1.5px)" }),
    center: { opacity: 1, y: "0%", filter: "blur(0px)" },
    exit: (d: Direction) => ({ opacity: 0, y: `${-75 * d}%`, filter: "blur(1.5px)" }),
  },
};

// Reduced motion keeps only the crossfade. The resting state stays identical to the
// full variant, so server and client render the same styles whatever the setting.
const faded = (v: Variants): Variants => ({ enter: { ...v.center, opacity: 0 }, center: v.center, exit: { ...v.center, opacity: 0 } });
const reduced = { blur: faded(variants.blur), rotate: faded(variants.rotate), slide: faded(variants.slide) };

export function IconSwap<K extends string>({
  value,
  icons,
  variant = "blur",
  size = 16,
  direction,
  label,
  className,
  style,
  ...rest
}: IconSwapProps<K>) {
  const reduce = useReducedMotion();
  // Remember the last value so the next swap knows which way it's going.
  const [shown, setShown] = useState({ value, dir: 1 as Direction });
  if (shown.value !== value) {
    setShown({ value, dir: direction ?? directionOf(Object.keys(icons), shown.value, value) });
  }

  return (
    <span
      data-variant={variant}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-grid shrink-0 place-items-center align-middle",
        // A roll reads as a counter only if it's clipped to the box.
        variant === "slide" && "overflow-hidden",
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <AnimatePresence initial={false} custom={shown.dir}>
        <motion.span
          key={value}
          custom={shown.dir}
          variants={(reduce ? reduced : variants)[variant]}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduce ? { duration: 0.12 } : variant === "slide" ? spring.snappy : spring.pop}
          className="pointer-events-none absolute inset-0 grid place-items-center [&>svg]:shrink-0"
        >
          {icons[value]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
