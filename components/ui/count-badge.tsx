"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type Size = "sm" | "md";
type Tone = "solid" | "danger" | "muted";
type Position = "inline" | "top-right" | "bottom-right";

const expo = `cubic-bezier(${ease.out.join(",")})`;
const digitTiming = {
  transformTiming: { duration: 420, easing: expo },
  spinTiming: { duration: 420, easing: expo },
  opacityTiming: { duration: 160, easing: "ease-out" },
};

export type CountBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The number to show. Nothing renders at 0 unless `showZero`. */
  count: number;
  /** Above this, the badge reads "99+" while the accessible label keeps the real number. */
  max?: number;
  /** A plain dot instead of digits, for "something new" without a number. */
  dot?: boolean;
  showZero?: boolean;
  size?: Size;
  /** Foreground fill (the quiet default), danger for things that need action, or muted for counts in a list. */
  tone?: Tone;
  /** Where it sits on its anchor. Defaults to top-right when it wraps children, inline otherwise. */
  position?: Position;
  /** Pull the badge in to sit on the edge of a round anchor like an avatar, not its empty bounding-box corner. */
  overlap?: "rectangular" | "circular";
  /** What a screen reader hears. Rendered visually hidden inside the badge, so a badge inside a button becomes part of its name. */
  label?: (count: number) => string;
  /** Also announce changes through a polite live region. For counts that change while the person is elsewhere. */
  announce?: boolean;
  /** The element the badge sits on: an icon button, an avatar. */
  children?: React.ReactNode;
};

const defaultLabel = (n: number) => `${n} new`;

const sizes = {
  sm: { pill: "h-4 min-w-4 px-1 text-[10px]", dot: "size-2" },
  md: { pill: "h-[18px] min-w-[18px] px-[5px] text-[10.5px]", dot: "size-2.5" },
} as const;

const tones = {
  solid: "bg-fg text-frame",
  danger: "bg-danger text-frame",
  muted: "bg-hover text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]",
} as const;

// Anchored badges are centered on the anchor's corner. On a circle the corner is
// empty space, so the center moves in to the rim at 45°: r(1 − 1/√2) ≈ 14.6%.
const anchors = {
  rectangular: { "top-right": "right-0 top-0 translate-x-1/2 -translate-y-1/2", "bottom-right": "right-0 bottom-0 translate-x-1/2 translate-y-1/2" },
  circular: { "top-right": "right-[14.6%] top-[14.6%] translate-x-1/2 -translate-y-1/2", "bottom-right": "right-[14.6%] bottom-[14.6%] translate-x-1/2 translate-y-1/2" },
} as const;

export function CountBadge({
  count,
  max = 99,
  dot = false,
  showZero = false,
  size = "md",
  tone = "solid",
  position,
  overlap = "rectangular",
  label = defaultLabel,
  announce = false,
  children,
  className,
  ...rest
}: CountBadgeProps) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const [ringScope, animateRing] = useAnimate<HTMLSpanElement>();
  const previous = useRef(count);
  const where: Position = position ?? (children ? "top-right" : "inline");
  const anchored = where !== "inline";
  const visible = dot ? count > 0 : count > 0 || showZero;
  const over = count > max;

  // A rise the person didn't cause gets a pop: up 18% in 90ms, then a spring back.
  // Falling counts (they read something) and the first appearance don't pop.
  useEffect(() => {
    const was = previous.current;
    previous.current = count;
    if (reduce || count <= was || was <= 0) return;
    if (scope.current) {
      animate(scope.current, { scale: 1.18 }, { duration: 0.09, ease: ease.out }).then(() => {
        if (scope.current) animate(scope.current, { scale: 1 }, spring.pop);
      });
    }
    // A dot has no digits to roll, so it sends out one soft ring instead.
    if (dot && ringScope.current) {
      animateRing(ringScope.current, { scale: [1, 2.6], opacity: [0.5, 0] }, { duration: 0.7, ease: ease.out });
    }
  }, [count, dot, reduce, animate, animateRing, scope, ringScope]);

  const text = visible ? label(count) : "";

  const badge = (
    <span
      data-slot="count-badge"
      data-size={size}
      data-tone={tone}
      data-state={visible ? "visible" : "hidden"}
      className={cn(
        "pointer-events-none select-none",
        anchored ? cn("absolute z-[1]", anchors[overlap][where]) : "relative inline-flex align-middle",
        !children && className,
      )}
      {...(children ? {} : rest)}
    >
      <AnimatePresence initial={false}>
        {visible && (
          <motion.span
            key="badge"
            aria-hidden
            className="relative block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.4, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            {dot ? (
              <span ref={scope} className="relative block">
                <span ref={ringScope} className={cn("absolute inset-0 rounded-full opacity-0", tones[tone].split(" ")[0])} />
                <span
                  className={cn(
                    "relative block rounded-full",
                    sizes[size].dot,
                    tones[tone],
                    anchored && "shadow-[0_0_0_2px_var(--badge-cutout,var(--frame))]",
                  )}
                />
              </span>
            ) : (
              <span
                ref={scope}
                className={cn(
                  "inline-flex items-center justify-center overflow-hidden rounded-full font-medium leading-none tracking-normal tabular",
                  sizes[size].pill,
                  tones[tone],
                  anchored && "shadow-[0_0_0_2px_var(--badge-cutout,var(--frame))]",
                )}
              >
                <NumberFlow
                  value={over ? max : count}
                  suffix={over ? "+" : undefined}
                  {...digitTiming}
                />
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
      <span className="sr-only" aria-live={announce ? "polite" : undefined}>
        {text}
      </span>
    </span>
  );

  if (!children) return badge;
  return (
    <span data-slot="count-badge-anchor" className={cn("relative inline-flex shrink-0 align-middle", className)} {...rest}>
      {children}
      {badge}
    </span>
  );
}
