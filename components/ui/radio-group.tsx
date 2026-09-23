"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { motion, useReducedMotion } from "motion/react";
import { createContext, use, useId } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type Size = "sm" | "md";
const GroupContext = createContext<{ size: Size; invalid: boolean }>({ size: "md", invalid: false });

export type RadioGroupProps = Omit<BaseRadioGroup.Props<string>, "className"> & {
  orientation?: "vertical" | "horizontal";
  size?: Size;
  /** Marks every unselected option invalid, e.g. a required choice left empty after submit. */
  invalid?: boolean;
  className?: string;
};

export function RadioGroup({ orientation = "vertical", size = "md", invalid = false, className, ...rest }: RadioGroupProps) {
  return (
    <GroupContext value={{ size, invalid }}>
      <BaseRadioGroup
        data-orientation={orientation}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-3" : "flex-row flex-wrap gap-x-5 gap-y-2.5",
          className,
        )}
        {...rest}
      />
    </GroupContext>
  );
}

export type RadioGroupItemProps = Omit<Radio.Root.Props<string>, "className" | "children"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
};

export function RadioGroupItem({ label, description, className, "aria-describedby": describedBy, ...rest }: RadioGroupItemProps) {
  const { size, invalid } = use(GroupContext);
  const descriptionId = useId();

  return (
    <label
      className={cn(
        "group/radio relative flex select-none items-start",
        size === "sm" ? "gap-2" : "gap-2.5",
        "has-[[data-disabled]]:opacity-50",
        className,
      )}
    >
      <span className={cn("flex items-center", size === "sm" ? "h-[18px]" : "h-5")}>
        <Radio.Root
          aria-describedby={cn(describedBy, description != null && descriptionId) || undefined}
          className={(state) => {
            const idle = !state.disabled && !state.readOnly;
            return cn(
              "relative grid shrink-0 place-items-center rounded-full border outline-none",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,border-color,scale] duration-150 ease-out-expo motion-reduce:transition-none",
              size === "sm" ? "size-3.5" : "size-4",
              idle && "motion-safe:group-active/radio:scale-[0.86] group-active/radio:duration-100",
              state.checked
                ? "border-fg bg-fg"
                : invalid || state.valid === false
                  ? "border-danger bg-danger-soft"
                  : cn("border-fg-4 bg-raised", idle && "group-hover/radio:border-fg-3"),
            );
          }}
          {...rest}
        >
          <Radio.Indicator
            keepMounted
            className="pointer-events-none grid place-items-center"
            render={(props, state) => (
              <span {...props}>
                <Dot checked={state.checked} size={size} />
              </span>
            )}
          />
        </Radio.Root>
      </span>
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

/** The center dot springs in as the ring fills behind it. */
function Dot({ checked, size }: { checked: boolean; size: Size }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={cn("block rounded-full bg-frame", size === "sm" ? "size-[5px]" : "size-1.5")}
      initial={false}
      animate={checked ? { scale: 1, opacity: 1 } : { scale: 0.2, opacity: 0 }}
      transition={
        reduce
          ? { opacity: { duration: 0.12 }, scale: { duration: 0 } }
          : checked
            ? { ...spring.pop, opacity: { duration: 0.08 } }
            : { duration: 0.1, ease: ease.in }
      }
    />
  );
}
