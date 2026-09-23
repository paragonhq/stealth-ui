"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, use, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md";
const SizeContext = createContext<Size>("md");

export type ChoiceChipsProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** Selected chip values. In single mode it holds zero or one value. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Several chips at once (filters), or at most one (a single choice that can be undone). */
  multiple?: boolean;
  /** Show a clear chip at the end of the row whenever anything is selected. */
  clearable?: boolean;
  clearLabel?: string;
  /** Read out after the clear chip empties the selection. */
  clearedAnnouncement?: string;
  size?: Size;
  disabled?: boolean;
};

export function ChoiceChips({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  multiple = true,
  clearable = true,
  clearLabel = "Clear",
  clearedAnnouncement = "Selection cleared",
  size = "md",
  disabled = false,
  className,
  children,
  ref,
  ...rest
}: ChoiceChipsProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [announcement, setAnnouncement] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);
  // Keep our handle on the group (for focus after Clear) while still forwarding the caller's ref.
  const setGroupRef = useCallback(
    (node: HTMLDivElement | null) => {
      groupRef.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );
  const reduce = useReducedMotion();
  const showClear = clearable && value.length > 0 && !disabled;

  const clear = useCallback(() => {
    setValue([]);
    setAnnouncement(clearedAnnouncement);
    // The clear chip is about to unmount under the focus; hand focus to the first chip
    // so the keyboard user stays inside the group instead of falling back to <body>.
    groupRef.current?.querySelector<HTMLElement>("[data-chip]:not([data-disabled])")?.focus();
  }, [setValue, clearedAnnouncement]);

  return (
    <SizeContext value={size}>
      <ToggleGroup
        ref={setGroupRef}
        multiple={multiple}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          setAnnouncement("");
        }}
        disabled={disabled}
        data-size={size}
        className={cn("flex min-w-0 flex-wrap items-center", size === "sm" ? "gap-1.5" : "gap-2", className)}
        {...rest}
      >
        {children}
        <AnimatePresence initial={false}>
          {showClear && (
            <motion.button
              key="clear"
              type="button"
              onClick={clear}
              data-size={size}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.9, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.in } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
              className={cn(
                "relative inline-flex shrink-0 select-none items-center rounded-full font-medium text-fg-3",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
                "after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']",
                size === "sm" ? "h-7 gap-1 pl-1.5 pr-2 text-[12px]" : "h-8 gap-1.5 pl-2 pr-2.5 text-[12.5px]",
              )}
            >
              <X size={size === "sm" ? 12 : 14} />
              {clearLabel}
            </motion.button>
          )}
        </AnimatePresence>
      </ToggleGroup>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </SizeContext>
  );
}

export type ChoiceChipProps = Omit<React.ComponentProps<"button">, "value" | "type"> & {
  value: string;
  /** A leading icon. It moves right when the check grows in. */
  icon?: React.ReactNode;
  /** A count shown after the label. Changes roll digit by digit. */
  count?: number;
  disabled?: boolean;
};

export function ChoiceChip({ value, icon, count, disabled, className, children, ...rest }: ChoiceChipProps) {
  const size = use(SizeContext);
  const sm = size === "sm";
  return (
    <Toggle
      value={value}
      disabled={disabled}
      data-chip=""
      data-size={size}
      className={cn(
        "group/chip relative inline-flex min-w-0 max-w-full shrink-0 select-none items-center rounded-full border font-medium tracking-[-0.005em]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale,padding] duration-200 ease-out-expo active:scale-[0.96] active:duration-75",
        "border-line-2 bg-raised text-fg-2 hover:border-fg-4 hover:text-fg",
        "data-pressed:border-fg data-pressed:bg-fg data-pressed:text-frame data-pressed:hover:border-fg/90 data-pressed:hover:bg-fg/90",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        // Reach 44px on touch without changing the drawn size.
        "after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']",
        "motion-reduce:transition-colors",
        sm ? "h-7 pl-2.5 pr-2.5 text-[12px] data-pressed:pl-2" : "h-8 pl-3 pr-3 text-[12.5px] data-pressed:pl-2.5",
        className,
      )}
      {...rest}
    >
      {/* The check lives in a grid track that goes from 0fr to 1fr, so the chip's
          width grows to fit it on a transition that reverses mid-way if pressed again. */}
      <span
        aria-hidden
        className={cn(
          "grid grid-cols-[0fr] transition-[grid-template-columns] duration-[260ms] ease-out-expo group-data-pressed/chip:grid-cols-[1fr] motion-reduce:transition-none",
        )}
      >
        <span className="min-w-0 overflow-hidden">
          <span className={cn("flex items-center", sm ? "w-[17px]" : "w-5")}>
            <svg width={sm ? 12 : 14} height={sm ? 12 : 14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                pathLength={1}
                strokeDasharray="1"
                className="[stroke-dashoffset:1] transition-[stroke-dashoffset] duration-100 ease-out group-data-pressed/chip:[stroke-dashoffset:0] group-data-pressed/chip:delay-75 group-data-pressed/chip:duration-300 motion-reduce:transition-none"
              />
            </svg>
          </span>
        </span>
      </span>
      {icon && (
        <span aria-hidden className={cn("flex shrink-0 items-center text-fg-3 transition-colors group-hover/chip:text-fg-2 group-data-pressed/chip:text-frame/70 [&>svg]:size-[14px]", sm ? "mr-1 [&>svg]:size-3" : "mr-1.5")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
      {count !== undefined && (
        <span className={cn("tabular shrink-0 font-normal text-fg-3 transition-colors group-data-pressed/chip:text-frame/60", sm ? "ml-1" : "ml-1.5")}>
          <NumberFlow value={count} />
        </span>
      )}
    </Toggle>
  );
}
