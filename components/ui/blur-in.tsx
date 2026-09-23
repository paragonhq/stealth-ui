"use client";
import { motion, useReducedMotion, type Transition, type Variants } from "motion/react";
import { createContext, useContext, useState } from "react";
import { ease } from "@/lib/motion";

type Tag = "div" | "section" | "article" | "header" | "ul" | "ol" | "li" | "p" | "span" | "h1" | "h2" | "h3";

// Motion's own handlers share these names with different signatures.
type Native = Omit<
  React.ComponentProps<"div">,
  "ref" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

export type BlurInProps = Native & {
  /** The element to render. */
  as?: Tag;
  /** mount: as soon as it renders. inView: the first time it scrolls into view (at once if it already is). */
  trigger?: "mount" | "inView";
  /** With inView: play again each time it re-enters. Off by default; a reveal is for the first look. */
  replay?: boolean;
  /** With inView: how much of it must be visible, 0–1. */
  amount?: number;
  /** With inView: the scrolling element to watch instead of the window. */
  root?: React.RefObject<Element | null>;
  /** Seconds before it starts, e.g. to follow something else in. */
  delay?: number;
  /** Seconds the reveal takes. */
  duration?: number;
  /** How far it rises, in px. */
  y?: number;
  /** How much blur it clears, in px. Keep it small on large areas. */
  blur?: number;
  /**
   * Reveal the BlurInItem children one after another instead of this element as a whole.
   * true staggers them 50ms apart; a number sets the gap in seconds. Capped after the eighth.
   */
  stagger?: boolean | number;
  /** Called once the reveal has finished. */
  onRevealed?: () => void;
  ref?: React.Ref<HTMLElement>;
};

export type BlurInItemProps = Native & { as?: Tag; ref?: React.Ref<HTMLElement> };

type Shape = { y: number; blur: number; duration: number; reduce: boolean; settled: boolean };
const Ctx = createContext<Shape | null>(null);

// Hidden and shown are the same shape everywhere, so server and client render the
// same first frame whatever the motion setting. Reduced motion only changes the
// transition: the fade stays, rise and blur snap. The filter is removed when done,
// because even blur(0px) traps position: fixed descendants.
// Items leave delay out entirely: any delay of their own, even 0, overrides the stagger.
function reveal({ y, blur, duration, reduce }: Omit<Shape, "settled">, delay?: number): Variants {
  const wait = delay ? { delay: reduce ? Math.min(delay, 0.1) : delay } : {};
  const transition: Transition = reduce
    ? { duration: 0.2, ease: ease.out, y: { duration: 0 }, filter: { duration: 0 }, ...wait }
    : { duration, ease: ease.out, ...wait };
  return {
    hidden: { opacity: 0, y, filter: `blur(${blur}px)` },
    shown: { opacity: 1, y: 0, filter: "blur(0px)", transition, transitionEnd: { filter: "none" } },
  };
}

// Stagger by position, but stop adding delay after the eighth item, so the tail of a
// long list never arrives after someone has started reading.
const capped = (gap: number, start: number) => (i: number) => start + Math.min(i, 7) * gap;

export function BlurIn({
  as = "div",
  trigger = "inView",
  replay = false,
  amount = 0.15,
  root,
  delay = 0,
  duration = 0.5,
  y = 8,
  blur = 4,
  stagger = false,
  onRevealed,
  className,
  children,
  ref,
  ...rest
}: BlurInProps) {
  const reduce = !!useReducedMotion();
  // Items that mount after the reveal (a list that grows) are simply there.
  const [settled, setSettled] = useState(false);
  const Comp = motion[as] as typeof motion.div;
  const staggered = stagger !== false;
  const gap = stagger === true ? 0.05 : typeof stagger === "number" ? stagger : 0;

  const variants: Variants = staggered
    ? { hidden: {}, shown: { transition: { delayChildren: reduce ? delay : capped(gap, delay) } } }
    : reveal({ y, blur, duration, reduce }, delay);

  const play =
    trigger === "mount"
      ? { animate: "shown" }
      : { whileInView: "shown", viewport: { once: !replay, amount, root } };

  return (
    <Ctx.Provider value={{ y, blur, duration, reduce, settled }}>
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        data-blur-in=""
        data-trigger={trigger}
        initial="hidden"
        {...play}
        variants={variants}
        onAnimationComplete={(name) => {
          if (name !== "shown") return;
          setSettled(true);
          onRevealed?.();
        }}
        className={className}
        {...rest}
      >
        {children}
      </Comp>
      {/* Without JavaScript nothing would ever reveal it, so it starts visible. */}
      <noscript>
        <style>{`[data-blur-in],[data-blur-in-item]{opacity:1!important;transform:none!important;filter:none!important}`}</style>
      </noscript>
    </Ctx.Provider>
  );
}

/** One piece of a staggered BlurIn. Outside one it renders as a plain element. */
export function BlurInItem({ as = "div", className, children, ref, ...rest }: BlurInItemProps) {
  const shape = useContext(Ctx);
  const Comp = motion[as] as typeof motion.div;
  if (!shape) {
    const Plain = as as "div";
    return (
      <Plain ref={ref as React.Ref<HTMLDivElement>} className={className} {...(rest as React.ComponentProps<"div">)}>
        {children}
      </Plain>
    );
  }
  return (
    <Comp
      ref={ref as React.Ref<HTMLDivElement>}
      data-blur-in-item=""
      // No initial label of its own: that would detach it from the parent's variants.
      // It inherits "hidden" and plays "shown" when the parent does, on the stagger.
      initial={shape.settled ? false : undefined}
      variants={reveal(shape)}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}
