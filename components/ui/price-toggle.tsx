"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type BillingPeriod = "monthly" | "yearly";

/**
 * Whole-number percentage saved by paying yearly. `savingsPercent(20, 192)` → 20.
 * Use it to write the badge from real prices instead of hard-coding it.
 */
export function savingsPercent(monthlyPrice: number, yearlyPrice: number) {
  if (monthlyPrice <= 0) return 0;
  return Math.max(0, Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100));
}

export type PriceToggleProps = Omit<RadioGroup.Props<BillingPeriod>, "className" | "value" | "defaultValue" | "onValueChange"> & {
  value?: BillingPeriod;
  defaultValue?: BillingPeriod;
  onValueChange?: (value: BillingPeriod) => void;
  /** The badge on the yearly option, like "Save 20%" or "2 months free". Part of its accessible name. */
  savings?: React.ReactNode;
  monthlyLabel?: React.ReactNode;
  yearlyLabel?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
};

export function PriceToggle({
  value: valueProp,
  defaultValue = "monthly",
  onValueChange,
  savings,
  monthlyLabel = "Monthly",
  yearlyLabel = "Yearly",
  size = "md",
  disabled,
  className,
  onKeyDown,
  onPointerDown,
  ...rest
}: PriceToggleProps) {
  const [value, setValue] = useControllableState<BillingPeriod>({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const pill = useId();
  // Arrow keys switch on the same frame; only a pointer press glides the pill.
  const [keyboard, setKeyboard] = useState(false);
  const instant = reduce || keyboard;

  const options: { value: BillingPeriod; label: React.ReactNode }[] = [
    { value: "monthly", label: monthlyLabel },
    { value: "yearly", label: yearlyLabel },
  ];

  return (
    <RadioGroup
      aria-label="Billing period"
      value={value}
      onValueChange={(next) => setValue(next as BillingPeriod)}
      disabled={disabled}
      data-size={size}
      data-value={value}
      onKeyDown={(e) => {
        setKeyboard(true);
        onKeyDown?.(e);
      }}
      onPointerDown={(e) => {
        setKeyboard(false);
        onPointerDown?.(e);
      }}
      className={cn(
        "relative inline-flex max-w-full items-stretch border border-line bg-page p-0.5",
        size === "sm" ? "h-7 rounded-md" : "h-8 rounded-lg",
        disabled && "opacity-50",
        className,
      )}
      {...rest}
    >
      {options.map((o) => {
        const active = value === o.value;
        const yearly = o.value === "yearly";
        return (
          <Radio.Root
            key={o.value}
            value={o.value}
            nativeButton
            render={<button type="button" />}
            className={cn(
              "group/period relative flex min-w-0 select-none items-center justify-center outline-none",
              size === "sm" ? "rounded-[5px] px-2 text-[12px]" : "rounded-md px-2.5 text-[12.5px]",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              "transition-colors duration-150",
              // Touch: the 28–32px segment gets a 44px tall hit area without changing the drawing.
              "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2",
              "data-disabled:cursor-not-allowed data-disabled:hover:text-fg-3",
            )}
          >
            {active && (
              <motion.span
                layoutId={pill}
                aria-hidden
                className={cn(
                  "absolute inset-0 border border-line-2 bg-raised shadow-[var(--shadow)]",
                  size === "sm" ? "rounded-[5px]" : "rounded-md",
                )}
                transition={instant ? { duration: 0 } : spring.snappy}
              />
            )}
            {/* The label presses; the pill stays put so the press never reads as a jump. */}
            <span
              className={cn(
                "relative flex min-w-0 items-center font-medium tracking-[-0.005em]",
                "transition-[scale] duration-100 ease-out motion-safe:group-active/period:scale-[0.96] group-data-disabled/period:scale-100",
                size === "sm" ? "gap-1.5" : "gap-2",
              )}
            >
              <span className="truncate">{o.label}</span>
              {yearly && savings != null && <SavingsBadge on={active} size={size} reduce={!!reduce}>{savings}</SavingsBadge>}
            </span>
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

function SavingsBadge({ on, size, reduce, children }: { on: boolean; size: "sm" | "md"; reduce: boolean; children: React.ReactNode }) {
  return (
    <motion.span
      data-state={on ? "on" : "off"}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-medium tabular tracking-normal",
        size === "sm" ? "h-4 px-1.5 text-[10px]" : "h-[18px] px-1.5 text-[10.5px]",
        "transition-[background-color,border-color,color] duration-200 ease-out",
        on ? "border-transparent bg-success-soft text-success" : "border-line-2 text-fg-3",
      )}
      // Choosing yearly is the moment the saving becomes real: the badge swells once and settles.
      initial={false}
      animate={on && !reduce ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={{ duration: 0.34, ease: ease.out, times: [0, 0.4, 1] }}
    >
      {children}
    </motion.span>
  );
}
