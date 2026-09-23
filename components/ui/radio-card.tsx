"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion, useReducedMotion } from "motion/react";
import { createContext, use, useId } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const CardsContext = createContext<{ value: string; ring: string }>({ value: "", ring: "" });

export type RadioCardGroupProps = Omit<RadioGroup.Props<string>, "className" | "value" | "defaultValue" | "onValueChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

export function RadioCardGroup({ value: valueProp, defaultValue = "", onValueChange, className, ...rest }: RadioCardGroupProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  // One selection ring for the whole group; it travels to whichever card is chosen.
  const ring = useId();

  return (
    <CardsContext value={{ value, ring }}>
      <RadioGroup
        value={value}
        onValueChange={(next) => setValue(next as string)}
        className={cn("grid gap-2", className)}
        {...rest}
      />
    </CardsContext>
  );
}

export type RadioCardProps = Omit<Radio.Root.Props<string>, "className" | "children" | "render" | "title"> & {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small pill beside the title, like “Most popular”. */
  badge?: React.ReactNode;
  /** Trailing content, usually the price. Right-aligned and never wrapped under the title. */
  aside?: React.ReactNode;
  className?: string;
};

export function RadioCard({ value, title, description, badge, aside, disabled, className, ...rest }: RadioCardProps) {
  const { value: selected, ring } = use(CardsContext);
  const reduce = useReducedMotion();
  const checked = selected === value;
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Radio.Root
      value={value}
      disabled={disabled}
      render={<div />}
      aria-labelledby={titleId}
      aria-describedby={description != null ? descriptionId : undefined}
      // Read disabled and read-only from the primitive so a disabled group styles every card.
      className={(state) =>
        cn(
          "group/card relative flex min-w-0 select-none items-start gap-3 rounded-xl border p-3.5 text-left outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 ease-out-expo",
          checked ? "border-transparent bg-hover" : "border-line-2 bg-raised",
          state.disabled
            ? "cursor-not-allowed opacity-50"
            : !state.readOnly && cn("motion-safe:active:scale-[0.99] active:duration-100", !checked && "hover:border-fg-4 hover:[&_[data-ring]]:border-fg-3"),
          className,
        )
      }
      {...rest}
    >
      {checked && (
        <motion.span
          layoutId={ring}
          aria-hidden
          className="pointer-events-none absolute -inset-px border border-fg"
          // Radius in style so Motion corrects it while the ring stretches between cards of different heights.
          style={{ borderRadius: 12 }}
          transition={reduce ? { duration: 0 } : spring.snappy}
        />
      )}

      <span className="flex h-5 shrink-0 items-center">
        <span
          aria-hidden
          data-ring
          className={cn(
            "grid size-4 place-items-center rounded-full border transition-[background-color,border-color] duration-150",
            checked ? "border-fg bg-fg" : "border-fg-4 bg-raised",
          )}
        >
          <motion.span
            className="block size-1.5 rounded-full bg-frame"
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
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span id={titleId} className="truncate text-[13px] font-medium leading-5 tracking-[-0.005em] text-fg">
            {title}
          </span>
          {badge != null && (
            <span className="shrink-0 rounded-full border border-line-2 px-1.5 text-[10.5px] leading-4 text-fg-2">{badge}</span>
          )}
        </span>
        {description != null && (
          <span id={descriptionId} className="text-[12.5px] leading-[18px] text-fg-3">
            {description}
          </span>
        )}
      </span>

      {aside != null && <span className="shrink-0 text-right">{aside}</span>}
    </Radio.Root>
  );
}
