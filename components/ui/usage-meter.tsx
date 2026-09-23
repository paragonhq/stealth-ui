"use client";
import { Meter } from "@base-ui/react/meter";
import NumberFlow from "@number-flow/react";
import { useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Alert, Warning } from "@/lib/icons";
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

export type UsageSegment = { label: string; value: number };
export type UsageState = "ok" | "warning" | "over";

/** Totals and state for a quota, for when the numbers drive something other than the bar. */
export function getUsage({ value, segments, max, warnAt = 0.8 }: { value?: number; segments?: UsageSegment[]; max: number; warnAt?: number }) {
  const used = segments ? segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) : Math.max(0, value ?? 0);
  const ratio = max > 0 ? used / max : 0;
  const state: UsageState = ratio > 1 ? "over" : ratio >= warnAt ? "warning" : "ok";
  return { used, ratio, state, remaining: Math.max(0, max - used), over: Math.max(0, used - max) };
}

// Categories step down the foreground ramp: nearest first, fading back.
const ramp = ["bg-fg", "bg-fg-2", "bg-fg-3", "bg-fg-4"];
const dots = ["bg-fg", "bg-fg-2", "bg-fg-3", "bg-fg-4"];

const expo = `cubic-bezier(${ease.out.join(",")})`;
const timing = {
  transformTiming: { duration: 600, easing: expo },
  spinTiming: { duration: 600, easing: expo },
  opacityTiming: { duration: 200, easing: "ease-out" },
};

export type UsageMeterProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What is being used: "Storage", "Seats", "API requests". */
  label: string;
  /** The quota. */
  max: number;
  /** Total used, when there are no categories. */
  value?: number;
  /** Used, split by category. Drawn in order; the total is their sum. */
  segments?: UsageSegment[];
  /** Short unit after the numbers: "GB", "seats". */
  unit?: string;
  /** Maximum fraction digits in the numbers. */
  decimals?: number;
  /** Share of the quota at which it turns to the warning state. */
  warnAt?: number;
  /** sm is a thin bar with the header only, for sidebars and table cells. */
  size?: "sm" | "md";
  /** Show the category legend. Defaults to on when there is more than one segment (md only). */
  legend?: boolean;
  /** First load: skeleton in the same shape. */
  loading?: boolean;
  /** Shown beside the status once it warns or goes over, e.g. an Upgrade button. */
  action?: React.ReactNode;
  locale?: string;
};

export function UsageMeter({
  label,
  max,
  value,
  segments: segmentsProp,
  unit,
  decimals = 1,
  warnAt = 0.8,
  size = "md",
  legend,
  loading = false,
  action,
  locale: localeProp,
  className,
  ...rest
}: UsageMeterProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const [hot, setHot] = useState<number | null>(null);
  const segments = segmentsProp ?? [{ label, value: value ?? 0 }];
  const single = !segmentsProp || segmentsProp.length === 1;
  const { used, ratio, state, remaining, over } = getUsage({ value, segments: segmentsProp, max, warnAt });
  const showLegend = size === "md" && (legend ?? !single);

  // Over the limit, the scale stretches to the total and a marker shows where the quota ends.
  const scale = Math.max(max, used) || 1;
  const limitAt = (max / scale) * 100;

  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: decimals });
  const withUnit = (n: number) => (unit ? `${fmt.format(n)} ${unit}` : fmt.format(n));
  const valueText =
    `${fmt.format(used)} of ${withUnit(max)} used, ${Math.round(ratio * 100)}%` +
    (state === "over" ? `, ${withUnit(over)} over the limit` : state === "warning" ? ", almost full" : "");

  const widths = segments.map((s) => (Math.max(0, s.value) / scale) * 100);
  const bars = segments.map((s, i) => ({ ...s, i, width: widths[i], start: widths.slice(0, i).reduce((a, b) => a + b, 0) }));
  const last = bars.findLastIndex((b) => b.width > 0);

  const status =
    state === "over" ? (
      <span className="flex items-center gap-1.5 text-danger">
        <Alert size={14} className="shrink-0" />
        {withUnit(over)} over the limit
      </span>
    ) : state === "warning" ? (
      <span className="flex items-center gap-1.5 text-warning">
        <Warning size={14} className="shrink-0" />
        Almost full · {withUnit(remaining)} left
      </span>
    ) : (
      <span className="text-fg-3">{withUnit(remaining)} left</span>
    );

  return (
    <Meter.Root
      value={Math.min(used, max)}
      max={max}
      aria-valuetext={loading ? "Loading" : valueText}
      aria-busy={loading || undefined}
      data-state={loading ? "loading" : state}
      data-size={size}
      className={cn("flex w-full min-w-0 flex-col", size === "sm" ? "gap-1.5" : "gap-2.5", className)}
      {...rest}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <Meter.Label className={cn("min-w-0 truncate text-fg", size === "sm" ? "text-[12px]" : "text-[13px] font-medium tracking-[-0.01em]")}>
          {label}
        </Meter.Label>
        {loading ? (
          <span aria-hidden className="h-3 w-20 self-center rounded-sm bg-hover motion-safe:animate-pulse-soft" />
        ) : (
          <span aria-hidden className={cn("flex shrink-0 items-baseline gap-1 whitespace-nowrap tabular", size === "sm" ? "text-[11.5px]" : "text-[12.5px]")}>
            <span
              className={cn(
                "inline-flex h-[1lh] items-center font-medium transition-colors duration-300",
                state === "over" ? "text-danger" : state === "warning" ? "text-warning" : "text-fg",
              )}
            >
              <NumberFlow value={used} locales={locale} format={{ maximumFractionDigits: decimals }} animated={!reduce} {...timing} />
            </span>
            <span className="text-fg-3">of {withUnit(max)}</span>
          </span>
        )}
      </div>

      <Meter.Track
        className={cn("relative w-full overflow-hidden rounded-full bg-fg/[0.08]", size === "sm" ? "h-1" : "h-2")}
        onPointerLeave={() => setHot(null)}
      >
        {!loading && (
          // The fill wipes in from the left on first paint, then each segment glides to its new place.
          <div className="absolute inset-0 transition-[clip-path] duration-[900ms] ease-out-expo [clip-path:inset(0_0_0_0)] starting:[clip-path:inset(0_100%_0_0)] motion-reduce:transition-none">
            {bars.map((b) => (
              <div
                key={b.label}
                onPointerEnter={() => setHot(b.i)}
                className={cn(
                  "absolute inset-y-0 transition-[left,width,opacity,background-color] duration-[600ms] ease-in-out-quart motion-reduce:transition-none",
                  single ? (state === "over" ? "bg-danger" : state === "warning" ? "bg-warning" : "bg-fg") : ramp[b.i % ramp.length],
                  hot != null && hot !== b.i && "opacity-30",
                )}
                style={{
                  left: `${b.start}%`,
                  // A 2px seam between categories, none after the last.
                  width: b.i === last || single ? `${b.width}%` : `max(0px, calc(${b.width}% - 2px))`,
                }}
              />
            ))}
            {state === "over" && (
              <div
                className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(-45deg,var(--danger)_0_2px,transparent_2px_5px)] opacity-90 transition-[left] duration-[600ms] ease-in-out-quart"
                style={{ left: `${limitAt}%` }}
              />
            )}
          </div>
        )}
        {loading && <div className="absolute inset-0 bg-hover motion-safe:animate-pulse-soft" />}
        {!loading && state === "over" && (
          <div aria-hidden className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-raised" style={{ left: `${limitAt}%` }} />
        )}
      </Meter.Track>

      {showLegend && (
        <ul aria-label={`${label} by category`} className="flex flex-wrap gap-x-4 gap-y-1.5" onPointerLeave={() => setHot(null)}>
          {bars.map((b) => (
            <li
              key={b.label}
              onPointerEnter={() => setHot(b.i)}
              className={cn("flex items-center gap-1.5 text-[12px] transition-opacity duration-150", hot != null && hot !== b.i && "opacity-45")}
            >
              <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", dots[b.i % dots.length])} />
              <span className="text-fg-2">{b.label}</span>
              <span className="text-fg-3 tabular">{loading ? "–" : withUnit(b.value)}</span>
            </li>
          ))}
        </ul>
      )}

      {size === "md" && !loading && (
        <div className="flex min-h-7 items-center justify-between gap-3 text-[12px]">
          <span role="status" className="min-w-0">
            {status}
          </span>
          {state !== "ok" && action}
        </div>
      )}
    </Meter.Root>
  );
}
