"use client";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { CheckboxGroup as BaseCheckboxGroup } from "@base-ui/react/checkbox-group";
import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import { Checkbox } from "@/components/ui/checkbox";

export type CheckboxCardGroupProps = Omit<BaseCheckboxGroup.Props, "className" | "value" | "defaultValue" | "onValueChange"> & {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Adds a select-all row above the cards. Needs `allValues`. */
  selectAll?: boolean;
  selectAllLabel?: React.ReactNode;
  /** Cards per row once the group is wider than 384px. Always one column below that. */
  columns?: 1 | 2 | 3;
  className?: string;
};

export function CheckboxCardGroup({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  selectAll = false,
  selectAllLabel = "Select all",
  allValues,
  columns = 2,
  className,
  children,
  ...rest
}: CheckboxCardGroupProps) {
  // Held here so the select-all parent always has a controlled group to read.
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const total = allValues?.length ?? 0;
  const count = allValues ? value.filter((v) => allValues.includes(v)).length : value.length;

  return (
    <BaseCheckboxGroup
      value={value}
      onValueChange={(next) => setValue(next)}
      allValues={allValues}
      className={cn("@container flex w-full flex-col gap-2.5", className)}
      {...rest}
    >
      {selectAll && allValues && (
        <div className="flex min-h-7 items-center justify-between gap-3">
          <Checkbox parent size="sm" label={selectAllLabel} />
          {/* Fixed line box: the rolling digits sit inline-block and would nudge the baseline. */}
          <span className="flex h-5 shrink-0 items-center text-[12px] tabular text-fg-3">
            <span>
              {count === 0 ? (
                "None selected"
              ) : (
                <>
                  <NumberFlow value={count} className="text-fg-2" /> of {total} selected
                </>
              )}
            </span>
          </span>
        </div>
      )}
      <div
        className={cn(
          "grid gap-2",
          columns === 2 && "@sm:grid-cols-2",
          columns === 3 && "@sm:grid-cols-2 @xl:grid-cols-3",
        )}
      >
        {children}
      </div>
    </BaseCheckboxGroup>
  );
}

export type CheckboxCardProps = Omit<BaseCheckbox.Root.Props, "className" | "children" | "title" | "value" | "parent"> & {
  /** Identifies the card inside the group. */
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A 14px icon, drawn in a tile at the start of the card. */
  icon?: React.ReactNode;
  /** Small trailing text beside the title, like a plan name or "Beta". */
  badge?: React.ReactNode;
  className?: string;
};

export function CheckboxCard({ value, title, description, icon, badge, className, ...rest }: CheckboxCardProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <BaseCheckbox.Root
      value={value}
      render={<div />}
      aria-labelledby={titleId}
      aria-describedby={description != null ? descriptionId : undefined}
      className={(state) =>
        cn(
          "group/card relative flex min-w-0 select-none items-start gap-3 rounded-xl border p-3 pr-9 text-left outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out-expo",
          state.checked
            ? "border-fg-3 bg-hover shadow-[inset_0_0_0_0.5px_var(--fg-3)]"
            : "border-line-2 bg-raised",
          state.disabled
            ? "cursor-not-allowed opacity-50"
            : !state.readOnly && cn("motion-safe:active:scale-[0.985] active:duration-100", !state.checked && "hover:border-fg-4"),
          className,
        )
      }
      {...rest}
    >
      {icon != null && (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-2 transition-colors duration-150 group-data-checked/card:text-fg [&_svg]:size-3.5"
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
        <span className="flex min-w-0 items-center gap-1.5">
          <span id={titleId} className="truncate text-[13px] font-medium leading-5 tracking-[-0.005em] text-fg">
            {title}
          </span>
          {badge != null && (
            <span className="shrink-0 rounded-full border border-line-2 px-1.5 text-[10.5px] leading-4 text-fg-2">{badge}</span>
          )}
        </span>
        {description != null && (
          <span id={descriptionId} className="line-clamp-2 text-[12.5px] leading-[18px] text-fg-3">
            {description}
          </span>
        )}
      </span>
      <BaseCheckbox.Indicator
        keepMounted
        className="pointer-events-none absolute right-3 top-3"
        render={(props, state) => (
          <span {...props}>
            <CornerCheck checked={state.checked} idle={!state.disabled && !state.readOnly} />
          </span>
        )}
      />
    </BaseCheckbox.Root>
  );
}

/** An empty ring that fills and pops, then draws its tick. */
function CornerCheck({ checked, idle }: { checked: boolean; idle: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative grid size-4 place-items-center rounded-full">
      <span
        className={cn(
          "absolute inset-0 rounded-full border transition-[border-color,opacity] duration-150",
          checked ? "border-transparent" : cn("border-fg-4", idle && "group-hover/card:border-fg-3"),
        )}
      />
      <motion.span
        className="absolute inset-0 grid place-items-center rounded-full bg-fg text-frame"
        initial={false}
        animate={checked ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
        // Reduced motion keeps the fade and snaps the scale. The targets stay the same so SSR matches.
        transition={reduce ? { opacity: { duration: 0.12 }, scale: { duration: 0 } } : checked ? spring.pop : { duration: 0.12, ease: ease.in }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
          <motion.path
            d="M3.5 8.5 L6.75 11.5 L12.5 4.75"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : checked
                  ? { pathLength: { duration: 0.22, ease: ease.out, delay: 0.06 }, opacity: { duration: 0.01, delay: 0.06 } }
                  : { duration: 0.08 }
            }
          />
        </svg>
      </motion.span>
    </span>
  );
}
