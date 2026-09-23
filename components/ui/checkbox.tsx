"use client";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { CheckboxGroup as BaseCheckboxGroup } from "@base-ui/react/checkbox-group";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

// The tick and the dash share one path with the same three points, so moving
// between checked and mixed bends the stroke instead of swapping icons.
const CHECK = "M3.75 8.25 L6.75 11.25 L12.25 4.75";
const DASH = "M4.25 8 L8 8 L11.75 8";

type Shape = "check" | "dash" | "none";

export type CheckboxProps = Omit<BaseCheckbox.Root.Props, "className" | "children"> & {
  /** Visible label. The whole label is the hit target. */
  label?: React.ReactNode;
  /** A quieter line under the label, linked as the description. */
  description?: React.ReactNode;
  size?: "sm" | "md";
  /** Marks the box as invalid. Set it after a failed submit, not while the person is still deciding. */
  invalid?: boolean;
  /** Applied to the outermost element: the label when there is one, else the box. */
  className?: string;
};

export function Checkbox({
  label,
  description,
  size = "md",
  invalid = false,
  className,
  "aria-describedby": describedBy,
  ...rest
}: CheckboxProps) {
  const descriptionId = useId();
  const labeled = label != null;

  const box = (
    <BaseCheckbox.Root
      data-size={size}
      data-invalid={invalid || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={cn(describedBy, description != null && descriptionId) || undefined}
      className={(state) => {
        const filled = state.checked || state.indeterminate;
        const bad = invalid || state.valid === false;
        const idle = !state.disabled && !state.readOnly;
        return cn(
          "relative inline-grid shrink-0 place-items-center border outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out-expo motion-reduce:transition-none",
          size === "sm" ? "size-3.5 rounded-[4px]" : "size-4 rounded-[4.5px]",
          // Squash on press. The label shares the target, so pressing the words squashes the box too.
          idle && "motion-safe:active:scale-[0.86] active:duration-100 motion-safe:group-active/checkbox:scale-[0.86] group-active/checkbox:duration-100",
          filled
            ? "border-fg bg-fg text-frame"
            : bad
              ? "border-danger bg-danger-soft"
              : cn("border-fg-4 bg-raised", idle && "hover:border-fg-3 group-hover/checkbox:border-fg-3"),
          // Touch: without a label the box alone is the target, so grow it to 44px.
          !labeled && "after:absolute after:content-['']",
          !labeled && (size === "sm" ? "after:-inset-[15px]" : "after:-inset-3.5"),
          !labeled && state.disabled && "opacity-50",
          !labeled && className,
        );
      }}
      {...rest}
    >
      <BaseCheckbox.Indicator
        keepMounted
        className="pointer-events-none grid place-items-center"
        render={(props, state) => (
          <span {...props}>
            <Mark shape={state.indeterminate ? "dash" : state.checked ? "check" : "none"} />
          </span>
        )}
      />
    </BaseCheckbox.Root>
  );

  if (!labeled) return box;

  return (
    <label
      data-size={size}
      className={cn(
        "group/checkbox relative inline-flex select-none items-start",
        size === "sm" ? "gap-2" : "gap-2.5",
        "has-[[data-disabled]]:opacity-50",
        className,
      )}
    >
      <span className={cn("flex items-center", size === "sm" ? "h-[18px]" : "h-5")}>{box}</span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className={cn("text-fg", size === "sm" ? "text-[12.5px] leading-[18px]" : "text-[13px] leading-5")}>{label}</span>
        {description != null && (
          <span id={descriptionId} className={cn("text-fg-3", size === "sm" ? "text-[12px] leading-4" : "text-[12.5px] leading-[18px]")}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/** The drawn mark. Remembers the last shape so it knows whether to draw, erase or bend. */
function Mark({ shape }: { shape: Shape }) {
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(shape);
  const [from, setFrom] = useState<Shape>(shape);
  if (shape !== current) {
    setFrom(current);
    setCurrent(shape);
  }

  const visible = shape !== "none";
  // While hidden, keep the last shape so erasing doesn't bend it on the way out.
  const d = shape === "dash" || (shape === "none" && from === "dash") ? DASH : CHECK;
  const bend = from !== "none" && visible;

  return (
    <svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" className="size-full">
      <motion.path
        initial={false}
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ d, pathLength: visible ? 1 : 0, opacity: visible ? 1 : 0 }}
        transition={
          reduce
            ? { duration: 0.12, d: { duration: 0 }, pathLength: { duration: 0 } }
            : {
                d: bend ? spring.snappy : { duration: 0 },
                // Draw in on the expo ease-out; erase faster than it drew.
                pathLength: visible ? { duration: 0.24, ease: ease.out, delay: 0.03 } : { duration: 0.1, ease: ease.in },
                opacity: visible ? { duration: 0.04, delay: 0.03 } : { duration: 0.08, delay: 0.04 },
              }
        }
      />
    </svg>
  );
}

export type CheckboxGroupProps = Omit<BaseCheckboxGroup.Props, "className"> & { className?: string };

/**
 * Shared state for a list of checkboxes. Give it `allValues` and a controlled
 * `value` and a Checkbox with `parent` becomes a select-all that goes mixed.
 */
export function CheckboxGroup({ className, ...rest }: CheckboxGroupProps) {
  return <BaseCheckboxGroup className={cn("flex flex-col gap-2.5", className)} {...rest} />;
}
