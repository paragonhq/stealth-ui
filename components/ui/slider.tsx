"use client";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md" | "lg";
export type SliderMark = number | { value: number; label?: ReactNode };

export type SliderProps = Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "value" | "defaultValue" | "onValueChange" | "onValueCommitted" | "children" | "className" | "render" | "largeStep" | "orientation" | "thumbAlignment"
> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Fires once when a drag ends, a key is released or the track is pressed. Save here, not on every change. */
  onValueCommitted?: (value: number) => void;
  /** Visible label above the track. Without one, pass aria-label. */
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
  /** Step taken with Shift+Arrow and Page Up/Down. Defaults to 10 steps. */
  largeStep?: number;
  /** Dots on the track; give them a label to print it underneath (pressing a label jumps there). */
  marks?: SliderMark[];
  /** The value bubble over the thumb: while dragging or keyboard focused, always, or never. */
  tooltip?: "auto" | "always" | "never";
  /** Turns the number into the text shown in the readout, the bubble and to screen readers. */
  formatValue?: (value: number) => string;
  size?: Size;
  className?: string;
};

// Track thickness, thumb diameter and control height per size. The control is
// taller than the track so the whole band is a comfortable press target.
const sizes: Record<Size, { control: string; track: string; thumb: string }> = {
  sm: { control: "h-5", track: "h-1", thumb: "size-3" },
  md: { control: "h-6", track: "h-1", thumb: "size-4" },
  lg: { control: "h-7", track: "h-1.5", thumb: "size-5" },
};

const pct = (v: number, min: number, max: number) => ((v - min) / (max - min)) * 100;

export function Slider({
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommitted,
  label,
  showValue = false,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  marks,
  tooltip = "auto",
  formatValue,
  format,
  locale,
  size = "md",
  disabled,
  className,
  "aria-label": ariaLabel,
  ...rest
}: SliderProps) {
  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue: defaultValue ?? min,
    onChange: onValueChange,
  });
  // "glide" lets the thumb travel to a pressed point or a pressed label; drags and
  // keys switch it off so the thumb stays glued to the pointer and to each keystroke.
  const [motion, setMotion] = useState<"glide" | "instant">("glide");

  const fmt = useMemo(() => {
    if (formatValue) return formatValue;
    const nf = new Intl.NumberFormat(locale, format);
    return (v: number) => nf.format(v);
  }, [formatValue, format, locale]);

  const s = sizes[size];
  const p = pct(value, min, max);
  const list = (marks ?? []).map((m) => (typeof m === "number" ? { value: m, label: undefined } : m));
  const labeled = list.some((m) => m.label != null);

  return (
    <BaseSlider.Root
      value={value}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep ?? step * 10}
      format={format}
      locale={locale}
      disabled={disabled}
      onValueChange={(next, details) => {
        setMotion(details.reason === "track-press" ? "glide" : "instant");
        setValue(next as number);
      }}
      onValueCommitted={(next, details) => {
        if (details.reason === "drag") setMotion("glide");
        onValueCommitted?.(next as number);
      }}
      data-size={size}
      data-motion={motion}
      data-tooltip={tooltip}
      className={cn("group/slider flex w-full flex-col gap-2 data-disabled:opacity-50", className)}
      {...rest}
    >
      {(label != null || showValue) && (
        <div className="flex items-baseline justify-between gap-3">
          {label != null && <BaseSlider.Label className="min-w-0 truncate text-[12.5px] font-medium tracking-[-0.005em] text-fg">{label}</BaseSlider.Label>}
          {showValue && (
            <span
              aria-hidden
              suppressHydrationWarning
              className={cn(
                "ml-auto shrink-0 text-[12.5px] text-fg-2 tabular transition-opacity duration-150",
                // While the bubble is up the number lives by the thumb, where the eyes are.
                tooltip === "auto" && "group-data-dragging/slider:opacity-0 group-has-focus-visible/slider:opacity-0",
              )}
            >
              {fmt(value)}
            </span>
          )}
        </div>
      )}

      <BaseSlider.Control
        className={cn(
          "group/control relative flex touch-none select-none items-center",
          "cursor-pointer group-data-disabled/slider:pointer-events-none",
          s.control,
        )}
      >
        <BaseSlider.Track className={cn("relative w-full rounded-full bg-fg/10 transition-colors duration-150", "group-hover/control:bg-fg/14", s.track)}>
          {/* The fill is ours rather than Base UI's so it can glide with the thumb. */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-0 rounded-full bg-fg",
              "group-data-[motion=glide]/slider:transition-[width] group-data-[motion=glide]/slider:duration-200 group-data-[motion=glide]/slider:ease-out-expo",
            )}
            style={{ width: `${p}%` }}
          />

          {list.map((m) => {
            const at = pct(m.value, min, max);
            // A dot on the rounded cap reads as a smudge; the label still marks the end.
            if (at <= 0 || at >= 100) return null;
            return (
              <span
                key={m.value}
                aria-hidden
                data-passed={m.value <= value || undefined}
                className={cn(
                  "absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-150",
                  "bg-fg-3 data-passed:bg-frame/70",
                )}
                style={{ left: `${at}%` }}
              />
            );
          })}

          <BaseSlider.Thumb
            aria-label={ariaLabel}
            getAriaValueText={(_, v) => fmt(v)}
            className={cn(
              "group/thumb outline-none",
              // A 44px press target around a thumb that draws at 12–20px.
              "before:absolute before:-inset-3.5 before:content-['']",
              "group-data-[motion=glide]/slider:transition-[inset-inline-start] group-data-[motion=glide]/slider:duration-200 group-data-[motion=glide]/slider:ease-out-expo",
              s.thumb,
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full bg-fg shadow-[var(--shadow)]",
                "outline-offset-2 group-has-focus-visible/thumb:outline-1 group-has-focus-visible/thumb:outline-solid group-has-focus-visible/thumb:outline-fg-3",
                "transition-[scale,box-shadow] duration-150 ease-out-expo",
                // Hover hints, grab commits: the thumb swells and a soft ring marks the hold.
                "group-hover/control:scale-110 group-data-dragging/slider:scale-125 group-data-dragging/slider:ring-4 group-data-dragging/slider:ring-fg/10",
                "motion-reduce:transition-none",
              )}
            />
            {tooltip !== "never" && (
              <span
                aria-hidden
                suppressHydrationWarning
                className={cn(
                  "pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 origin-bottom whitespace-nowrap",
                  "rounded-md bg-fg px-1.5 py-0.5 text-[11.5px] font-medium leading-4 text-frame tabular shadow-[var(--shadow)]",
                  "transition-[opacity,scale,translate]",
                  tooltip === "always"
                    ? "opacity-100"
                    : cn(
                        // Hidden: small, low and transparent, leaving quickly. Shown: grows up out of the thumb.
                        "translate-y-1 scale-90 opacity-0 duration-100 ease-out",
                        "group-data-dragging/slider:translate-y-0 group-data-dragging/slider:scale-100 group-data-dragging/slider:opacity-100 group-data-dragging/slider:duration-150 group-data-dragging/slider:ease-out-expo",
                        "group-has-focus-visible/thumb:translate-y-0 group-has-focus-visible/thumb:scale-100 group-has-focus-visible/thumb:opacity-100 group-has-focus-visible/thumb:duration-150 group-has-focus-visible/thumb:ease-out-expo",
                        "motion-reduce:translate-y-0 motion-reduce:scale-100",
                      ),
                )}
              >
                {fmt(value)}
              </span>
            )}
          </BaseSlider.Thumb>
        </BaseSlider.Track>
      </BaseSlider.Control>

      {labeled && (
        // Pointer shortcut only: the thumb already covers every value from the keyboard.
        <div aria-hidden className="relative -mt-0.5 h-4">
          {list.map((m) =>
            m.label == null ? null : (
              <button
                key={m.value}
                type="button"
                tabIndex={-1}
                disabled={disabled}
                data-current={m.value === value || undefined}
                onClick={() => {
                  setMotion("glide");
                  setValue(m.value);
                  onValueCommitted?.(m.value);
                }}
                className={cn(
                  "absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-sm px-1 text-[11px] leading-4 text-fg-3 tabular",
                  // The label draws 16px tall; the press target reaches 32px so it can be hit with a thumb.
                  "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
                  "transition-[color,scale] duration-150 hover:not-data-current:text-fg-2 active:scale-95 data-current:text-fg",
                  "disabled:pointer-events-none",
                )}
                style={{ left: `${pct(m.value, min, max)}%` }}
              >
                {m.label}
              </button>
            ),
          )}
        </div>
      )}
    </BaseSlider.Root>
  );
}
