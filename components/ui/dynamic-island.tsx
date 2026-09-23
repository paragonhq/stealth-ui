"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type DynamicIslandProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Names the live activity. When it changes, the island morphs to the new content. */
  activity?: string;
  /** The resting pill: usually a leading glyph and a trailing value. Nothing renders while it is null. */
  compact: React.ReactNode;
  /** What pressing the island reveals: detail and controls. Leave it out and the island is display-only. */
  detail?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The accessible name, e.g. "Upload in progress". Announced politely when the activity changes. */
  label: string;
  /** absolute sits at the top center of a positioned parent; fixed pins it to the viewport; static leaves it in flow. */
  position?: "absolute" | "fixed" | "static";
};

// The island is always dark, in both themes, like the hardware it's named after.
// It re-scopes the tokens to the dark set, so everything inside uses them as usual.
export function DynamicIsland({
  activity = "default",
  compact,
  detail,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  label,
  position = "absolute",
  className,
  ...rest
}: DynamicIslandProps) {
  const reduce = useReducedMotion();
  const [openState, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const expandable = detail != null;
  const open = openState && expandable && compact != null;
  const id = useId();
  const island = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const view = `${activity}:${open ? "open" : "compact"}`;
  const present = compact != null;

  // Announce a new activity once, not every time its label ticks ("24:12", "24:11"…).
  const [spoken, setSpoken] = useState(present ? label : "");
  const [lastActivity, setLastActivity] = useState(present ? activity : null);
  const current = present ? activity : null;
  if (current !== lastActivity) {
    setLastActivity(current);
    setSpoken(present ? label : "");
  }

  // Measure whatever is showing; the shell springs to it instead of snapping.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, present]);

  // Opened: take focus so Escape and Tab work inside. Closed by keyboard: hand focus back to the pill.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) panel.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current && island.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  // A press anywhere else puts it back.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!island.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, setOpen]);

  const radius = size ? (open ? 26 : size.h / 2) : 999;
  const shell = reduce ? { duration: 0 } : open ? spring.bouncy : spring.snappy;

  return (
    <div
      data-slot="dynamic-island"
      className={cn(
        "flex justify-center @container",
        position === "static" ? "relative w-full" : cn("pointer-events-none inset-x-3 top-3 z-(--z-popover)", position),
        className,
      )}
      {...rest}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {spoken}
      </span>
      {/* An activity already running at page load is just there; only later arrivals animate in. */}
      <AnimatePresence initial={false}>
        {compact != null && (
          <motion.div
            key="island"
            ref={island}
            data-theme="dark"
            data-state={open ? "open" : "compact"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)", width: size?.w ?? "auto", height: size?.h ?? "auto", borderRadius: radius }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.6, filter: "blur(4px)", transition: { duration: 0.2, ease: ease.in } }}
            transition={{ ...(reduce ? { duration: 0.15 } : spring.snappy), width: shell, height: shell, borderRadius: shell }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && open) {
                e.stopPropagation();
                setOpen(false);
              }
            }}
            className="pointer-events-auto relative max-w-full overflow-hidden border border-line-2 bg-page text-fg shadow-pop [color-scheme:dark]"
          >
            <div ref={inner} className="w-max max-w-[calc(100cqw-2px)]">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={view}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.26, ease: ease.out, delay: reduce ? 0 : 0.04 } }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.94, filter: "blur(4px)", transition: { duration: 0.12, ease: ease.in } }}
                >
                  {open ? (
                    <div
                      ref={panel}
                      id={id}
                      role="group"
                      aria-label={label}
                      tabIndex={-1}
                      className="w-[340px] max-w-[calc(100cqw-2px)] p-4 outline-none"
                    >
                      {detail}
                    </div>
                  ) : expandable ? (
                    <motion.button
                      ref={trigger}
                      type="button"
                      aria-expanded={false}
                      aria-label={label}
                      onClick={() => setOpen(true)}
                      whileTap={{ scale: reduce ? 1 : 0.96 }}
                      transition={spring.snappy}
                      className="flex h-9 min-w-[128px] items-center justify-between gap-3 px-2 text-left outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-3 focus-visible:outline-fg-3 rounded-full"
                    >
                      {compact}
                    </motion.button>
                  ) : (
                    <div role="img" aria-label={label} className="flex h-9 min-w-[128px] items-center justify-between gap-3 px-2">
                      {compact}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type DynamicIslandRingProps = Omit<React.ComponentProps<"svg">, "children"> & {
  /** 0 to 1. */
  value: number;
  size?: number;
  /** A color class for the arc, e.g. text-success. Defaults to the foreground. */
  tone?: string;
  children?: React.ReactNode;
};

/** A small progress ring for the compact slots: a timer draining, an upload filling. */
export function DynamicIslandRing({ value, size = 20, tone = "text-fg", className, children, ...rest }: DynamicIslandRingProps) {
  const reduce = useReducedMotion();
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <span className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden {...rest}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={2} className="text-line-2" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={c}
          className={tone}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: ease.out }}
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  );
}
