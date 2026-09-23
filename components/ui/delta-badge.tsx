"use client";
import NumberFlow, { type Format } from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.NumberFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

export type DeltaTrend = "up" | "down" | "flat" | "none";
export type DeltaTone = "good" | "bad" | "neutral";

/**
 * Where a change points and whether that's good, judged on the number as it
 * will be shown: +0.04% rounds to 0% and reads as flat, not as a green 0%.
 */
export function getDelta(value: number | null | undefined, { decimals = 1, inverse = false }: { decimals?: number; inverse?: boolean } = {}) {
  if (value == null || !Number.isFinite(value)) return { trend: "none" as DeltaTrend, tone: "neutral" as DeltaTone };
  const f = 10 ** decimals;
  const rounded = Math.round(Math.abs(value) * f) / f;
  if (rounded === 0) return { trend: "flat" as DeltaTrend, tone: "neutral" as DeltaTone };
  const up = value > 0;
  return { trend: (up ? "up" : "down") as DeltaTrend, tone: (up !== inverse ? "good" : "bad") as DeltaTone };
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
const timing = {
  transformTiming: { duration: 550, easing: expo },
  spinTiming: { duration: 550, easing: expo },
  opacityTiming: { duration: 200, easing: "ease-out" },
};

// One arrow, turned: ↗ up, → flat, ↘ down. A flip reads as the same arrow changing its mind.
const rotation: Record<DeltaTrend, number> = { up: -45, flat: 0, down: 45, none: 0 };

export type DeltaBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The change. Percentage points by default (12.4 shows +12.4%). null, NaN or Infinity shows a dash. */
  value: number | null | undefined;
  /** percent shows 12.4 as +12.4%; number shows the raw change, formatted with `format`. */
  unit?: "percent" | "number";
  /** Fraction digits shown, and the precision below which a change counts as flat. */
  decimals?: number;
  /** Extra Intl options for unit="number", e.g. currency. */
  format?: Format;
  /** For latency, churn or cost: a fall is good news and turns green. */
  inverse?: boolean;
  /** Tinted pill, or colored text only for tables and running copy. */
  variant?: "soft" | "plain";
  size?: "sm" | "md";
  locale?: string;
  /** Shown when there's nothing to compare against (no prior period, or it was zero). */
  emptyLabel?: string;
};

export function DeltaBadge({
  value,
  unit = "percent",
  decimals = 1,
  format,
  inverse = false,
  variant = "soft",
  size = "md",
  locale: localeProp,
  emptyLabel = "–",
  className,
  ...rest
}: DeltaBadgeProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const { trend, tone } = getDelta(value, { decimals, inverse });
  const magnitude = trend === "none" ? 0 : Math.abs(value as number);

  // The sign is drawn by us (a true minus, not a hyphen) so Intl only formats the magnitude.
  const options: Format = {
    ...(unit === "percent" ? { style: "percent" } : null),
    minimumFractionDigits: unit === "percent" ? decimals : 0,
    maximumFractionDigits: decimals,
    ...format,
    signDisplay: "never",
  };
  const shown = unit === "percent" ? magnitude / 100 : magnitude;
  const sign = trend === "up" ? "+" : trend === "down" ? "−" : "";
  const text = new Intl.NumberFormat(locale, options).format(shown);
  const spoken = trend === "none" ? "No comparison" : trend === "flat" ? `No change, ${text}` : `${trend === "up" ? "Up" : "Down"} ${text}`;

  return (
    <span
      data-slot="delta-badge"
      data-trend={trend}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap font-medium tabular transition-[background-color,color] duration-300 ease-out",
        size === "sm" ? "gap-0.5 text-[11px]" : "gap-1 text-[12px]",
        variant === "soft" && (size === "sm" ? "h-[18px] rounded-full pl-1 pr-1.5" : "h-[22px] rounded-full pl-1.5 pr-2"),
        tone === "good" && "text-success",
        tone === "bad" && "text-danger",
        tone === "neutral" && "text-fg-3",
        variant === "soft" && tone === "good" && "bg-success-soft",
        variant === "soft" && tone === "bad" && "bg-danger-soft",
        variant === "soft" && tone === "neutral" && "bg-fg/[0.06]",
        className,
      )}
      {...rest}
    >
      {trend !== "none" && (
        <span aria-hidden className="grid size-3 shrink-0 place-items-center">
          <motion.svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ rotate: rotation[trend] }}
            transition={reduce ? { duration: 0 } : spring.snappy}
          >
            <path d="M2.5 6h7M6.5 3l3 3-3 3" />
          </motion.svg>
        </span>
      )}
      <span aria-hidden className="inline-flex h-[1lh] items-center">
        {trend === "none" ? (
          <span className="px-1">{emptyLabel}</span>
        ) : (
          <NumberFlow value={shown} locales={locale} format={options} prefix={sign} animated={!reduce} {...timing} />
        )}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
