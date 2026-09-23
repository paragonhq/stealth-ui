"use client";
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Transition, type Variants } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimateHeight } from "@/components/ui/animate-height";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Key = string | number;
type Direction = 1 | -1;

export type PresenceSwapProps<K extends Key> = Omit<React.ComponentProps<"div">, "children" | "style"> & {
  /** Which view is showing. Changing it swaps the children for the new ones. */
  value: K;
  /** The view for the current value. */
  children: React.ReactNode;
  /**
   * slide: the new view arrives from the side it lives on (forward from the right),
   * for steps, tabs and drill-downs. fade: a crossfade in place, for views with no order.
   */
  variant?: "slide" | "fade";
  /** Every value in order, so it knows which way is forward. Numbers compare on their own. */
  order?: readonly K[];
  /** Force the direction of this swap instead of inferring it. */
  direction?: Direction;
  /** How far a sliding view travels, in px. */
  distance?: number;
  /** Follow the height of each view on a spring. Off, the box jumps to the new height. */
  animateHeight?: boolean;
  /** Swap without animating while true, e.g. when the change came from an arrow key. */
  instant?: boolean;
  style?: Omit<React.CSSProperties, "height">;
};

function directionOf<K extends Key>(from: K, to: K, order?: readonly K[]): Direction {
  if (order) {
    const a = order.indexOf(from);
    const b = order.indexOf(to);
    if (a >= 0 && b >= 0) return b >= a ? 1 : -1;
  }
  if (typeof from === "number" && typeof to === "number") return to >= from ? 1 : -1;
  return 1;
}

type Custom = { dir: Direction; distance: number };

// Forward arrives from the right and leaves to the left; back is the mirror.
// The leaving view travels half as far and drops its opacity up front (ease-out,
// not ease-in), so the two views overlap for as little time as possible and
// never read as a double exposure.
const variants: Record<"slide" | "fade", Variants> = {
  slide: {
    enter: ({ dir, distance }: Custom) => ({ opacity: 0, x: dir * distance, filter: "blur(2px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.32, ease: ease.out } },
    exit: ({ dir, distance }: Custom) => ({
      opacity: 0,
      x: dir * -distance * 0.5,
      filter: "blur(2px)",
      transition: { duration: 0.18, ease: ease.outQuart },
    }),
  },
  fade: {
    enter: { opacity: 0, filter: "blur(2px)" },
    center: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.24, ease: ease.out } },
    exit: { opacity: 0, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.outQuart } },
  },
};

// Reduced motion keeps a short crossfade. Resting styles match the full variants,
// so server and client agree whatever the setting.
const reduced: Variants = {
  enter: { opacity: 0, x: 0, filter: "blur(0px)" },
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
// Keyboard-driven or bulk changes: the new view is simply there.
const none: Transition = { duration: 0 };
const immediate: Variants = {
  enter: { opacity: 0, x: 0, filter: "blur(0px)" },
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: none },
  exit: { opacity: 0, transition: none },
};

export function PresenceSwap<K extends Key>({
  value,
  children,
  variant = "slide",
  order,
  direction,
  distance = 24,
  animateHeight = true,
  instant = false,
  className,
  ...rest
}: PresenceSwapProps<K>) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  // Remember the last value so the next swap knows which way it's going.
  const [shown, setShown] = useState({ value, dir: 1 as Direction, swaps: 0 });
  if (shown.value !== value) {
    setShown({ value, dir: direction ?? directionOf(shown.value, value, order), swaps: shown.swaps + 1 });
  }

  // A view on its way out can't be clicked, tabbed into or read. If focus was
  // inside it, hand focus to the view coming in, so keyboard users never land on
  // <body>: its [data-autofocus] element if it has one, else the view itself.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || shown.swaps === 0) return;
    const panes = Array.from(root.querySelectorAll<HTMLElement>(":scope > div > [data-swap-pane]"));
    const leaving = panes.filter((p) => p.dataset.swapPane === "leaving");
    const entering = panes.find((p) => p.dataset.swapPane === "shown");
    const hadFocus = leaving.some((p) => p.contains(document.activeElement));
    for (const p of leaving) p.inert = true;
    if (hadFocus && entering) {
      const target = entering.querySelector<HTMLElement>("[data-autofocus], [autofocus]") ?? entering;
      target.focus({ preventScroll: true });
    }
  }, [shown.swaps]);

  const custom: Custom = { dir: shown.dir, distance };

  return (
    <AnimateHeight
      ref={rootRef}
      instant={instant || !animateHeight}
      data-variant={variant}
      data-direction={shown.dir === 1 ? "forward" : "back"}
      className={cn("min-w-0", className)}
      // popLayout lifts the leaving view out of the flow, positioned against this box.
      contentClassName="relative"
      {...rest}
    >
      <AnimatePresence initial={false} mode="popLayout" custom={custom}>
        <Pane key={value} custom={custom} variants={instant ? immediate : reduce ? reduced : variants[variant]}>
          {children}
        </Pane>
      </AnimatePresence>
    </AnimateHeight>
  );
}

function Pane({
  custom,
  variants,
  children,
  ref,
}: {
  custom: Custom;
  variants: Variants;
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      ref={ref}
      data-swap-pane={present ? "shown" : "leaving"}
      aria-hidden={present ? undefined : true}
      tabIndex={-1}
      custom={custom}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      className={cn("outline-none", !present && "pointer-events-none")}
    >
      {children}
    </motion.div>
  );
}
