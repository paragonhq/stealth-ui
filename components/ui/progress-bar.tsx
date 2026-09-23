"use client";
import { Progress } from "@base-ui/react/progress";
import NumberFlow, { type Format } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

// The indeterminate sweep is a keyframe (it loops and is never interrupted).
// Under reduced motion it stops traveling and the whole track breathes instead,
// specific enough to outrank a global animation kill switch.
const CSS = `
@keyframes stealth-progress-sweep { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
@keyframes stealth-progress-breathe { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.6; } }
.stealth-progress [data-part="sweep"] { animation: stealth-progress-sweep 1.5s cubic-bezier(0.76, 0, 0.24, 1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .stealth-progress [data-part="sweep"] { width: 100% !important; transform: none !important; animation: stealth-progress-breathe 2.4s ease-in-out infinite !important; }
}
`;

const HEIGHT = { sm: "h-[3px]", md: "h-1", lg: "h-1.5" } as const;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type ProgressBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Current value. null means indeterminate: the work has started but its size isn't known. */
  value: number | null;
  min?: number;
  max?: number;
  /** Visible label above the track, also its accessible name. Without it, pass aria-label. */
  label?: React.ReactNode;
  /** A quieter line under the track: "2.4 MB of 5.8 MB · about 12s left". */
  description?: React.ReactNode;
  /** Show the rolling value at the end of the label row. Defaults to true when there is a label. */
  showValue?: boolean;
  /** How far ahead something else has got: downloaded vs played, read vs processed. Same scale as value. */
  buffer?: number;
  /** Split the track into equal steps, for "step 2 of 4". Each step fills in turn. */
  segments?: number;
  size?: "sm" | "md" | "lg";
  /** The work stopped and needs attention. The fill turns the danger color. */
  error?: boolean;
  /** The work is on hold. The fill steps back to a quieter color. */
  paused?: boolean;
  /** Intl options for the displayed value. Without them it shows a whole percentage. */
  format?: Format;
  locale?: Intl.LocalesArgument;
  getAriaValueText?: (formattedValue: string, value: number | null) => string;
};

export function ProgressBar({
  value,
  min = 0,
  max = 100,
  label,
  description,
  showValue,
  buffer,
  segments,
  size = "md",
  error = false,
  paused = false,
  format,
  locale,
  getAriaValueText,
  className,
  ...rest
}: ProgressBarProps) {
  const reduce = useReducedMotion();
  const indeterminate = value === null || !Number.isFinite(value);
  const range = max - min || 1;
  const pct = indeterminate ? 0 : clamp01(((value as number) - min) / range) * 100;
  const bufferPct = buffer == null ? null : clamp01((buffer - min) / range) * 100;
  const complete = !indeterminate && pct >= 100 && !error;
  const withValue = showValue ?? label != null;
  const state = error ? "error" : paused ? "paused" : complete ? "complete" : indeterminate ? "indeterminate" : "progressing";

  // Remember where the fill came from, so segments can fill one after another
  // in the direction of travel. Adjusting state during render is React's
  // sanctioned way to derive from a changing prop.
  const [shown, setShown] = useState(pct);
  const [from, setFrom] = useState(pct);
  if (pct !== shown) {
    setFrom(shown);
    setShown(pct);
  }

  const fill = error ? "bg-danger" : paused ? "bg-fg-3" : "bg-fg";
  const suffix = error ? ", failed" : paused ? ", paused" : "";

  return (
    <Progress.Root
      value={indeterminate ? null : value}
      min={min}
      max={max}
      format={format}
      locale={locale}
      getAriaValueText={(formatted, v) => (getAriaValueText ? getAriaValueText(formatted, v) : `${formatted ?? "Loading"}${suffix}`)}
      data-state={state}
      data-size={size}
      className={cn("stealth-progress flex w-full min-w-0 flex-col gap-2", className)}
      {...rest}
    >
      <style href="stealth-progress-bar" precedence="default">
        {CSS}
      </style>

      {(label != null || withValue) && (
        <div className="flex h-[18px] min-w-0 items-center justify-between gap-3">
          {label != null ? <Progress.Label className="min-w-0 truncate text-[13px] leading-[18px] text-fg">{label}</Progress.Label> : <span />}
          {withValue && (
            <Progress.Value
              className={cn(
                "tabular grid h-[18px] shrink-0 items-center justify-items-end text-[12px] leading-[18px] transition-colors duration-200",
                error ? "text-danger" : paused ? "text-fg-3" : "text-fg-2",
              )}
            >
              {() => (
                // The number and the tick share one cell, so completing never shifts the row.
                <>
                  <span aria-hidden className="invisible col-start-1 row-start-1">100%</span>
                  <AnimatePresence initial={false}>
                    {complete ? (
                      <motion.span
                        key="done"
                        className="col-start-1 row-start-1 flex h-[18px] items-center text-success"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        transition={reduce ? { duration: 0.15 } : spring.pop}
                      >
                        <Tick reduce={!!reduce} />
                      </motion.span>
                    ) : indeterminate ? (
                      <span key="none" className="col-start-1 row-start-1" />
                    ) : (
                      <motion.span
                        key="value"
                        className="col-start-1 row-start-1"
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(2px)", transition: { duration: 0.12 } }}
                      >
                        <NumberFlow
                          value={format ? (value as number) : pct / 100}
                          format={format ?? { style: "percent", maximumFractionDigits: 0 }}
                          locales={locale}
                          animated={!reduce}
                          willChange
                        />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </Progress.Value>
          )}
        </div>
      )}

      {segments && segments > 1 && !indeterminate ? (
        <div className={cn("flex w-full gap-[3px]", HEIGHT[size])}>
          {Array.from({ length: segments }, (_, i) => {
            const f = clamp01((pct / 100) * segments - i);
            const start = (from / 100) * segments;
            const rising = pct >= from;
            // Steps fill in order, 90ms apart, and empty in reverse.
            const steps = rising ? Math.max(0, i - Math.floor(start)) : Math.max(0, Math.ceil(start) - 1 - i);
            return (
              <div key={i} className="relative h-full min-w-0 flex-1 overflow-hidden rounded-full bg-line-2">
                <div
                  className={cn("absolute inset-0 rounded-full transition-[transform,background-color] duration-[360ms] ease-out-quart motion-reduce:duration-0", fill)}
                  style={{ transform: `translateX(${(f - 1) * 100}%)`, transitionDelay: reduce ? "0ms" : `${steps * 90}ms` }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <Progress.Track className={cn("relative w-full overflow-hidden rounded-full bg-line-2", HEIGHT[size])}>
          {bufferPct != null && !indeterminate && (
            <div
              className="absolute inset-0 rounded-full bg-fg-4 transition-transform duration-500 ease-out-quart"
              style={{ transform: `translateX(${bufferPct - 100}%)` }}
            />
          )}
          {indeterminate ? (
            <Progress.Indicator data-part="sweep" className={cn("absolute inset-y-0 left-0 w-2/5 rounded-full", fill)} />
          ) : (
            // A full-width fill slid left keeps its rounded end at every value; scaling would squash it.
            <Progress.Indicator
              className={cn("absolute inset-y-0 left-0 rounded-full transition-[transform,background-color] duration-[480ms] ease-out-quart", fill)}
              style={{ width: "100%", transform: `translateX(${pct - 100}%)` }}
            />
          )}
        </Progress.Track>
      )}

      {description != null && (
        <div className={cn("min-w-0 text-[12px] leading-[18px] transition-colors duration-200", error ? "text-danger" : "text-fg-3")}>{description}</div>
      )}
    </Progress.Root>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }}
      />
    </svg>
  );
}
