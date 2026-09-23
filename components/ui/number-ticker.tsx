"use client";
import NumberFlow, { type Format } from "@number-flow/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

const noop = () => () => {};

/** The reader's locale on the client, a fixed one on the server, so hydration always matches. */
export function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.NumberFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

export type NumberFormatShortcuts = {
  /** ISO 4217 code. Formats as money with the narrow symbol: "$", "€", "¥". */
  currency?: string;
  /** Short scale: 1.2K, 48.2M. One decimal at most. */
  compact?: boolean;
  /** Fixed fraction digits, so a value never jumps between "4.1" and "4.10". */
  decimals?: number;
  /** Any Intl.NumberFormat option, applied last. Scientific notation isn't supported. */
  format?: Format;
};

/** Turns the shortcuts into one Intl options object. Shared by every number in the data category. */
export function numberFormatOptions({ currency, compact, decimals, format }: NumberFormatShortcuts): Format {
  return {
    ...(currency ? { style: "currency", currency, currencyDisplay: "narrowSymbol" } : null),
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : null),
    ...(decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : null),
    ...format,
  };
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
// Everyday changes settle in 600ms; the first count-up from `from` is given longer to travel.
const timing = (ms: number) => ({
  transformTiming: { duration: ms, easing: expo },
  spinTiming: { duration: ms, easing: expo },
  opacityTiming: { duration: 240, easing: "ease-out" },
});

export type NumberTickerProps = Omit<React.ComponentProps<"span">, "children" | "prefix"> &
  NumberFormatShortcuts & {
    value: number;
    /** BCP 47 tag. Defaults to the reader's locale. */
    locale?: string;
    /** Text that sits inside the number and moves with it: "~", "+". */
    prefix?: string;
    suffix?: string;
    /** Which way digits roll. "auto" rolls up when the value rises and down when it falls. */
    direction?: "auto" | "up" | "down";
    /** Tint the digits success or danger for a moment after each change. */
    flash?: boolean;
    /** For values where down is good (latency, churn, cost): falling flashes success. */
    inverse?: boolean;
    /** Shown until the number first scrolls into view, then it counts to `value`, once. */
    from?: number;
    /** Set false to swap digits without rolling. Reduced motion does this on its own. */
    animated?: boolean;
  };

export function NumberTicker({
  value,
  locale: localeProp,
  currency,
  compact,
  decimals,
  format,
  prefix,
  suffix,
  direction = "auto",
  flash = false,
  inverse = false,
  from,
  animated = true,
  className,
  ref,
  ...rest
}: NumberTickerProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [seen, setSeen] = useState(from == null);
  const [finished, setFinished] = useState(false);
  const prev = useRef<number | null>(null);
  const node = useRef<HTMLSpanElement | null>(null);

  const setRefs = useCallback(
    (n: HTMLSpanElement | null) => {
      node.current = n;
      setEl(n);
      if (typeof ref === "function") ref(n);
      else if (ref) ref.current = n;
    },
    [ref],
  );

  // Count up once, the first time at least half of it is on screen.
  useEffect(() => {
    if (seen || !el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);

  const shown = seen ? value : (from ?? value);
  const rolls = animated && !reduce;
  // The count-up is over once it has landed, or at once when there's nothing to roll.
  const counted = from == null || (seen && (finished || !rolls || from === value));

  // The tint rides on the Web Animations API so a new change restarts it from
  // where it is, and nothing re-renders to fade it out.
  useEffect(() => {
    const last = prev.current;
    prev.current = shown;
    const target = node.current;
    if (last == null || last === shown || !target) return;
    const up = shown > last;
    target.dataset.trend = up ? "up" : "down";
    if (!flash || !counted) return;
    const good = inverse ? !up : up;
    const tint = `var(--${good ? "success" : "danger"})`;
    for (const a of target.getAnimations()) if (a.id === "ticker-tint") a.cancel();
    // No final keyframe: the color eases back to whatever the text inherits.
    const anim = target.animate(
      [
        { color: tint, offset: 0 },
        { color: tint, offset: 0.35 },
      ],
      { duration: 1400, easing: "ease-out" },
    );
    anim.id = "ticker-tint";
  }, [shown, flash, inverse, counted]);

  const trend = direction === "up" ? 1 : direction === "down" ? -1 : undefined;

  return (
    <span
      ref={setRefs}
      data-slot="number-ticker"
      data-counting={!counted || undefined}
      className={cn("inline-flex whitespace-nowrap tabular", className)}
      {...rest}
    >
      <NumberFlow
        value={shown}
        locales={locale}
        format={numberFormatOptions({ currency, compact, decimals, format })}
        prefix={prefix}
        suffix={suffix}
        trend={trend}
        animated={rolls}
        onAnimationsFinish={() => {
          if (seen && !finished) setFinished(true);
        }}
        {...timing(counted ? 600 : 1100)}
      />
    </span>
  );
}
