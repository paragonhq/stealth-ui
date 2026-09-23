"use client";
import { Toggle } from "@base-ui/react/toggle";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useId } from "react";
import { ActionTooltip, type TooltipSide } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { ease, spring, swap } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const PressedContext = createContext(false);
/** Whether the surrounding ToggleButton is on. For drawing your own glyph that reacts. */
export const useTogglePressed = () => useContext(PressedContext);

export type ToggleButtonProps = Omit<React.ComponentProps<"button">, "value" | "defaultValue" | "onChange" | "className"> & {
  className?: string;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /**
   * Makes it an icon-only square: the label becomes its accessible name and its
   * tooltip. Leave it out to show children (an icon and a word) as the label.
   */
  label?: string;
  /** Tooltip text when it should say less than the label; false for none. */
  tooltip?: boolean | React.ReactNode;
  shortcut?: string;
  tooltipSide?: TooltipSide;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "secondary";
  children: React.ReactNode;
};

const box = {
  sm: { square: "size-7 rounded-md", wide: "h-7 gap-1.5 rounded-md px-2 has-[svg]:pl-1.5", text: "text-[12px] [&_svg]:size-3.5" },
  md: { square: "size-8 rounded-lg", wide: "h-8 gap-1.5 rounded-lg px-2.5 has-[svg]:pl-2", text: "text-[12.5px] [&_svg]:size-4" },
  lg: { square: "size-9 rounded-lg", wide: "h-9 gap-2 rounded-lg px-3 has-[svg]:pl-2.5", text: "text-[13px] [&_svg]:size-4" },
};

const looks = {
  ghost: "text-fg-2 hover:bg-hover hover:text-fg data-pressed:bg-fg/[0.08] data-pressed:text-fg",
  secondary:
    "border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover hover:text-fg data-pressed:border-fg-4 data-pressed:bg-hover data-pressed:text-fg",
};

/**
 * A button that stays on: bold, pin, bookmark, mute. The label never changes with
 * the state (aria-pressed says it); the icon does, with a small morph of its own.
 */
export function ToggleButton({
  pressed: pressedProp,
  defaultPressed = false,
  onPressedChange,
  label,
  tooltip = true,
  shortcut,
  tooltipSide = "top",
  size = "md",
  variant = "ghost",
  disabled,
  className,
  children,
  ...rest
}: ToggleButtonProps) {
  const [pressed, setPressed] = useControllableState({ value: pressedProp, defaultValue: defaultPressed, onChange: onPressedChange });
  const iconOnly = label !== undefined;
  const s = box[size];

  const toggle = (
    <Toggle
      pressed={pressed}
      onPressedChange={(next) => setPressed(next)}
      disabled={disabled}
      aria-label={label}
      data-size={size}
      data-variant={variant}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em] outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart active:duration-75",
        iconOnly ? "active:scale-[0.93]" : "active:scale-[0.97]",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        iconOnly && "pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-1/2",
        iconOnly ? s.square : s.wide,
        s.text,
        looks[variant],
        className,
      )}
      {...(rest as Toggle.Props)}
    >
      <PressedContext.Provider value={pressed}>{children}</PressedContext.Provider>
    </Toggle>
  );

  if (!iconOnly || tooltip === false || tooltip == null) return toggle;
  return (
    <ActionTooltip content={tooltip === true ? label : tooltip} shortcut={shortcut} side={tooltipSide} disabled={disabled}>
      {toggle}
    </ActionTooltip>
  );
}

// ─── Glyphs ─────────────────────────────────────────────────────────────────
// Each reads the pressed state from the button around it. Same 16px grid and
// 1.4 stroke as the rest of the icon set.

const svg = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** Pops on the way on, dips on the way off. Resting values are the same with or without reduced motion. */
function usePop(on: boolean, amount = 1.2) {
  const reduce = useReducedMotion();
  if (reduce) return { animate: { scale: 1, rotate: 0 }, transition: { duration: 0 } };
  return on
    ? { animate: { scale: [1, amount, 1] }, transition: { duration: 0.34, times: [0, 0.35, 1], ease: ease.out } }
    : { animate: { scale: [1, 0.86, 1] }, transition: { duration: 0.22, times: [0, 0.4, 1], ease: ease.out } };
}

/** Outline to filled: the fill drops in from the top like a ribbon, then the mark pops. */
export function BookmarkGlyph() {
  const on = useTogglePressed();
  const reduce = useReducedMotion();
  const id = useId();
  const d = "M4.25 2.75h7.5v10.5L8 10.75l-3.75 2.5z";
  return (
    <motion.svg {...svg} initial={false} {...usePop(on)}>
      <clipPath id={`${id}-clip`}>
        <motion.rect
          x="0"
          y="0"
          width="16"
          initial={false}
          animate={{ height: on ? 16 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: on ? 0.26 : 0.16, ease: ease.out }}
        />
      </clipPath>
      <path d={d} fill="currentColor" stroke="none" clipPath={`url(#${id}-clip)`} />
      <path d={d} />
    </motion.svg>
  );
}

/** The fill springs out from the center while the star gives a small twist. */
export function StarGlyph() {
  const on = useTogglePressed();
  const reduce = useReducedMotion();
  const d = "m8 2.25 1.75 3.6 3.95.55-2.85 2.8.7 3.95L8 11.3l-3.55 1.85.7-3.95L2.3 6.4l3.95-.55z";
  const pop = usePop(on, 1.18);
  const twist = !reduce && on ? { rotate: [0, -16, 0] } : { rotate: 0 };
  return (
    <motion.svg {...svg} initial={false} animate={{ ...pop.animate, ...twist }} transition={pop.transition}>
      <motion.path
        d={d}
        fill="currentColor"
        stroke="none"
        style={{ transformBox: "fill-box", transformOrigin: "50% 55%" }}
        initial={false}
        animate={{ scale: on ? 1 : 0.3, opacity: on ? 1 : 0 }}
        transition={reduce ? { duration: 0.12 } : on ? spring.bouncy : { duration: 0.14, ease: ease.out }}
      />
      <path d={d} />
    </motion.svg>
  );
}

/** Fills from the center on a spring with a single beat. */
export function HeartGlyph() {
  const on = useTogglePressed();
  const reduce = useReducedMotion();
  const d = "M8 13.25S2.25 10 2.25 6.1A2.85 2.85 0 0 1 8 4.9a2.85 2.85 0 0 1 5.75 1.2C13.75 10 8 13.25 8 13.25z";
  return (
    <motion.svg {...svg} initial={false} {...usePop(on, 1.26)}>
      <motion.path
        d={d}
        fill="currentColor"
        stroke="none"
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        initial={false}
        animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
        transition={reduce ? { duration: 0.12 } : on ? spring.bouncy : { duration: 0.14, ease: ease.out }}
      />
      <path d={d} />
    </motion.svg>
  );
}

/** Tilted and hollow when loose; swings upright and fills when pinned. */
export function PinGlyph() {
  const on = useTogglePressed();
  const reduce = useReducedMotion();
  const body = "M6.25 2.75h3.5v3.1l2 2.65h-7.5l2-2.65z";
  return (
    <svg {...svg}>
      <motion.g
        style={{ transformBox: "view-box", transformOrigin: "8px 8px" }}
        initial={false}
        animate={{ rotate: on ? 0 : 40, y: on ? 0.5 : 0 }}
        transition={reduce ? { duration: 0 } : spring.snappy}
      >
        <motion.path
          d={body}
          fill="currentColor"
          stroke="none"
          initial={false}
          animate={{ opacity: on ? 1 : 0 }}
          transition={{ duration: reduce ? 0.12 : 0.18, ease: ease.out }}
        />
        <path d={body} />
        <path d="M8 8.5v4.75" />
      </motion.g>
    </svg>
  );
}

/** Pressed means muted: the waves retract into the speaker and a cross draws in. */
export function MuteGlyph() {
  const on = useTogglePressed();
  const reduce = useReducedMotion();
  const wave = (delay: number) => ({
    initial: false as const,
    animate: { pathLength: on ? 0 : 1, opacity: on ? 0 : 1 },
    transition: reduce ? { duration: 0.12 } : { duration: on ? 0.16 : 0.26, delay: on ? 0 : delay, ease: ease.out },
  });
  const cross = (delay: number) => ({
    initial: false as const,
    animate: { pathLength: on ? 1 : 0, opacity: on ? 1 : 0 },
    transition: reduce ? { duration: 0.12 } : { duration: on ? 0.22 : 0.12, delay: on ? delay : 0, ease: ease.out },
  });
  return (
    <svg {...svg}>
      <path d="M7.5 3.25 4.6 5.6H2.6v4.8h2l2.9 2.35z" />
      <motion.path d="M10 6.2a2.6 2.6 0 0 1 0 3.6" {...wave(0.04)} />
      <motion.path d="M12 4.4a5.2 5.2 0 0 1 0 7.2" {...wave(0.1)} />
      <motion.path d="m10.25 6.4 3.2 3.2" {...cross(0.08)} />
      <motion.path d="m13.45 6.4-3.2 3.2" {...cross(0.16)} />
    </svg>
  );
}

/** Any two icons, swapped in place with a small pop. */
export function ToggleIcon({ off, on: onIcon }: { off: React.ReactNode; on: React.ReactNode }) {
  const on = useTogglePressed();
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="grid size-4 place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
      <AnimatePresence initial={false}>
        <motion.span
          key={on ? "on" : "off"}
          className="grid place-items-center"
          initial={reduce ? { opacity: 0 } : swap.initial}
          animate={swap.animate}
          exit={reduce ? { opacity: 0 } : swap.exit}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {on ? onIcon : off}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
