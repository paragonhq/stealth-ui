"use client";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md";

// Track and thumb geometry in px. The thumb sits 2px in from every edge and
// grows by `stretch` toward the middle while pressed.
const dims = {
  sm: { w: 28, h: 16, thumb: 12, stretch: 3 },
  md: { w: 36, h: 20, thumb: 16, stretch: 4 },
} as const;

export type SwitchProps = Omit<BaseSwitch.Root.Props, "className" | "children" | "onCheckedChange" | "checked" | "defaultChecked"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  /**
   * Called with the next state. Return a promise and the switch moves at once,
   * shows a spinner in its thumb while it waits, and moves back if it rejects.
   */
  onCheckedChange?: (checked: boolean) => void | Promise<unknown>;
  /** Called when a returned promise rejects, after the switch has moved back. */
  onError?: (error: unknown) => void;
  /** Show the spinner and ignore input, for state you are loading yourself. */
  loading?: boolean;
  size?: Size;
  /** A tick and a ring inside the track, so on and off don't rely on position alone. */
  icons?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Applied to the row when there is a label, otherwise to the track. */
  className?: string;
};

/** Spinner timing: nothing for the first 150ms, then at least 300ms once shown. */
function useDelayedBusy(busy: boolean) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (busy) {
      const t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, 150);
      return () => window.clearTimeout(t);
    }
    const left = Math.max(0, 300 - (performance.now() - since.current));
    const t = window.setTimeout(() => setShown(false), left);
    return () => window.clearTimeout(t);
  }, [busy]);
  return shown;
}

export function Switch({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  onError,
  loading = false,
  size = "md",
  icons = false,
  label,
  description,
  disabled,
  readOnly,
  className,
  "aria-describedby": describedBy,
  onKeyDown,
  onKeyUp,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  ...rest
}: SwitchProps) {
  const reduce = useReducedMotion();
  const descriptionId = useId();
  const [checked, setChecked] = useControllableState({ value: checkedProp, defaultValue: defaultChecked });
  // While a returned promise is in flight, this is what the switch shows.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pressed, setPressed] = useState(false);
  const pending = optimistic !== null;
  const busy = loading || pending;
  const spinning = useDelayedBusy(busy);
  const on = optimistic ?? checked;
  const idle = !disabled && !readOnly && !busy;

  const d = dims[size];
  const width = d.thumb + (pressed && idle ? d.stretch : 0);
  const x = on ? d.w - 2 - width : 2;

  const handleChange = (next: boolean) => {
    const result = onCheckedChange?.(next);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setOptimistic(next);
      (result as Promise<unknown>).then(
        () => {
          setChecked(next);
          setOptimistic(null);
        },
        (error) => {
          setOptimistic(null);
          onError?.(error);
        },
      );
    } else {
      setChecked(next);
    }
  };

  // With a label the whole row is the target, so the row tracks the press; alone, the track does.
  // Your own pointer handlers still run on the track either way.
  const press = {
    onPointerDown: (e: React.PointerEvent) => e.button === 0 && setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
  };
  type TrackProps = BaseSwitch.Root.Props;
  const trackPointer: Pick<TrackProps, "onPointerDown" | "onPointerUp" | "onPointerLeave" | "onPointerCancel"> = {
    onPointerDown: (e) => {
      onPointerDown?.(e);
      if (label == null) press.onPointerDown(e);
    },
    onPointerUp: (e) => {
      onPointerUp?.(e);
      if (label == null) press.onPointerUp();
    },
    onPointerLeave: (e) => {
      onPointerLeave?.(e);
      if (label == null) press.onPointerLeave();
    },
    onPointerCancel: (e) => {
      onPointerCancel?.(e);
      if (label == null) press.onPointerCancel();
    },
  };

  const track = (
    <BaseSwitch.Root
      checked={on}
      onCheckedChange={handleChange}
      disabled={disabled}
      readOnly={readOnly || busy}
      aria-busy={busy || undefined}
      aria-describedby={cn(describedBy, description != null && descriptionId) || undefined}
      data-size={size}
      data-pending={busy || undefined}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === " ") setPressed(true);
      }}
      onKeyUp={(e) => {
        onKeyUp?.(e);
        setPressed(false);
      }}
      onBlur={(e) => {
        onBlur?.(e);
        setPressed(false);
      }}
      {...trackPointer}
      className={cn(
        "relative inline-block shrink-0 rounded-full outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color] duration-200 ease-out-expo motion-reduce:transition-none",
        size === "sm" ? "h-4 w-7" : "h-5 w-9",
        on ? "bg-fg" : "bg-fg-4",
        idle && (on ? "hover:bg-fg/90 group-hover/switch:bg-fg/90" : "hover:bg-fg-3 group-hover/switch:bg-fg-3"),
        disabled && "cursor-not-allowed",
        // Touch: grow the target to 44px when the track stands alone.
        label == null && "after:absolute after:content-['']",
        label == null && (size === "sm" ? "after:-inset-x-2 after:-inset-y-3.5" : "after:-inset-x-1 after:-inset-y-3"),
        label == null && disabled && "opacity-50",
        label == null && className,
      )}
      {...rest}
    >
      {icons && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-between px-[5px]">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("text-frame transition-opacity duration-150", size === "sm" ? "size-2" : "size-2.5", on ? "opacity-100" : "opacity-0")}
          >
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={cn("text-fg-2 transition-opacity duration-150", size === "sm" ? "size-2" : "size-2.5", on ? "opacity-0" : "opacity-100")}
          >
            <circle cx="8" cy="8" r="5" />
          </svg>
        </span>
      )}
      <motion.span
        aria-hidden
        className={cn(
          "absolute left-0 top-0.5 grid place-items-center rounded-full transition-[background-color] duration-200 motion-reduce:transition-none",
          // Off, the thumb is the lightest thing on the track; on, it inverts with it.
          on ? "bg-frame" : "bg-raised dark:bg-fg-2",
        )}
        style={{ height: d.thumb }}
        initial={false}
        animate={{ x, width }}
        transition={reduce ? { duration: 0 } : spring.snappy}
      >
        <AnimatePresence initial={false}>
          {spinning && (
            <motion.span
              key="spin"
              className="absolute grid place-items-center"
              initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: ease.out }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                // Contrast against the thumb in both states: the off thumb is fg-2 in dark mode.
                className={cn("animate-spin-slow", on ? "text-fg-2" : "text-fg-3 dark:text-frame", size === "sm" ? "size-2" : "size-2.5")}
              >
                <path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </BaseSwitch.Root>
  );

  if (label == null) return track;

  return (
    <label
      {...press}
      className={cn(
        "group/switch flex select-none items-start justify-between gap-4",
        "has-[[data-disabled]]:opacity-50",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-[13px] leading-5 text-fg">{label}</span>
        {description != null && (
          <span id={descriptionId} className="text-[12.5px] leading-[18px] text-fg-3">
            {description}
          </span>
        )}
      </span>
      <span className="flex h-5 items-center">{track}</span>
    </label>
  );
}
