"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type Status = "online" | "away" | "busy" | "offline";
type Size = "sm" | "md" | "lg";

export const statusLabels: Record<Status, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

const tones: Record<Status, string> = {
  online: "text-success",
  away: "text-warning",
  busy: "text-danger",
  offline: "text-fg-3",
};

const px: Record<Size, number> = { sm: 8, md: 10, lg: 12 };

// Each status has its own shape, cut out of a 12-unit disc, so it never rests
// on color alone: online is solid, away a crescent, busy a bar, offline a ring.
// Switching status morphs one shape into the next instead of swapping icons.
const cuts: Record<Status, { hole: number; moon: number; bar: number }> = {
  online: { hole: 0, moon: 0, bar: 0 },
  away: { hole: 0, moon: 4.1, bar: 0 },
  busy: { hole: 0, moon: 0, bar: 6.4 },
  offline: { hole: 3.1, moon: 0, bar: 0 },
};

export type StatusDotProps = Omit<React.ComponentProps<"span">, "children"> & {
  status: Status;
  size?: Size;
  /** A soft ring that keeps breathing out, for live states: in a call, recording, streaming. Pauses off screen. */
  ping?: boolean;
  /** Show the status word beside the dot. */
  showLabel?: boolean;
  /** Override the words, e.g. { busy: "Do not disturb" }. */
  labels?: Partial<Record<Status, string>>;
  /** Extra detail on hover, like "Back at 2:30 PM". Also read out as part of the accessible name. */
  tooltip?: string;
  /** Draw a cutout ring so the dot sits cleanly on an avatar. Color comes from --dot-cutout (default --frame). */
  ring?: boolean;
};

export function StatusDot({
  status,
  size = "md",
  ping = false,
  showLabel = false,
  labels,
  tooltip,
  ring = false,
  className,
  ...rest
}: StatusDotProps) {
  const reduce = useReducedMotion();
  const words = { ...statusLabels, ...labels };
  const word = words[status];
  const mask = `status-dot-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const live = ping && status !== "offline";
  const cut = cuts[status];
  const d = px[size];
  const morph = reduce ? { duration: 0 } : spring.snappy;

  // A breathing ring off screen is wasted work; stop it until it scrolls back.
  useEffect(() => {
    if (!el || !live) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [el, live]);

  const name = tooltip ? `${word}, ${tooltip}` : word;

  const dot = (
    <span
      aria-hidden
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full transition-colors duration-200", tones[status], ring && "shadow-[0_0_0_2px_var(--dot-cutout,var(--frame))]")}
      style={{ width: d, height: d }}
    >
      {live && (
        <span
          className="absolute inset-0 animate-ping-soft rounded-full bg-current motion-reduce:hidden"
          style={{ animationPlayState: onScreen ? "running" : "paused" }}
        />
      )}
      <svg width={d} height={d} viewBox="0 0 12 12" className="relative block overflow-visible">
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="-1" y="-1" width="14" height="14">
            <rect x="-1" y="-1" width="14" height="14" fill="white" />
            <motion.circle cx="6" cy="6" fill="black" initial={false} animate={{ r: cut.hole }} transition={morph} />
            <motion.circle cx="3.1" cy="3.1" fill="black" initial={false} animate={{ r: cut.moon }} transition={morph} />
            <motion.rect y="4.9" height="2.2" rx="1.1" fill="black" initial={false} animate={{ width: cut.bar, x: 6 - cut.bar / 2 }} transition={morph} />
          </mask>
        </defs>
        <circle cx="6" cy="6" r="6" fill="currentColor" mask={`url(#${mask})`} />
      </svg>
    </span>
  );

  const label = showLabel && (
    // Every word shares one grid cell, so the row is as wide as the longest and never shifts.
    <span className="inline-grid text-[12.5px] leading-none text-fg-2">
      {(Object.keys(words) as Status[]).map((s) => (
        <span key={s} aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {words[s]}
        </span>
      ))}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.in } }}
          transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );

  const root = (
    <span
      ref={setEl}
      data-slot="status-dot"
      data-status={status}
      data-size={size}
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : name}
      className={cn("inline-flex items-center gap-1.5 align-middle", className)}
      {...rest}
    >
      {dot}
      {label}
      {showLabel && tooltip && <span className="sr-only">, {tooltip}</span>}
    </span>
  );

  if (!tooltip) return root;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={400} render={root} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex max-w-60 items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] text-fg-2 shadow-pop",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
            )}
          >
            <span className="font-medium text-fg">{word}</span>
            <span aria-hidden className="text-fg-4">·</span>
            <span className="min-w-0 truncate">{tooltip}</span>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
