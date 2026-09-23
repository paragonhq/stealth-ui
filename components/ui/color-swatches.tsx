"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Plus } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md" | "lg";
const PX: Record<Size, number> = { sm: 20, md: 24, lg: 28 };
const GAP: Record<Size, number> = { sm: 8, md: 10, lg: 12 };

export type Swatch = {
  /** Any CSS color. Hex and rgb() pick the check color automatically. */
  value: string;
  /** The name shown in the tooltip and read out. */
  label: string;
  disabled?: boolean;
  /** Force the check color for colors that can't be parsed (var(), oklch()…). */
  ink?: "light" | "dark";
};

// Relative luminance from #rgb, #rrggbb or rgb(a)(). Null when the format isn't one of those.
function luminance(color: string): number | null {
  let rgb: number[] | null = null;
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (m) rgb = [m[1], m[2], m[3]].map(Number);
  }
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** "light" or "dark": whichever check color has more contrast on the swatch. */
export function inkFor(color: string, fallback: "light" | "dark" = "light") {
  const l = luminance(color);
  if (l === null) return fallback;
  // Contrast against white (1.05 / (l + .05)) versus against black ((l + .05) / .05).
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "light" : "dark";
}

// Absolute light and dark inks from the theme tokens, so the check reads on the swatch in either theme.
const INK = { light: "text-frame dark:text-fg", dark: "text-fg dark:text-frame" } as const;

export type ColorSwatchesProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  colors: Swatch[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Adds a button that opens the system color picker; the pick joins the row as a swatch. */
  allowCustom?: boolean;
  customLabel?: string;
  size?: Size;
  disabled?: boolean;
  /** Posts the value with a form. */
  name?: string;
};

export function ColorSwatches({
  colors,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  allowCustom = false,
  customLabel = "Custom color",
  size = "md",
  disabled = false,
  name,
  className,
  ...rest
}: ColorSwatchesProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [picked, setPicked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const px = PX[size];

  // A value that isn't a preset is a custom color, whether it came from the picker or from props.
  const isPreset = colors.some((c) => c.value === value);
  const custom = value && !isPreset ? value : picked;

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (custom && /^#[0-9a-f]{6}$/i.test(custom)) input.value = custom;
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  };

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
      <RadioGroup
        value={value}
        onValueChange={(v) => setValue(v as string)}
        disabled={disabled}
        name={name}
        data-size={size}
        className={cn("flex flex-wrap items-center", className)}
        style={{ gap: GAP[size] }}
        {...rest}
      >
        {colors.map((c) => (
          <SwatchRadio key={c.value} swatch={c} px={px} />
        ))}

        {allowCustom && (
          <span className="flex items-center">
            <AnimatePresence initial={false}>
              {custom && (
                <motion.span
                  key="custom"
                  className="flex items-center"
                  initial={reduce ? { opacity: 0, width: px + GAP[size] } : { opacity: 0, width: 0, scale: 0.6 }}
                  animate={{ opacity: 1, width: px + GAP[size], scale: 1 }}
                  exit={{ opacity: 0, width: 0, scale: 0.6, transition: { duration: 0.15 } }}
                  transition={reduce ? { duration: 0.15 } : spring.snappy}
                >
                  <SwatchRadio swatch={{ value: custom, label: `${customLabel} ${custom}` }} px={px} />
                </motion.span>
              )}
            </AnimatePresence>
            <span className="relative grid">
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <button
                      type="button"
                      aria-label={custom ? `Change ${customLabel.toLowerCase()}` : customLabel}
                      disabled={disabled}
                      onClick={openPicker}
                      // The button sits inside the radio group; keep its arrow keys from moving the selection.
                      onKeyDown={(e) => {
                        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) e.stopPropagation();
                      }}
                      className={cn(
                        "relative grid shrink-0 select-none place-items-center rounded-full border border-dashed border-fg-4 text-fg-3",
                        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-fg-3",
                        "transition-[border-color,color,scale] duration-150 ease-out hover:border-fg-3 hover:text-fg active:scale-[0.92] active:duration-75",
                        "disabled:pointer-events-none disabled:opacity-40",
                        "after:absolute after:-inset-2.5 after:content-['']",
                      )}
                      style={{ width: px, height: px }}
                    />
                  }
                >
                  <Plus size={px <= 20 ? 12 : 14} />
                </Tooltip.Trigger>
                <SwatchTooltip>{customLabel}</SwatchTooltip>
              </Tooltip.Root>
              {/* Sits under the button so the system picker opens next to it. */}
              <input
                ref={inputRef}
                type="color"
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 size-full opacity-0"
                onChange={(e) => {
                  const hex = e.target.value.toLowerCase();
                  setPicked(hex);
                  setValue(hex);
                }}
              />
            </span>
          </span>
        )}
      </RadioGroup>
    </Tooltip.Provider>
  );
}

function SwatchRadio({ swatch, px }: { swatch: Swatch; px: number }) {
  const ink = swatch.ink ?? inkFor(swatch.value);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Radio.Root
            value={swatch.value}
            disabled={swatch.disabled}
            aria-label={swatch.disabled ? `${swatch.label}, unavailable` : swatch.label}
            className={cn(
              "group/swatch relative grid shrink-0 cursor-default select-none place-items-center rounded-full",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[7px] focus-visible:outline-fg-3",
              "transition-[scale] duration-150 ease-out active:scale-[0.9] active:duration-75",
              // Still hoverable when unavailable, so the tooltip can say so; it just doesn't press.
              "data-disabled:cursor-not-allowed data-disabled:active:scale-100",
              // Reach 44px on touch without changing the drawn size.
              "after:absolute after:-inset-2.5 after:content-['']",
            )}
            style={{ width: px, height: px }}
          />
        }
      >
        {/* The selection ring grows out from the swatch's edge to its offset. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-1 rounded-full border-[1.5px] border-fg opacity-0 scale-[0.84]",
            "transition-[opacity,scale] duration-150 ease-out group-data-checked/swatch:scale-100 group-data-checked/swatch:opacity-100 group-data-checked/swatch:duration-[260ms] group-data-checked/swatch:ease-out-expo",
            "motion-reduce:transition-opacity",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_14%,transparent)]",
            "group-data-disabled/swatch:opacity-40",
          )}
          style={{ background: swatch.value }}
        />
        {swatch.disabled && (
          // A slash in the swatch's own contrasting ink marks it unavailable.
          <span aria-hidden className={cn("absolute inset-0 grid place-items-center", INK[ink])}>
            <span className="h-px w-[120%] rotate-[-45deg] bg-current opacity-70" />
          </span>
        )}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={cn("relative", INK[ink])}
          style={{ width: px * 0.58, height: px * 0.58 }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            pathLength={1}
            strokeDasharray="1"
            className="[stroke-dashoffset:1] transition-[stroke-dashoffset] duration-100 ease-out group-data-checked/swatch:[stroke-dashoffset:0] group-data-checked/swatch:delay-75 group-data-checked/swatch:duration-300 motion-reduce:transition-none"
          />
        </svg>
      </Tooltip.Trigger>
      <SwatchTooltip>{swatch.disabled ? `${swatch.label} · Unavailable` : swatch.label}</SwatchTooltip>
    </Tooltip.Root>
  );
}

function SwatchTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Portal>
      <Tooltip.Positioner sideOffset={10} className="z-(--z-tooltip)">
        <Tooltip.Popup
          className={cn(
            "origin-(--transform-origin) whitespace-nowrap rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] text-fg shadow-pop",
            "transition-[opacity,scale,translate] duration-150 ease-out-expo",
            "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:translate-y-0.5",
            "data-ending-style:opacity-0 data-ending-style:duration-100",
            "data-instant:transition-none",
          )}
        >
          {children}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  );
}
