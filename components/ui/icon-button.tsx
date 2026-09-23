"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring, swap } from "@/lib/motion";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "ghost" | "secondary";
export type TooltipSide = "top" | "bottom" | "left" | "right";

const sizes: Record<IconButtonSize, string> = {
  sm: "size-7 rounded-md [&_svg]:size-3.5",
  md: "size-8 rounded-lg [&_svg]:size-4",
  lg: "size-9 rounded-lg [&_svg]:size-4",
};

// Inside a ButtonGroup the button becomes a flat segment: the group draws the
// border, shadow, hairlines and the gliding hover wash, and only the icon squashes.
const segment =
  "in-data-[slot=button-group]:rounded-none in-data-[slot=button-group]:border-0 in-data-[slot=button-group]:bg-transparent in-data-[slot=button-group]:shadow-none in-data-[slot=button-group]:hover:bg-transparent in-data-[slot=button-group]:data-popup-open:bg-transparent in-data-[slot=button-group]:active:scale-100 in-data-[slot=button-group]:focus-visible:-outline-offset-3 in-data-[slot=button-group]:focus-visible:rounded-[5px]" + " in-data-[slot=button-group]:active:bg-transparent in-data-[slot=button-group]:transform-none!";

const variants: Record<IconButtonVariant, string> = {
  ghost: "text-fg-2 hover:bg-hover hover:text-fg active:bg-fg/[0.08] data-popup-open:bg-hover data-popup-open:text-fg " + segment,
  secondary:
    "border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover hover:text-fg active:bg-fg/[0.08] data-popup-open:border-fg-4 data-popup-open:bg-hover data-popup-open:text-fg " + segment,
};

/**
 * Wrap a toolbar in this so its tooltips share one warm-up: the first waits
 * ~500ms, the next ones open instantly while the pointer stays in the group.
 */
export function IconButtonProvider({ delay = 500, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <Tooltip.Provider delay={delay} closeDelay={0} timeout={400}>
      {children}
    </Tooltip.Provider>
  );
}

/** A shortcut as keycaps, split on spaces: "⌘ B", "Shift D". */
export function Keys({ keys, className }: { keys: string; className?: string }) {
  return (
    <kbd className={cn("inline-flex items-center gap-0.5 font-sans", className)}>
      {keys.split(" ").map((k, i) => (
        <span
          key={i}
          className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3"
        >
          {k}
        </span>
      ))}
    </kbd>
  );
}

export type ActionTooltipProps = {
  /** What the control does. */
  content: React.ReactNode;
  shortcut?: string;
  side?: TooltipSide;
  /** Milliseconds before opening. Defaults to the provider's, or 600 without one. */
  delay?: number;
  disabled?: boolean;
  /** The trigger. It receives the tooltip's props and ref. */
  children: React.ReactElement;
};

/**
 * The small tooltip every icon-only control carries: grows 4% from the side it's
 * on, never covers its trigger, and is skipped on touch screens.
 */
export function ActionTooltip({ content, shortcut, side = "top", delay, disabled, children }: ActionTooltipProps) {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger delay={delay} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex min-h-6 max-w-64 items-center gap-2 text-balance rounded-md border border-line-2 bg-raised py-1 pl-2 text-[12px] leading-4 text-fg shadow-pop",
              shortcut ? "pr-1" : "pr-2",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
              "data-[side=top]:data-starting-style:translate-y-0.5 data-[side=bottom]:data-starting-style:-translate-y-0.5",
              "data-[side=left]:data-starting-style:translate-x-0.5 data-[side=right]:data-starting-style:-translate-x-0.5",
              // Moving between warm siblings, or opening from the keyboard, is instant.
              "data-instant:duration-0",
            )}
          >
            {content}
            {shortcut && <Keys keys={shortcut} />}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export type IconButtonProps = Omit<React.ComponentProps<"button">, "children" | "aria-label"> & {
  /** What the button does ("Copy link", not "Clipboard"). Its accessible name and its tooltip. */
  label: string;
  /** The icon. */
  children: React.ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /**
   * The tooltip on hover and keyboard focus. `true` shows the label; pass text to
   * say less than the label when the row already names the object ("Download"
   * for a button labeled "Download q3-forecast.xlsx"); `false` for none.
   */
  tooltip?: boolean | React.ReactNode;
  /** A shortcut shown in the tooltip, as space-separated keys: "⌘ D". */
  shortcut?: string;
  tooltipSide?: TooltipSide;
  /** Swaps the icon for a spinner and ignores presses, keeping focus. */
  loading?: boolean;
};

export function IconButton({
  label,
  children,
  size = "md",
  variant = "ghost",
  tooltip = true,
  shortcut,
  tooltipSide = "top",
  loading = false,
  disabled,
  className,
  onClick,
  ref,
  ...rest
}: IconButtonProps) {
  const reduce = useReducedMotion();

  const button = (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={disabled}
      data-size={size}
      data-variant={variant}
      data-busy={loading ? "" : undefined}
      // The squash: a quick press to 92%, then a spring back with a pixel of overshoot.
      // Always an object: Motion adds tabindex for tap gestures, and server and client must agree.
      whileTap={loading || disabled || reduce ? {} : { scale: 0.92, transition: { duration: 0.08 } }}
      transition={spring.bouncy}
      onClick={(e) => {
        if (loading) return e.preventDefault();
        onClick?.(e);
      }}
      className={cn(
        "group/icon relative inline-grid shrink-0 select-none place-items-center outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color] duration-150 ease-out-quart",
        "disabled:pointer-events-none disabled:opacity-50 data-busy:cursor-progress",
        // 44px to a finger, whatever it draws at.
        "pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-1/2",
        sizes[size],
        variants[variant],
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={loading ? "busy" : "icon"}
          aria-hidden
          className="col-start-1 row-start-1 grid place-items-center transition-[scale] duration-100 ease-out-quart in-data-[slot=button-group]:group-active/icon:scale-[0.86]"
          initial={reduce ? { opacity: 0 } : swap.initial}
          // Same resting style either way, so server and client markup agree.
          animate={swap.animate}
          exit={reduce ? { opacity: 0 } : swap.exit}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {loading ? <Spinner /> : children}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );

  if (tooltip === false || tooltip == null) return button;
  return (
    <ActionTooltip content={tooltip === true ? label : tooltip} shortcut={shortcut} side={tooltipSide} disabled={disabled}>
      {button}
    </ActionTooltip>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-[spin_0.7s_linear_infinite]">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
