"use client";
import { Progress } from "@base-ui/react/progress";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

// The indeterminate spin is a CSS loop so it keeps turning while the main thread
// is busy. Reduced motion holds the arc still and breathes it instead.
const CSS = `
@keyframes stealth-ring-turn { to { transform: rotate(360deg); } }
@keyframes stealth-ring-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.stealth-ring [data-part="spin"] { animation: stealth-ring-turn 0.9s linear infinite; transform-origin: center; transform-box: fill-box; }
@media (prefers-reduced-motion: reduce) {
  .stealth-ring [data-part="spin"] { animation: stealth-ring-breathe 2.4s ease-in-out infinite !important; }
}
`;

const SIZES = {
  sm: { px: 20, stroke: 2, text: "" },
  md: { px: 40, stroke: 3, text: "text-[10.5px]" },
  lg: { px: 64, stroke: 4, text: "text-[14px] font-medium tracking-[-0.01em]" },
} as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type ProgressRingProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Current value. null spins: the work has started but its size isn't known. */
  value: number | null;
  min?: number;
  max?: number;
  /** 20px (icon size, no number), 40px or 64px. */
  size?: keyof typeof SIZES;
  /** The rolling percentage in the center. Defaults to true for md and lg. */
  showValue?: boolean;
  /** The work stopped. The arc and the number turn the danger color. */
  error?: boolean;
  /** Replace the center, e.g. an icon or "3/12". The completion tick still takes over at the end. */
  children?: React.ReactNode;
  getAriaValueText?: (formattedValue: string, value: number | null) => string;
};

export function ProgressRing({
  value,
  min = 0,
  max = 100,
  size = "md",
  showValue,
  error = false,
  children,
  getAriaValueText,
  className,
  style,
  ...rest
}: ProgressRingProps) {
  const reduce = useReducedMotion();
  const { px, stroke, text } = SIZES[size];
  const indeterminate = value === null || !Number.isFinite(value);
  const pct = indeterminate ? 0 : clamp01(((value as number) - min) / (max - min || 1)) * 100;
  const complete = !indeterminate && pct >= 100 && !error;
  const withValue = showValue ?? size !== "sm";
  const r = (px - stroke) / 2;
  const c = px / 2;
  const state = error ? "error" : complete ? "complete" : indeterminate ? "indeterminate" : "progressing";
  const arcColor = error ? "text-danger" : complete ? "text-success" : "text-fg";

  return (
    <Progress.Root
      value={indeterminate ? null : value}
      min={min}
      max={max}
      getAriaValueText={(formatted, v) => (getAriaValueText ? getAriaValueText(formatted, v) : error ? `${formatted}, failed` : complete ? "Complete" : (formatted ?? "Loading"))}
      data-state={state}
      data-size={size}
      className={cn("stealth-ring relative inline-grid shrink-0 place-items-center align-middle", className)}
      style={{ width: px, height: px, ...style }}
      {...rest}
    >
      <style href="stealth-progress-ring" precedence="default">
        {CSS}
      </style>

      {/* A small settle when it completes: the ring answers the moment it closes. */}
      <motion.svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        fill="none"
        aria-hidden
        className="absolute inset-0 -rotate-90"
        animate={complete && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.42, ease: ease.out, delay: 0.38 }}
      >
        <circle cx={c} cy={c} r={r} stroke="currentColor" strokeWidth={stroke} className="text-line-2" />
        {indeterminate ? (
          <circle
            data-part="spin"
            cx={c}
            cy={c}
            r={r}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray="28 72"
            className={arcColor}
          />
        ) : (
          <circle
            cx={c}
            cy={c}
            r={r}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray="100 100"
            // A zero-length arc with round caps would draw a dot; hide it until there is progress.
            style={{ strokeDashoffset: 100 - pct, opacity: pct > 0 ? 1 : 0 }}
            className={cn("transition-[stroke-dashoffset,color,opacity] duration-[480ms] ease-out-quart motion-reduce:duration-150", arcColor)}
          />
        )}
      </motion.svg>

      <span className={cn("tabular relative grid place-items-center leading-none", text, error ? "text-danger" : "text-fg")}>
        <AnimatePresence initial={false}>
          {complete ? (
            <motion.span
              key="done"
              className="col-start-1 row-start-1 grid place-items-center text-success"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={reduce ? { duration: 0.15 } : { ...spring.pop, delay: 0.3 }}
            >
              <Tick px={px} reduce={!!reduce} />
            </motion.span>
          ) : children != null ? (
            <motion.span key="custom" className="col-start-1 row-start-1 grid place-items-center" exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}>
              {children}
            </motion.span>
          ) : withValue && !indeterminate ? (
            <motion.span
              key="value"
              aria-hidden
              className="col-start-1 row-start-1"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              // Waits for the arc to close before making way for the tick.
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(2px)", transition: { duration: 0.14, delay: 0.24 } }}
              transition={{ duration: 0.2, ease: ease.out }}
            >
              <NumberFlow value={pct / 100} format={{ style: "percent", maximumFractionDigits: 0 }} animated={!reduce} willChange />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </Progress.Root>
  );
}

function Tick({ px, reduce }: { px: number; reduce: boolean }) {
  const s = Math.round(px * 0.45);
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={px < 32 ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.34, ease: ease.out, delay: 0.36 }}
      />
    </svg>
  );
}
