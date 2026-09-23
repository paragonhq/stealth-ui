"use client";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { createContext, use, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type GroupContextValue = { single: boolean; value: string | null; setValue: (next: string | null) => void };
const GroupContext = createContext<GroupContextValue | null>(null);

type CardContextValue = {
  open: boolean;
  disabled: boolean;
  /** True when the last change came from Escape: keyboard dismissals don't animate. */
  instant: boolean;
  toggle: () => void;
  triggerId: string;
  contentId: string;
};
const CardContext = createContext<CardContextValue | null>(null);
const useCard = () => {
  const ctx = use(CardContext);
  if (!ctx) throw new Error("ExpandableCard parts must be inside <ExpandableCard>");
  return ctx;
};

export type ExpandableCardGroupProps = Omit<React.ComponentProps<"div">, "defaultValue"> & {
  /** One card open at a time. Opening another closes the first. */
  single?: boolean;
  /** The open card's value (single mode). */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
};

/**
 * Cards that share one layout: when one grows, the others glide to their new
 * places instead of jumping. Lays out as a column unless you pass a className.
 */
export function ExpandableCardGroup({ single = true, value, defaultValue = null, onValueChange, className, children, ...rest }: ExpandableCardGroupProps) {
  const [current, setCurrent] = useControllableState<string | null>({ value, defaultValue, onChange: onValueChange });
  return (
    <GroupContext value={{ single, value: current, setValue: setCurrent }}>
      <LayoutGroup>
        <div className={className ?? "flex flex-col gap-2"} {...rest}>
          {children}
        </div>
      </LayoutGroup>
    </GroupContext>
  );
}

export type ExpandableCardProps = Omit<React.ComponentProps<typeof motion.div>, "children"> & {
  children?: React.ReactNode;
  /** Identifies the card inside a single-open group. */
  value?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
};

export function ExpandableCard({ value, open, defaultOpen = false, onOpenChange, disabled = false, className, style, onKeyDown, children, ...rest }: ExpandableCardProps) {
  const group = use(GroupContext);
  const reduce = useReducedMotion();
  const uid = useId();
  const key = value ?? uid;
  const [own, setOwn] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const grouped = !!group?.single;
  const isOpen = grouped ? group.value === key : own;
  const [instant, setInstant] = useState(false);

  const set = (next: boolean, viaKeyboard = false) => {
    if (disabled || next === isOpen) return;
    setInstant(viaKeyboard);
    if (grouped) {
      group.setValue(next ? key : null);
      onOpenChange?.(next);
    } else setOwn(next);
  };

  const ids = { triggerId: `${uid}-trigger`, contentId: `${uid}-content` };

  return (
    <CardContext value={{ open: isOpen, disabled, instant, toggle: () => set(!isOpen), ...ids }}>
      <motion.div
        // Position and size changes caused by other cards (or a grid span) glide; this card's own growth is its height, below.
        layout
        transition={reduce || instant ? { duration: 0 } : spring.soft}
        data-state={isOpen ? "open" : "closed"}
        data-disabled={disabled || undefined}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key !== "Escape" || !isOpen || e.defaultPrevented) return;
          // Escape closes the innermost open card only, at once, and hands focus back to its trigger.
          e.preventDefault();
          e.stopPropagation();
          set(false, true);
          document.getElementById(ids.triggerId)?.focus();
        }}
        // Radius in style so Motion can keep the corners round while it scales the box.
        style={{ borderRadius: 12, ...style }}
        className={cn(
          "group/card relative min-w-0 overflow-hidden border border-line-2 bg-raised shadow-[var(--shadow)]",
          "transition-[border-color,scale] duration-150 ease-out",
          "has-[[data-expandable-trigger]:hover]:border-fg-4 data-disabled:has-[[data-expandable-trigger]:hover]:border-line-2",
          "has-[[data-expandable-trigger]:active]:scale-[0.99] motion-reduce:has-[[data-expandable-trigger]:active]:scale-100",
          "has-[[data-expandable-trigger]:focus-visible]:outline-solid has-[[data-expandable-trigger]:focus-visible]:outline-1 has-[[data-expandable-trigger]:focus-visible]:outline-offset-2 has-[[data-expandable-trigger]:focus-visible]:outline-fg-3",
          "data-disabled:opacity-60",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.div>
    </CardContext>
  );
}

export type ExpandableCardTriggerProps = Omit<React.ComponentProps<"button">, "type"> & {
  /** Show the chevron at the end of the row. */
  indicator?: boolean;
};

/** The summary row. Press it to open; press it again (or Escape) to close. */
export function ExpandableCardTrigger({ indicator = true, className, children, onClick, ...rest }: ExpandableCardTriggerProps) {
  const { open, disabled, toggle, triggerId, contentId } = useCard();
  return (
    <motion.button
      layout="position"
      type="button"
      id={triggerId}
      data-expandable-trigger=""
      aria-expanded={open}
      aria-controls={contentId}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) toggle();
      }}
      className={cn(
        "group/trigger flex w-full min-w-0 select-none items-center gap-3 p-4 text-left outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">{children}</span>
      {indicator && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn(
            "shrink-0 text-fg-3 transition-[rotate,color] duration-[260ms] ease-in-out-quart motion-reduce:transition-none group-hover/trigger:text-fg",
            open && "rotate-180",
          )}
        >
          <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
        </svg>
      )}
    </motion.button>
  );
}

export type ExpandableCardContentProps = React.ComponentProps<"div">;

/**
 * The details. Height grows on a soft spring, pushing the cards below along with it;
 * the content fades up once there is room, and leaves before the height closes over it.
 */
export function ExpandableCardContent({ className, children, ...rest }: ExpandableCardContentProps) {
  const { open, instant, contentId, triggerId } = useCard();
  const reduce = useReducedMotion();
  const still = reduce || instant;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          initial={{ height: 0 }}
          animate={{ height: "auto", transition: still ? { duration: 0 } : spring.soft }}
          exit={{ height: 0, transition: still ? { duration: 0 } : { duration: 0.22, ease: ease.inOut } }}
          className="overflow-hidden"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: still ? { duration: 0 } : { duration: 0.26, ease: ease.out, delay: 0.06 } }}
            exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
            className={cn("px-4 pb-4", className)}
            {...(rest as React.ComponentProps<typeof motion.div>)}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
