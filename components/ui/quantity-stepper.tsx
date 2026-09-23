"use client";
import { NumberField } from "@base-ui/react/number-field";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Minus, Plus, Trash } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type ChangeDetails = NumberField.Root.ChangeEventDetails;

export type QuantityStepperProps = Omit<
  NumberField.Root.Props,
  "value" | "defaultValue" | "onValueChange" | "min" | "max" | "step" | "format" | "className" | "children" | "render"
> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** The lowest quantity the steppers reach. */
  min?: number;
  /** Units in stock or the per-order limit. Plus stops here and says so. */
  max?: number;
  /** When set, the minus turns into a remove button at the minimum. */
  onRemove?: () => void;
  /** Accessible name of the remove button, e.g. "Remove Linen shirt". */
  removeLabel?: string;
  /** Accessible name of the count. */
  label?: string;
  /** What the hint says when the count reaches max. */
  stockMessage?: (max: number) => string;
  /** Which side of the stepper the stock hint appears on. Use "bottom" near the top of a scroll area. */
  hintSide?: "top" | "bottom";
  size?: "sm" | "md" | "lg";
  /** Bordered surface, or filled with the foreground like a primary button. */
  variant?: "secondary" | "primary";
  /** Skip the stepper's own fill, border and shadow, for when a parent draws the surface (e.g. while morphing). */
  bare?: boolean;
  className?: string;
};

export function QuantityStepper({
  value: valueProp,
  defaultValue = 1,
  onValueChange,
  min = 1,
  max,
  onRemove,
  removeLabel = "Remove",
  label = "Quantity",
  stockMessage = (n) => `Only ${n} in stock`,
  hintSide = "top",
  size = "md",
  variant = "secondary",
  bare = false,
  disabled: disabledProp,
  readOnly,
  className,
  ...rest
}: QuantityStepperProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const soldOut = max != null && max < min;
  const disabled = disabledProp || soldOut;
  const removing = !!onRemove && value <= min && !disabled && !readOnly;

  // Typing shows the real input; stepping shows rolling digits laid over it.
  const [editing, setEditing] = useState(false);
  // Arrow keys change the count on the same frame; presses roll it.
  const [instant, setInstant] = useState(false);
  const [hint, setHint] = useState(false);
  const fromStepper = useRef(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flashHint = () => {
    window.clearTimeout(timer.current);
    setHint(true);
    timer.current = window.setTimeout(() => setHint(false), 2600);
  };

  const change = (next: number | null, details: ChangeDetails) => {
    // An emptied field keeps the last count; blur restores it.
    if (next == null) return;
    const typed = details.reason === "input-change" || details.reason === "input-paste";
    setInstant(details.reason === "keyboard" || typed);
    if (typed) setEditing(true);
    let n = Math.round(next);
    if (max != null && n > max) {
      n = max;
      flashHint();
    } else if (max != null && n === max && value < max) flashHint();
    else if (max != null && n < max) setHint(false);
    setValue(Math.max(min, n));
  };

  const h = size === "sm" ? "h-7" : size === "lg" ? "h-9" : "h-8";
  const square = size === "sm" ? "w-7" : size === "lg" ? "w-9" : "w-8";
  const icon = size === "sm" ? 14 : 16;
  const primary = variant === "primary";
  // The count is sized for the largest it can hold (two digits at least) so steppers in a list line up.
  const digits = Math.max(2, String(Math.max(max ?? 99, value)).length);

  return (
    <NumberField.Root
      value={value}
      onValueChange={change}
      min={min}
      max={soldOut ? min : max}
      step={1}
      disabled={disabled}
      readOnly={readOnly}
      data-size={size}
      data-variant={variant}
      data-editing={editing ? "" : undefined}
      data-at-max={max != null && value >= max ? "" : undefined}
      className={cn("relative inline-flex", className)}
      {...rest}
    >
      <NumberField.Group
        onPointerDownCapture={(e) => {
          const onStepper = (e.target as HTMLElement).closest("button") != null;
          fromStepper.current = onStepper;
          // A press on the count itself means "let me type", even when it already has focus.
          if (!disabled && !readOnly) setEditing(!onStepper);
        }}
        className={cn(
          "group/qty relative inline-flex w-full items-center rounded-lg border",
          "transition-[border-color,box-shadow] duration-150",
          primary ? "border-transparent text-frame" : "text-fg",
          !bare && (primary ? "bg-fg" : "border-line-2 bg-raised shadow-[var(--shadow)]"),
          bare && !primary && "border-transparent",
          editing && (primary ? "ring-3 ring-fg/20" : "border-fg-4 ring-2 ring-fg/10"),
          "data-disabled:opacity-50",
          h,
        )}
      >
        {/* The minus and the remove button share one slot and one icon layer, so the icon morphs
            in place while the element underneath swaps. */}
        <span
          className={cn(
            "group/slot relative grid h-full shrink-0 place-items-center rounded-l-[7px] transition-colors duration-150",
            primary ? "hover:bg-frame/10" : "hover:bg-hover",
            "has-[[data-disabled]]:bg-transparent!",
            square,
          )}
        >
          {removing ? (
            <button
              type="button"
              aria-label={removeLabel}
              onClick={onRemove}
              className={cn(
                // The ring sits inside the stepper's border instead of drawing a second box around the slot.
                "absolute inset-[3px] rounded-[5px] outline-none",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
                "before:absolute before:-inset-x-[3px] before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
              )}
            />
          ) : (
            <NumberField.Decrement
              aria-label="Decrease quantity"
              className={cn(
                "absolute inset-0 rounded-l-[7px] outline-none data-disabled:cursor-not-allowed",
                "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 grid place-items-center",
              "transition-[color,scale,opacity] duration-150 group-has-[:active]/slot:scale-90 group-has-[:active]/slot:duration-75",
              primary ? "text-frame/75" : "text-fg-2",
              removing ? "group-hover/slot:text-danger" : primary ? "group-hover/slot:text-frame" : "group-hover/slot:text-fg",
              "group-has-[[data-disabled]]/slot:opacity-40",
            )}
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={removing ? "remove" : "minus"}
                className="absolute inset-0 grid place-items-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: removing ? -12 : 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                transition={reduce ? { duration: 0.12 } : spring.pop}
              >
                {removing ? <Trash size={icon === 14 ? 14 : 15} /> : <Minus size={icon} />}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>

        <span className="relative grid h-full flex-1 place-items-center" style={{ minWidth: `calc(${digits}ch + 18px)` }}>
          <NumberField.Input
            aria-label={label}
            onFocus={(e) => {
              // Focus from a click on a stepper stays in "stepping" mode; anything else is typing.
              if (fromStepper.current) return;
              setEditing(true);
              e.currentTarget.select();
            }}
            onMouseUp={(e) => {
              // Keep the select-all from the focus above instead of dropping a caret.
              if (editing && e.currentTarget.selectionStart !== e.currentTarget.selectionEnd) e.preventDefault();
            }}
            onBlur={() => {
              fromStepper.current = false;
              setEditing(false);
            }}
            className={cn(
              // Absolute, so an input's default intrinsic width never sizes the stepper.
              "tabular absolute inset-0 size-full min-w-0 bg-transparent text-center font-medium outline-none",
              primary && "selection:bg-frame selection:text-fg",
              "text-base sm:text-[13px]",
              editing ? "text-current" : "text-transparent caret-transparent selection:bg-transparent",
              "disabled:cursor-not-allowed",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "tabular pointer-events-none absolute inset-0 grid place-items-center font-medium",
              "text-base sm:text-[13px]",
              editing && "invisible",
            )}
          >
            <NumberFlow value={value} animated={!instant && !reduce} willChange className="leading-none" />
          </span>
        </span>

        {/* A disabled button swallows the press, so at the limit it lets it through to this slot,
            which says why nothing happened. */}
        <span
          onPointerDown={() => {
            if (max != null && value >= max && !disabled && !readOnly) flashHint();
          }}
          className={cn(
            "relative grid h-full shrink-0 place-items-center rounded-r-[7px] transition-colors duration-150",
            primary ? "hover:bg-frame/10" : "hover:bg-hover",
            max != null && value >= max && "bg-transparent! cursor-not-allowed",
            square,
          )}
        >
          <NumberField.Increment
            aria-label="Increase quantity"
            className={cn(
              "group/inc absolute inset-0 grid place-items-center rounded-r-[7px] outline-none",
              "transition-[color] duration-150 data-disabled:pointer-events-none",
              primary ? "text-frame/75 hover:text-frame data-disabled:text-frame/75" : "text-fg-2 hover:text-fg data-disabled:text-fg-2",
              "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <Plus
              size={icon}
              className="transition-[scale,opacity] duration-150 group-active/inc:scale-90 group-active/inc:duration-75 group-data-disabled/inc:scale-100 group-data-disabled/inc:opacity-40"
            />
          </NumberField.Increment>
        </span>
      </NumberField.Group>

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 z-(--z-popover) flex justify-center",
          hintSide === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
        )}
      >
        <AnimatePresence>
          {hint && max != null && (
            <motion.span
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line-2 bg-raised px-2 py-1 text-[11.5px] text-fg-2 shadow-pop",
                hintSide === "top" ? "origin-bottom" : "origin-top",
              )}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: hintSide === "top" ? 4 : -4, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0.12 } : spring.snappy}
            >
              <span className="size-1.5 rounded-full bg-warning" />
              {stockMessage(max)}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {hint && max != null ? stockMessage(max) : ""}
      </span>
    </NumberField.Root>
  );
}
