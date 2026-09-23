"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useId } from "react";
import { ActionTooltip, type TooltipSide } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md" | "lg";
type Ctx = { value: string[]; multiple: boolean; size: Size; vertical: boolean };
const GroupContext = createContext<Ctx>({ value: [], multiple: false, size: "md", vertical: false });

export type ToggleGroupProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "dir"> & {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Let several items be on at once (bold + italic). Single by default (alignment, view). */
  multiple?: boolean;
  /** Single mode: one item always stays on; pressing it again does nothing. */
  required?: boolean;
  orientation?: "horizontal" | "vertical";
  size?: Size;
  disabled?: boolean;
  /** Names the group for screen readers ("Text alignment"). */
  "aria-label"?: string;
};

const heights: Record<Size, { item: string; square: string; text: string; radius: string; wash: string }> = {
  sm: { item: "h-[22px] gap-1 px-1.5", square: "size-[22px]", text: "text-[12px] [&_svg]:size-3.5", radius: "rounded-md", wash: "rounded-[4px]" },
  md: { item: "h-7 gap-1.5 px-2.5 has-[svg]:pl-2", square: "size-7", text: "text-[12.5px] [&_svg]:size-4", radius: "rounded-lg", wash: "rounded-md" },
  lg: { item: "h-8 gap-2 px-3 has-[svg]:pl-2.5", square: "size-8", text: "text-[13px] [&_svg]:size-4", radius: "rounded-lg", wash: "rounded-md" },
};

/**
 * A set of toggles sharing one state. In single mode one wash slides between the
 * items; in multiple mode each item gets its own, and neighbors join into one pill.
 */
export function ToggleGroup({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  multiple = false,
  required = false,
  orientation = "horizontal",
  size = "md",
  disabled,
  className,
  children,
  ...rest
}: ToggleGroupProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const id = useId();
  const vertical = orientation === "vertical";

  return (
    <GroupContext.Provider value={{ value, multiple, size, vertical }}>
      <LayoutGroup id={id}>
        <BaseToggleGroup
          value={value}
          onValueChange={(next) => {
            // Required single groups ignore the press that would leave nothing on.
            if (required && !multiple && next.length === 0) return;
            setValue(next);
          }}
          multiple={multiple}
          orientation={orientation}
          disabled={disabled}
          className={cn(
            "inline-flex shrink-0 border border-line-2 bg-raised p-0.5 shadow-[var(--shadow)]",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
            vertical ? "flex-col" : "flex-row items-center",
            heights[size].radius,
            className,
          )}
          {...(rest as BaseToggleGroup.Props)}
        >
          {children}
        </BaseToggleGroup>
      </LayoutGroup>
    </GroupContext.Provider>
  );
}

export type ToggleGroupItemProps = Omit<React.ComponentProps<"button">, "value" | "className"> & {
  className?: string;
  value: string;
  /** Makes the item an icon-only square: its accessible name and tooltip. */
  label?: string;
  tooltip?: boolean | React.ReactNode;
  shortcut?: string;
  tooltipSide?: TooltipSide;
  children: React.ReactNode;
};

export function ToggleGroupItem({
  value,
  label,
  tooltip = true,
  shortcut,
  tooltipSide = "top",
  disabled,
  className,
  children,
  ...rest
}: ToggleGroupItemProps) {
  const group = useContext(GroupContext);
  const reduce = useReducedMotion();
  const on = group.value.includes(value);
  const iconOnly = label !== undefined;
  const h = heights[group.size];

  const wash = on && (
    <motion.span
      key="wash"
      aria-hidden
      data-wash=""
      // Single mode: one wash, handed from item to item. Multiple: each item owns one.
      layoutId={group.multiple ? undefined : "wash"}
      className={cn(
        "absolute inset-0 -z-10 bg-fg/[0.08]",
        // Only the per-item washes transition their corners; the shared one is moved by Motion.
        group.multiple && "transition-[border-radius] duration-150 ease-out-quart",
        h.wash,
      )}
      initial={group.multiple ? (reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }) : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
      transition={reduce ? { duration: 0 } : group.multiple ? spring.pop : spring.snappy}
    />
  );

  const item = (
    <Toggle
      value={value}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "relative isolate inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em] outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "text-fg-3 transition-[color,scale] duration-150 ease-out-quart hover:text-fg-2 data-pressed:text-fg",
        "active:scale-[0.95] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        // Neighboring washes in multiple mode join: the touching corners go square.
        group.vertical
          ? "[&:has(+[data-pressed])>[data-wash]]:rounded-b-none [[data-pressed]+&>[data-wash]]:rounded-t-none"
          : "[&:has(+[data-pressed])>[data-wash]]:rounded-e-none [[data-pressed]+&>[data-wash]]:rounded-s-none",
        group.vertical && !iconOnly && "w-full justify-start",
        // Taller to a finger, along the axis that doesn't overlap a neighbor.
        group.vertical
          ? "pointer-coarse:after:absolute pointer-coarse:after:inset-y-0 pointer-coarse:after:-inset-x-2.5"
          : "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2.5",
        iconOnly ? h.square : h.item,
        h.text,
        h.wash,
        className,
      )}
      {...(rest as Toggle.Props)}
    >
      <AnimatePresence initial={false}>{wash}</AnimatePresence>
      {children}
    </Toggle>
  );

  if (!iconOnly || tooltip === false || tooltip == null) return item;
  return (
    <ActionTooltip content={tooltip === true ? label : tooltip} shortcut={shortcut} side={tooltipSide} disabled={disabled}>
      {item}
    </ActionTooltip>
  );
}
