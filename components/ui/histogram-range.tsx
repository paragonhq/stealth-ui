"use client";
import { NumberField } from "@base-ui/react/number-field";
import { Slider } from "@base-ui/react/slider";
import { useReducedMotion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

export type Range = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Buckets raw values into `bins` equal-width counts across [min, max]. Values past max land in the last bin. */
export function binValues(data: number[], min: number, max: number, bins: number) {
  const counts = new Array<number>(bins).fill(0);
  const width = (max - min) / bins;
  for (const v of data) {
    if (v < min) continue;
    counts[Math.min(bins - 1, Math.floor((v - min) / width))]++;
  }
  return counts;
}

/** How many values fall inside a range: exact for raw data, prorated across partial bins for counts. */
export function countInRange({ data, counts, min, max }: { data?: number[]; counts?: number[]; min: number; max: number }, [lo, hi]: Range) {
  if (data) return data.filter((v) => v >= lo && (v <= hi || (hi >= max && v > max))).length;
  if (!counts?.length) return 0;
  const width = (max - min) / counts.length;
  return Math.round(
    counts.reduce((sum, c, i) => {
      const a = min + i * width;
      const overlap = Math.max(0, Math.min(hi, a + width) - Math.max(lo, a));
      return sum + c * (overlap / width);
    }, 0),
  );
}

export type HistogramRangeProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** Raw values (every listing's price). Binned for you. */
  data?: number[];
  /** Or counts you already binned on the server, evenly spread across [min, max]. */
  counts?: number[];
  min: number;
  max: number;
  step?: number;
  /** Bars drawn when binning raw data. */
  bins?: number;
  value?: Range;
  defaultValue?: Range;
  /** Fires continuously while dragging and when an input commits. */
  onValueChange?: (value: Range) => void;
  /** Fires on release, key press or input commit: the moment to refetch. */
  onValueCommitted?: (value: Range) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Formats the inputs and spoken values. Defaults to whole US dollars. */
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  /** The top of the range means "and above": the max field says "and up" and is spoken as "or more". */
  openEnded?: boolean;
  /** Accessible names for the two thumbs. */
  thumbLabels?: [string, string];
  disabled?: boolean;
  /** Keeps the space and dims the bars while new counts load. */
  loading?: boolean;
};

const USD: Intl.NumberFormatOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };

export function HistogramRange({
  data,
  counts: countsProp,
  min,
  max,
  step = 1,
  bins = 40,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommitted,
  label = "Price range",
  description,
  format = USD,
  locale,
  openEnded = false,
  thumbLabels = ["Minimum price", "Maximum price"],
  disabled = false,
  loading = false,
  className,
  ...rest
}: HistogramRangeProps) {
  const [value, setValue] = useControllableState<Range>({ value: valueProp, defaultValue: defaultValue ?? [min, max], onChange: onValueChange });
  const reduce = useReducedMotion();
  const id = useId();
  // Thumbs, fill and highlight glide only when a typed value moves them; drags and keys stay 1:1.
  const [glide, setGlide] = useState(false);

  const counts = useMemo(() => countsProp ?? binValues(data ?? [], min, max, bins), [countsProp, data, min, max, bins]);
  const peak = Math.max(1, ...counts);
  const [lo, hi] = value;
  const pct = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;
  const fmt = useMemo(() => new Intl.NumberFormat(locale, format), [locale, format]);
  const spoken = (v: number) => `${fmt.format(v)}${openEnded && v >= max ? " or more" : ""}`;

  const commit = (next: Range, typed: boolean) => {
    setGlide(typed && !reduce);
    setValue(next);
    onValueCommitted?.(next);
  };

  // The lit copy of the bars is clipped to the selected range, so the cut
  // between in and out sits exactly under each thumb, mid-bar if need be.
  const clip = `inset(0 ${100 - pct(hi)}% 0 ${pct(lo)}%)`;
  const glideClass = glide ? "transition-[clip-path,inset-inline-start,left,width] duration-200 ease-in-out-quart" : "";

  const bars = (lit: boolean) => (
    <div
      aria-hidden
      className={cn("absolute inset-0 flex items-end gap-px", lit && glideClass)}
      style={lit ? { clipPath: clip } : undefined}
    >
      {counts.map((c, i) => (
        <span
          key={i}
          style={{ height: `${c ? Math.max(4, (c / peak) * 100) : 0}%` }}
          className={cn(
            "min-w-0 flex-1 origin-bottom rounded-t-[2px]",
            "transition-[height] duration-300 ease-out-quart motion-reduce:transition-none",
            lit ? "bg-fg" : "bg-fg-4",
          )}
        />
      ))}
    </div>
  );

  // Typed values clamp against the other end, keeping one step between them like the thumbs do.
  const settleTyped = (index: 0 | 1, n: number | null) => {
    if (n === null) return commit(value, true);
    const next: Range = index === 0 ? [clamp(n, min, hi - step), hi] : [lo, clamp(n, lo + step, max)];
    commit(next, true);
  };

  const field = (index: 0 | 1) => {
    const v = value[index];
    const name = index === 0 ? "Minimum" : "Maximum";
    const upId = `${id}-up`;
    return (
      <NumberField.Root
        value={v}
        min={index === 0 ? min : lo + step}
        max={index === 0 ? hi - step : max}
        step={step}
        largeStep={step * 10}
        format={format}
        locale={locale}
        disabled={disabled}
        onValueChange={(n, details) => {
          // Typing waits for Enter or blur; arrow keys and steppers apply at once.
          if (details.reason.startsWith("input") || n === null) return;
          const next: Range = index === 0 ? [n, hi] : [lo, n];
          setGlide(false);
          setValue(next);
        }}
        onValueCommitted={(n) => settleTyped(index, n)}
        className="min-w-0 flex-1"
      >
        <label htmlFor={`${id}-${index}`} className="mb-1 block text-[11.5px] text-fg-3">
          {name}
        </label>
        <NumberField.Group
          className={cn(
            "flex h-8 items-center rounded-lg border border-line-2 bg-raised px-2.5 transition-[border-color,box-shadow] duration-150",
            "focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10",
            "data-[disabled]:opacity-50",
          )}
        >
          <NumberField.Input
            id={`${id}-${index}`}
            aria-describedby={index === 1 && openEnded && v >= max ? upId : undefined}
            onKeyDown={(e) => {
              // Enter commits like blur does (format, clamp, move the thumb) and keeps focus here.
              if (e.key === "Enter") {
                const el = e.currentTarget;
                el.blur();
                el.focus();
              }
            }}
            className="tabular w-full min-w-0 bg-transparent text-base text-fg outline-none sm:text-[13px]"
          />
          {index === 1 && openEnded && v >= max && (
            <span id={upId} className="shrink-0 text-[12px] text-fg-3">
              and up
            </span>
          )}
        </NumberField.Group>
      </NumberField.Root>
    );
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-busy={loading || undefined}
      data-disabled={disabled || undefined}
      className={cn("flex w-full flex-col", disabled && "opacity-60", className)}
      {...rest}
    >
      <div className="mb-3">
        <p id={`${id}-label`} className="text-[13px] font-medium tracking-[-0.01em] text-fg">
          {label}
        </p>
        {description && <p className="mt-0.5 text-[12px] text-fg-3">{description}</p>}
      </div>

      {/* Bars and track share one box, so bar edges and thumb positions agree. */}
      <div className={cn("relative h-16 transition-opacity duration-200", loading && "animate-pulse-soft opacity-60")}>
        {bars(false)}
        {bars(true)}
      </div>

      <Slider.Root
        value={value}
        min={min}
        max={max}
        step={step}
        largeStep={step * 10}
        minStepsBetweenValues={1}
        thumbCollisionBehavior="none"
        disabled={disabled}
        format={format}
        locale={locale}
        onValueChange={(v) => {
          setGlide(false);
          setValue(v as Range);
        }}
        onValueCommitted={(v) => {
          onValueCommitted?.(v as Range);
        }}
        className="group/range"
      >
        <Slider.Control
          // Pulled up so the track is the baseline the bars stand on.
          className={cn("relative -mt-[11px] flex h-6 touch-none items-center select-none [@media(pointer:coarse)]:-mt-[21px] [@media(pointer:coarse)]:h-11", !disabled && "cursor-pointer")}
        >
          <Slider.Track className="relative h-0.5 w-full rounded-full bg-line-2">
            <Slider.Indicator className={cn("rounded-full bg-fg", glideClass)} />
            {[0, 1].map((i) => (
              <Slider.Thumb
                key={i}
                index={i}
                aria-label={thumbLabels[i]}
                getAriaValueText={(_, v) => spoken(v)}
                className={cn(
                  // A foreground puck with a surface-colored rim, so it reads in both themes and cuts the track cleanly.
                  "size-[18px] rounded-full border-[3px] border-raised bg-fg shadow-[var(--shadow)]",
                  "transition-[scale] duration-150 ease-out hover:scale-[1.08]",
                  // The thumb in hand grows a touch and firms its edge.
                  "data-[dragging]:scale-[1.15] motion-reduce:data-[dragging]:scale-100 motion-reduce:hover:scale-100",
                  "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-3",
                  "[@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-3.5",
                  glideClass,
                )}
              />
            ))}
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="mt-3 flex items-end gap-2">
        {field(0)}
        <span aria-hidden className="pb-2 text-[13px] text-fg-4">
          –
        </span>
        {field(1)}
      </div>
    </div>
  );
}
