"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

const ReduceCtx = createContext(false);

type MotionConflicts = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration";

export type FlipListProps = Omit<React.ComponentProps<"ul">, MotionConflicts> & {
  /** The list element. Children must be FlipItems with stable keys. */
  as?: "ul" | "ol" | "div";
  /** Animate the items that are there on first mount too. Off by default: a list that's already there shouldn't perform. */
  initial?: boolean;
  /** Called once every removed item has finished leaving. */
  onExitComplete?: () => void;
};

/**
 * When the children change order, arrive or leave, every item glides from where
 * it was to where it now is. Leaving items are lifted out of the flow at once,
 * so the rest close the gap while they fade rather than after.
 */
export function FlipList({ as: Tag = "ul", initial = false, onExitComplete, className, children, ...rest }: FlipListProps) {
  const reduce = !!useReducedMotion();
  const Comp = Tag as "ul";
  return (
    <ReduceCtx.Provider value={reduce}>
      {/* Popped (leaving) items are positioned against the list, so it has to be a containing block. */}
      <Comp className={cn("relative", className)} {...rest}>
        {/* Without movement, a leaving item holds its place while it fades so nothing overlaps; then the rest snap up. */}
        <AnimatePresence initial={initial} mode={reduce ? "sync" : "popLayout"} onExitComplete={onExitComplete}>
          {children}
        </AnimatePresence>
      </Comp>
    </ReduceCtx.Provider>
  );
}

export type FlipItemProps = Omit<React.ComponentProps<"li">, MotionConflicts> & {
  /** Use "div" inside a `FlipList as="div"`. */
  as?: "li" | "div";
};

const move = spring.soft;

/** One item. Its `key` is its identity: keep it stable across sorts and filters. */
export function FlipItem({ as = "li", className, ref, ...rest }: FlipItemProps) {
  const reduce = useContext(ReduceCtx);
  const props = {
    // "position" moves the item without scaling it, so text and borders never stretch mid-flight.
    layout: reduce ? false : ("position" as const),
    className,
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    exit: reduce
      ? { opacity: 0, transition: { duration: 0.12 } }
      : { opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: ease.out } },
    transition: { layout: move, default: { duration: reduce ? 0.15 : 0.24, ease: ease.out } },
    ...(rest as React.ComponentProps<typeof motion.li>),
  };
  return as === "div" ? (
    <motion.div ref={ref as unknown as React.Ref<HTMLDivElement>} {...(props as React.ComponentProps<typeof motion.div>)} />
  ) : (
    <motion.li ref={ref} {...props} />
  );
}
