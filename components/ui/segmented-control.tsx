"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion, useReducedMotion } from "motion/react";
import { createContext, use, useId } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md";
type Ctx = { value: string; size: Size; pill: string };
const SegmentedContext = createContext<Ctx>({ value: "", size: "md", pill: "" });

export type SegmentedControlProps = Omit<RadioGroup.Props<string>, "className" | "value" | "defaultValue" | "onValueChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: Size;
  /** Stretch to the container and give every segment the same width. */
  fill?: boolean;
  className?: string;
};

export function SegmentedControl({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  size = "md",
  fill = false,
  className,
  ...rest
}: SegmentedControlProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  // One pill per control, shared by every segment through layoutId.
  const pill = useId();

  return (
    <SegmentedContext value={{ value, size, pill }}>
      <RadioGroup
        value={value}
        onValueChange={(next) => setValue(next as string)}
        data-size={size}
        className={cn(
          "relative rounded-lg border border-line bg-page p-0.5",
          fill ? "grid w-full auto-cols-fr grid-flow-col" : "inline-flex max-w-full",
          size === "sm" ? "h-7 rounded-md" : "h-8",
          className,
        )}
        {...rest}
      />
    </SegmentedContext>
  );
}

export type SegmentedControlItemProps = Omit<Radio.Root.Props<string>, "className" | "children" | "render" | "nativeButton"> & {
  value: string;
  /** 14px icon before the label. With no children, pass aria-label for an icon-only segment. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function SegmentedControlItem({ value, icon, children, disabled, className, ...rest }: SegmentedControlItemProps) {
  const { value: selected, size, pill } = use(SegmentedContext);
  const reduce = useReducedMotion();
  const active = selected === value;
  const iconOnly = children == null;

  return (
    <Radio.Root
      value={value}
      disabled={disabled}
      nativeButton
      render={<button type="button" />}
      // Disabled comes from the primitive so a disabled control dims every segment, not just flagged ones.
      className={(state) =>
        cn(
          "group/seg relative flex h-full min-w-0 select-none items-center justify-center outline-none",
          size === "sm" ? "rounded-[5px] text-[12px]" : "rounded-md text-[12.5px]",
          iconOnly ? (size === "sm" ? "w-6" : "w-7") : size === "sm" ? "px-2" : "px-2.5",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          "transition-colors duration-150",
          active ? "text-fg" : "text-fg-3",
          state.disabled ? "cursor-not-allowed opacity-50" : !active && !state.readOnly && "hover:text-fg-2",
          state.disabled || state.readOnly ? "[--press:1]" : "[--press:0.96]",
          className,
        )
      }
      {...rest}
    >
      {active && (
        <motion.span
          layoutId={pill}
          aria-hidden
          className="absolute inset-0 border border-line-2 bg-raised shadow-[var(--shadow)]"
          // Radius in style so Motion keeps the corners round while the pill stretches between segments of different widths.
          style={{ borderRadius: size === "sm" ? 5 : 6 }}
          transition={reduce ? { duration: 0 } : spring.snappy}
        />
      )}
      {/* The content presses; the pill stays put so it never looks like it jumped. */}
      <span
        className={cn(
          "relative flex min-w-0 items-center font-medium tracking-[-0.005em] transition-[scale] duration-100 ease-out motion-safe:group-active/seg:scale-(--press)",
          size === "sm" ? "gap-1" : "gap-1.5",
          "[&_svg]:size-3.5 [&_svg]:shrink-0",
        )}
      >
        {icon}
        {children != null && <span className="truncate">{children}</span>}
      </span>
    </Radio.Root>
  );
}
