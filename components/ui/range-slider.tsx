"use client";
import { NumberField } from "@base-ui/react/number-field";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

type Range = [number, number];

export type RangeSliderProps = Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "value" | "defaultValue" | "onValueChange" | "onValueCommitted" | "children" | "className" | "render" | "largeStep" | "minStepsBetweenValues"
> & {
  value?: Range;
  defaultValue?: Range;
  onValueChange?: (value: Range) => void;
  /** Once per gesture: a drag released, a key pressed, the track pressed or an input committed. */
  onValueCommitted?: (value: Range) => void;
  /** Visible label for the whole range. Without one, pass aria-label. */
  label?: ReactNode;
  /** The smallest gap the two ends may have, in value units. Defaults to one step. */
  minDistance?: number;
  largeStep?: number;
  /** Min and max fields under the track that stay in sync with the thumbs. */
  inputs?: boolean;
  /** Names for the two ends: the field labels and each thumb's accessible name. */
  endLabels?: [string, string];
  /** Text for the floating labels and aria-valuetext. Falls back to Intl.NumberFormat with format and locale. */
  formatValue?: (value: number) => string;
  className?: string;
};

const pct = (v: number, min: number, max: number) => ((v - min) / (max - min)) * 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, step: number, min: number) => Number((Math.round((v - min) / step) * step + min).toFixed(10));

/** Pixel widths of the track and the three floating labels, kept current by one observer. */
function useWidths() {
  const track = useRef<HTMLDivElement>(null);
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const both = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState({ track: 0, a: 0, b: 0, both: 0 });
  useEffect(() => {
    const els = [track.current, a.current, b.current, both.current];
    if (els.some((el) => !el)) return;
    // Border-box widths, read in the observer callback so render stays pure.
    const ro = new ResizeObserver(() => setW({ track: els[0]!.offsetWidth, a: els[1]!.offsetWidth, b: els[2]!.offsetWidth, both: els[3]!.offsetWidth }));
    els.forEach((el) => ro.observe(el!));
    return () => ro.disconnect();
  }, []);
  return { trackRef: track, aRef: a, bRef: b, bothRef: both, w };
}

export function RangeSlider({
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommitted,
  label,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  minDistance,
  inputs = true,
  endLabels = ["Minimum", "Maximum"],
  formatValue,
  format,
  locale,
  disabled,
  className,
  "aria-label": ariaLabel,
  ...rest
}: RangeSliderProps) {
  const [value, setValue] = useControllableState<Range>({ value: valueProp, defaultValue: defaultValue ?? [min, max], onChange: onValueChange });
  const [motion, setMotion] = useState<"glide" | "instant">("glide");
  const [focused, setFocused] = useState<number | null>(null);
  const { trackRef, aRef, bRef, bothRef, w } = useWidths();
  const id = useId();
  const gap = Math.max(minDistance ?? step, step);

  const fmt = useMemo(() => {
    if (formatValue) return formatValue;
    const nf = new Intl.NumberFormat(locale, format);
    return (v: number) => nf.format(v);
  }, [formatValue, format, locale]);

  const [lo, hi] = value;
  const pa = pct(lo, min, max);
  const pb = pct(hi, min, max);

  // Once the two labels would touch, they give way to a single "a – b" label.
  const measured = w.track > 0;
  const merged = measured && ((pb - pa) / 100) * w.track < (w.a + w.b) / 2 + 8;
  // Labels follow their thumb but never hang past the ends of the track.
  const place = (p: number, width: number) => clamp((p / 100) * w.track, width / 2, w.track - width / 2) - width / 2;
  const at = (p: number, width: number) => (measured ? { left: place(p, width) } : { left: `${p}%`, translate: "-50% 0" });

  const commitEnd = (i: 0 | 1, typed: number | null) => {
    if (typed == null || Number.isNaN(typed)) return;
    const v = snap(typed, step, min);
    const next: Range = i === 0 ? [clamp(v, min, hi - gap), hi] : [lo, clamp(v, lo + gap, max)];
    setMotion("glide");
    setValue(next);
    onValueCommitted?.(next);
  };

  return (
    <div className={cn("group/range flex w-full flex-col gap-2", disabled && "opacity-50", className)}>
      <BaseSlider.Root
        value={value}
        min={min}
        max={max}
        step={step}
        largeStep={largeStep ?? step * 10}
        minStepsBetweenValues={Math.round(gap / step)}
        thumbCollisionBehavior="none"
        format={format}
        locale={locale}
        disabled={disabled}
        onValueChange={(next, details) => {
          setMotion(details.reason === "track-press" ? "glide" : "instant");
          setValue(next as Range);
        }}
        onValueCommitted={(next, details) => {
          if (details.reason === "drag") setMotion("glide");
          onValueCommitted?.(next as Range);
        }}
        data-motion={motion}
        className="group/slider flex flex-col gap-1.5"
        {...rest}
      >
        {label != null && <BaseSlider.Label className="text-[12.5px] font-medium tracking-[-0.005em] text-fg">{label}</BaseSlider.Label>}

        {/* Floating value labels. Decorative: each thumb announces its own value. */}
        <div aria-hidden className="relative h-4 text-[12px] leading-4 tabular">
          {([0, 1] as const).map((i) => (
            <span
              key={i}
              ref={i === 0 ? aRef : bRef}
              suppressHydrationWarning
              data-active={focused === i || undefined}
              className={cn(
                "absolute top-0 whitespace-nowrap text-fg-2 data-active:text-fg",
                "transition-[opacity,translate,color] duration-150 ease-out-expo",
                "group-data-[motion=glide]/slider:transition-[opacity,translate,color,left]",
                merged && "opacity-0",
              )}
              style={{ ...at(i === 0 ? pa : pb, i === 0 ? w.a : w.b), ...(merged && measured ? { translate: `${i === 0 ? 6 : -6}px 0` } : null) }}
            >
              {fmt(value[i])}
            </span>
          ))}
          <span
            ref={bothRef}
            suppressHydrationWarning
            data-active={focused != null || undefined}
            className={cn(
              "absolute top-0 whitespace-nowrap text-fg-2 data-active:text-fg",
              "transition-[opacity,scale,color] duration-150 ease-out-expo motion-reduce:scale-100",
              "group-data-[motion=glide]/slider:transition-[opacity,scale,color,left]",
              merged ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
            )}
            style={at((pa + pb) / 2, w.both)}
          >
            {fmt(lo)} – {fmt(hi)}
          </span>
        </div>

        <BaseSlider.Control className="group/control relative flex h-6 cursor-pointer touch-none select-none items-center group-data-disabled/slider:pointer-events-none">
          <BaseSlider.Track ref={trackRef} className="relative h-1 w-full rounded-full bg-fg/10 transition-colors duration-150 group-hover/control:bg-fg/14">
            <div
              aria-hidden
              className="absolute inset-y-0 rounded-full bg-fg group-data-[motion=glide]/slider:transition-[left,width] group-data-[motion=glide]/slider:duration-200 group-data-[motion=glide]/slider:ease-out-expo"
              style={{ left: `${pa}%`, width: `${pb - pa}%` }}
            />
            {([0, 1] as const).map((i) => (
              <BaseSlider.Thumb
                key={i}
                index={i}
                aria-label={ariaLabel ? `${ariaLabel}, ${endLabels[i].toLowerCase()}` : endLabels[i]}
                getAriaValueText={(_, v) => fmt(v)}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused((f) => (f === i ? null : f))}
                className={(state) =>
                  cn(
                    "group/thumb size-4 outline-none",
                    "before:absolute before:-inset-3.5 before:content-['']",
                    "group-data-[motion=glide]/slider:transition-[inset-inline-start] group-data-[motion=glide]/slider:duration-200 group-data-[motion=glide]/slider:ease-out-expo",
                    state.dragging && state.activeThumbIndex === i && "grabbed",
                  )
                }
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-full bg-fg shadow-[var(--shadow)]",
                    "outline-offset-2 group-has-focus-visible/thumb:outline-1 group-has-focus-visible/thumb:outline-solid group-has-focus-visible/thumb:outline-fg-3",
                    "transition-[scale,box-shadow] duration-150 ease-out-expo motion-reduce:transition-none",
                    "group-hover/thumb:scale-110 group-[.grabbed]/thumb:scale-125 group-[.grabbed]/thumb:ring-4 group-[.grabbed]/thumb:ring-fg/10",
                  )}
                />
              </BaseSlider.Thumb>
            ))}
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>

      {inputs && (
        <div className="mt-1.5 flex items-end gap-2">
          {([0, 1] as const).map((i) => (
            <RangeInput
              key={i}
              id={`${id}-${i}`}
              label={endLabels[i]}
              value={value[i]}
              min={i === 0 ? min : lo + gap}
              max={i === 0 ? hi - gap : max}
              step={step}
              format={format}
              locale={locale}
              disabled={disabled}
              onCommit={(v) => commitEnd(i, v)}
              separator={i === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// One end as a text field. Typing keeps a local draft so a half-typed number
// never drags the thumb around; the range only changes on Enter, blur, arrows or wheel.
function RangeInput({
  id,
  label,
  value,
  onCommit,
  separator,
  ...field
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (v: number | null) => void;
  separator: boolean;
  min: number;
  max: number;
  step: number;
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  return (
    <>
      {separator && (
        <span aria-hidden className="mb-2 text-fg-4">
          –
        </span>
      )}
      <NumberField.Root
        id={id}
        value={draft === undefined ? value : draft}
        onValueChange={(v) => setDraft(v)}
        onValueCommitted={(v) => {
          setDraft(undefined);
          onCommit(v);
        }}
        allowWheelScrub
        className="flex min-w-0 flex-1 flex-col gap-1.5"
        {...field}
      >
        <label htmlFor={id} className="text-[11px] text-fg-3">
          {label}
        </label>
        <NumberField.Group
          className={cn(
            "flex h-8 items-center rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)]",
            "transition-[border-color,box-shadow] duration-150 hover:border-fg-4",
            "focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10",
          )}
        >
          <NumberField.Input
            suppressHydrationWarning
            className="h-full w-full min-w-0 bg-transparent px-2.5 text-base text-fg tabular outline-none sm:text-[13px]"
          />
        </NumberField.Group>
      </NumberField.Root>
    </>
  );
}
