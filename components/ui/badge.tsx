"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
export type BadgeVariant = "soft" | "outline" | "solid";
export type BadgeSize = "sm" | "md" | "lg";

// Soft is the default: a wash of the tone with the tone as text. Outline keeps the page quiet
// in dense tables. Solid is for the one badge on screen that has to be seen.
const tones: Record<BadgeVariant, Record<BadgeTone, string>> = {
  soft: {
    neutral: "bg-fg/[0.07] text-fg-2",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  },
  outline: {
    neutral: "border-line-2 text-fg-2",
    success: "border-success/35 text-success",
    warning: "border-warning/35 text-warning",
    danger: "border-danger/35 text-danger",
    info: "border-info/35 text-info",
  },
  // Text on the solid fills is picked per theme for contrast: the pale dark-theme fills take the
  // frame color; in light, green and amber are too pale for it and take the foreground instead.
  solid: {
    neutral: "bg-fg text-frame",
    success: "bg-success text-frame in-data-[theme=light]:text-fg",
    warning: "bg-warning text-frame in-data-[theme=light]:text-fg",
    danger: "bg-danger text-frame",
    info: "bg-info text-frame",
  },
};

const sizes: Record<BadgeSize, string> = {
  sm: "h-[18px] rounded-[5px] text-[11px]",
  md: "h-5 rounded-md text-[11.5px]",
  lg: "h-6 rounded-md text-[12.5px]",
};

// Padding lives on the inner span, so the width the badge glides to includes it.
const pads: Record<BadgeSize, string> = { sm: "gap-1 px-1.5", md: "gap-1.5 px-1.5", lg: "gap-1.5 px-2" };

/* -------------------------------------------------------------------------------------------------
 * Dot
 * -----------------------------------------------------------------------------------------------*/

export type BadgeDotProps = React.ComponentProps<"span"> & {
  /** "current" follows the text color, for dots on solid fills. */
  tone?: BadgeTone | "current";
  /** A soft ring pulses out from the dot: for live and in-progress states only. */
  pulse?: boolean;
  /** Diameter in px. */
  size?: number;
  /** Spoken instead of shown, e.g. "Unread". Leave empty when a visible label says it. */
  label?: string;
};

const dotTone: Record<BadgeTone | "current", string> = {
  current: "bg-current",
  neutral: "bg-fg-3",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

/** A status dot on its own: unread markers, service health, the dot inside a badge. */
export function BadgeDot({ tone = "neutral", pulse = false, size = 6, label, className, style, ...rest }: BadgeDotProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-tone={tone}
      data-pulse={pulse || undefined}
      style={{ width: size, height: size, ...style }}
      className={cn("relative inline-block shrink-0 rounded-full transition-[background-color] duration-200", dotTone[tone], className)}
      {...rest}
    >
      {pulse && <span className={cn("absolute inset-0 animate-ping-soft rounded-full motion-reduce:hidden", dotTone[tone])} />}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Badge
 * -----------------------------------------------------------------------------------------------*/

export type BadgeProps = React.ComponentProps<"span"> & {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** A leading dot in the tone. */
  dot?: boolean;
  /** Pulse the dot, for states that are live or still running. */
  pulse?: boolean;
  /** A leading icon, drawn at 12px (14px in lg). Replaces the dot. */
  icon?: React.ReactNode;
};

/**
 * A short status or label. When the label changes (Queued → Building → Ready) the old word
 * lifts out, the new one rises in, the width glides to fit and the color follows, so a
 * status that updates in place is noticed without a flash.
 */
export function Badge({ tone = "neutral", variant = "soft", size = "md", dot = false, pulse = false, icon, className, children, ...rest }: BadgeProps) {
  const reduce = useReducedMotion();
  const inner = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  // Track the content's width so the badge can glide to it instead of snapping.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const swapKey = typeof children === "string" || typeof children === "number" ? String(children) : "node";
  const lead = icon ? (
    <span aria-hidden className={cn("grid shrink-0 place-items-center [&_svg]:size-full", size === "lg" ? "size-3.5" : "size-3")}>
      {icon}
    </span>
  ) : dot || pulse ? (
    <BadgeDot tone={variant === "solid" ? "current" : tone} pulse={pulse} size={size === "lg" ? 6 : 5} />
  ) : null;

  return (
    <motion.span
      data-tone={tone}
      data-variant={variant}
      data-size={size}
      initial={false}
      animate={width == null ? undefined : { width }}
      transition={reduce ? { duration: 0 } : spring.snappy}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center overflow-hidden whitespace-nowrap align-middle font-medium leading-none tracking-[0.005em]",
        "transition-[background-color,border-color,color] duration-200 ease-out",
        variant === "outline" ? "border" : "border border-transparent",
        tones[variant][tone],
        sizes[size],
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.span>)}
    >
      <span ref={inner} className={cn("relative inline-flex items-center", pads[size])}>
        {lead}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={swapKey}
            className="tabular"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.out } }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Count
 * -----------------------------------------------------------------------------------------------*/

export type BadgeCountProps = Omit<React.ComponentProps<"span">, "children"> & {
  count: number;
  /** Above this the badge reads "99+". */
  max?: number;
  /** Keep the badge at 0 instead of letting it go. */
  showZero?: boolean;
  tone?: BadgeTone;
  variant?: "soft" | "solid";
  size?: "sm" | "md";
  /** What the number counts, for screen readers: (n) => `${n} unread`. */
  label?: (count: number) => string;
  /**
   * Pin the count to the top-right corner of this element (an icon button, an avatar). The
   * count gets a ring in `--badge-ring`, the surface behind it, `--frame` by default.
   */
  children?: React.ReactNode;
};

/**
 * A number in a pill. Digits roll rather than swap, the pill pops once when the count goes up,
 * and it scales in from nothing and back out when it reaches zero.
 */
export function BadgeCount({
  count,
  max = 99,
  showZero = false,
  tone = "neutral",
  variant = "solid",
  size = "md",
  label = (n) => String(n),
  className,
  children,
  ...rest
}: BadgeCountProps) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const prev = useRef(count);
  const visible = count > 0 || showZero;
  const over = count > max;

  // A single small pop when the number grows: the signal that something new arrived.
  useEffect(() => {
    const grew = count > prev.current;
    prev.current = count;
    if (!grew || reduce || !scope.current) return;
    animate(scope.current, { scale: [1, 1.14, 1] }, { duration: 0.32, ease: ease.out });
  }, [count, reduce, animate, scope]);

  const pill = (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.span
          key="count"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: 0.14, ease: ease.out } }}
          transition={reduce ? { duration: 0.12 } : spring.pop}
          className={cn(!!children && "pointer-events-none absolute -right-1 -top-1 z-10")}
        >
          <span
            ref={scope}
            data-tone={tone}
            data-variant={variant}
            className={cn(
              "inline-flex items-center justify-center rounded-full font-medium leading-none tabular",
              "transition-[background-color,color] duration-200",
              size === "sm" ? "h-4 min-w-4 px-1 text-[10px]" : "h-[18px] min-w-[18px] px-[5px] text-[11px]",
              tones[variant][tone],
              !!children && "shadow-[0_0_0_2px_var(--badge-ring,var(--frame))]",
              className,
            )}
            {...rest}
          >
            <span aria-hidden className="flex items-center">
              <NumberFlow value={Math.min(count, max)} className="leading-none" />
              {over && <span className="-mr-px">+</span>}
            </span>
            <span className="sr-only">{label(count)}</span>
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );

  if (!children) return pill;
  return (
    <span className="relative inline-flex">
      {children}
      {pill}
    </span>
  );
}
