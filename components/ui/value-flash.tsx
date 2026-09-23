"use client";
import NumberFlow, { type Format } from "@number-flow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.NumberFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

// Three flashes a second is the ceiling for anything that blinks (WCAG 2.3.1).
const MIN_GAP = 334;

export type ThrottledValue = {
  /** The value to show: the latest one, at most once per interval. */
  value: number | null;
  /** 1 if the last shown change went up, -1 down, 0 before any change. */
  direction: 1 | -1 | 0;
  /** Increments on every shown change. Key effects on it. */
  tick: number;
};

/**
 * Lets a firehose of updates through at most once per `interval`, always
 * landing on the latest value, and reports which way each shown change went.
 */
export function useThrottledValue(value: number | null, interval = 400): ThrottledValue {
  const [state, setState] = useState<ThrottledValue>({ value, direction: 0, tick: 0 });
  const last = useRef(0);
  const timer = useRef<number>(undefined);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
    if (timer.current !== undefined) return; // a trailing update is already queued and will read `latest`
    const wait = Math.max(0, last.current + interval - performance.now());
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      last.current = performance.now();
      const next = latest.current;
      setState((prev) => {
        if (Object.is(prev.value, next)) return prev;
        const direction = prev.value == null || next == null ? 0 : next > prev.value ? 1 : -1;
        return { value: next, direction, tick: prev.tick + 1 };
      });
    }, wait);
  }, [value, interval]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    },
    [],
  );
  return state;
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
// Short: a live number that takes longer to settle than the gap between updates is always moving.
const timing = {
  transformTiming: { duration: 380, easing: expo },
  spinTiming: { duration: 380, easing: expo },
  opacityTiming: { duration: 160, easing: "ease-out" },
};

export type ValueFlashProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The live value. null shows a dash while the first one loads. */
  value: number | null;
  /** ISO 4217 code for prices. */
  currency?: string;
  /** Fixed fraction digits, so ticks never change the width: 4 for FX, 2 for most prices. */
  decimals?: number;
  compact?: boolean;
  format?: Format;
  locale?: string;
  /** Minimum milliseconds between shown updates. Never below 334, so it can't flash more than three times a second. */
  throttle?: number;
  /** For values where down is good (latency, spread, cost). */
  inverse?: boolean;
  /** flash: the arrow shows with the wash and leaves. last: it stays, quiet, pointing the way of the last tick. */
  arrow?: "flash" | "last" | "none";
  /** The feed has stopped or fallen behind: dim, stop flashing, keep the last value. */
  stale?: boolean;
  size?: "sm" | "md";
};

export function ValueFlash({
  value,
  currency,
  decimals,
  compact,
  format,
  locale: localeProp,
  throttle = 400,
  inverse = false,
  arrow = "flash",
  stale = false,
  size = "md",
  className,
  ...rest
}: ValueFlashProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const { value: shown, direction, tick } = useThrottledValue(value, Math.max(throttle, MIN_GAP));
  const wash = useRef<HTMLSpanElement>(null);
  const glyph = useRef<HTMLSpanElement>(null);

  // Wash and arrow ride on the Web Animations API: a new tick cancels the last
  // one where it stands and restarts, with no re-render to fade them out.
  useEffect(() => {
    const box = wash.current;
    const mark = glyph.current;
    if (!tick || !direction || stale || !box) return;
    const good = direction > 0 !== inverse;
    const tone = good ? "success" : "danger";
    const opts = { duration: 1100, easing: "ease-out", id: "value-flash" } as const;
    for (const el of [box, mark]) el?.getAnimations().forEach((a) => a.id === "value-flash" && a.cancel());
    box.animate(
      [
        { backgroundColor: `var(--${tone}-soft)`, color: `var(--${tone})`, offset: 0 },
        { backgroundColor: `var(--${tone}-soft)`, color: `var(--${tone})`, offset: 0.4 },
      ],
      opts,
    );
    if (!mark || arrow === "none") return;
    const nudge = reduce ? "none" : `translateY(${direction > 0 ? 3 : -3}px)`;
    mark.animate(
      arrow === "flash"
        ? [
            { opacity: 0, transform: nudge, color: `var(--${tone})`, offset: 0 },
            { opacity: 1, transform: "none", color: `var(--${tone})`, offset: 0.14 },
            { opacity: 1, transform: "none", color: `var(--${tone})`, offset: 0.55 },
            { opacity: 0, transform: "none", offset: 1 },
          ]
        : [
            { opacity: 0, transform: nudge, color: `var(--${tone})`, offset: 0 },
            { opacity: 1, transform: "none", color: `var(--${tone})`, offset: 0.14 },
            { color: `var(--${tone})`, offset: 0.4 },
          ],
      opts,
    );
  }, [tick, direction, stale, inverse, arrow, reduce]);

  const options: Format = {
    ...(currency ? { style: "currency", currency, currencyDisplay: "narrowSymbol" } : null),
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : null),
    ...(decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : null),
    ...format,
  };
  const trend = direction > 0 ? "up" : direction < 0 ? "down" : "none";

  return (
    <span
      data-slot="value-flash"
      data-trend={trend}
      data-stale={stale || undefined}
      data-size={size}
      className={cn(
        "inline-flex items-center whitespace-nowrap font-medium tabular",
        size === "sm" ? "gap-1.5 text-[12.5px]" : "gap-2 text-[13px]",
        stale ? "text-fg-3" : "text-fg",
        "transition-colors duration-300",
        className,
      )}
      {...rest}
    >
      <span ref={wash} className={cn("inline-flex items-center rounded-[5px]", size === "sm" ? "-mx-1 h-5 px-1" : "-mx-1.5 h-6 px-1.5")}>
        {shown == null ? (
          <span className="text-fg-4">—</span>
        ) : (
          <NumberFlow value={shown} locales={locale} format={options} animated={!reduce && !stale} {...timing} />
        )}
      </span>
      {arrow !== "none" && (
        // The slot is always there, so the arrow arriving never pushes anything.
        <span
          ref={glyph}
          aria-hidden
          className={cn("grid size-3 shrink-0 place-items-center text-fg-3", (arrow === "flash" || !direction || stale) && "opacity-0")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={cn(direction < 0 && "rotate-180")}>
            <path d="M5 2 8.5 7.5h-7z" />
          </svg>
        </span>
      )}
      <span className="sr-only">{stale ? ", delayed" : trend === "up" ? ", rising" : trend === "down" ? ", falling" : ""}</span>
    </span>
  );
}
