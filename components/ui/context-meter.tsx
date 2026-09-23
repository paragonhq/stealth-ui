"use client";
import NumberFlow from "@number-flow/react";
import { Meter } from "@base-ui/react/meter";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Loader, Warning } from "@/lib/icons";
import { ease } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

export type ContextSegment = {
  id: string;
  /** "System", "Messages", "Files", "Tools"… */
  label: string;
  tokens: number;
};

export type ContextLevel = "ok" | "warn" | "full";

/** 68400 → "68.4K", 200000 → "200K", 1048576 → "1M". The same on server and client. */
export function formatTokens(n: number) {
  const abs = Math.abs(n);
  const fmt = (v: number, unit: string) => `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;
  if (abs >= 1e6) return fmt(n / 1e6, "M");
  if (abs >= 1e3) return fmt(n / 1e3, "K");
  return String(Math.round(n));
}

/** Where usage stands against the thresholds. */
export function contextLevel(used: number, limit: number, warnAt = 0.8, fullAt = 0.95): ContextLevel {
  const r = limit > 0 ? used / limit : 0;
  return r >= fullAt ? "full" : r >= warnAt ? "warn" : "ok";
}

// Segments stack from strongest to faintest, so the eye reads them in order.
const shades = ["bg-fg", "bg-fg/60", "bg-fg/35", "bg-fg/20"];
const compact = { notation: "compact", maximumFractionDigits: 1 } as const;

/* -------------------------------------------------------------------------------------------------
 * Meter
 * -----------------------------------------------------------------------------------------------*/

export type ContextMeterProps = {
  segments: ContextSegment[];
  /** The model's context window, in tokens. */
  limit: number;
  variant?: "ring" | "bar";
  /** Fraction of the window where it starts warning. */
  warnAt?: number;
  /** Fraction where it counts as full: older context starts being dropped or summarized. */
  fullAt?: number;
  /** Show the percentage beside the ring or bar. */
  showLabel?: boolean;
  /** Offer to summarize older messages once it warns. */
  onCompact?: () => void | Promise<unknown>;
  /** Controlled busy state for compacting, if it happens elsewhere. */
  compacting?: boolean;
  /** What happens at the limit, in one sentence. */
  fullHint?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  container?: Popover.Portal.Props["container"];
  className?: string;
};

export function ContextMeter({
  segments,
  limit,
  variant = "ring",
  warnAt = 0.8,
  fullAt = 0.95,
  showLabel = true,
  onCompact,
  compacting: compactingProp,
  fullHint = "Older messages will be summarized to make room.",
  side = "top",
  align = "end",
  container,
  className,
}: ContextMeterProps) {
  const reduce = !!useReducedMotion();
  const used = segments.reduce((sum, s) => sum + Math.max(0, s.tokens), 0);
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const pct = Math.round(ratio * 100);
  const level = contextLevel(used, limit, warnAt, fullAt);
  const [pending, setPending] = useState(false);
  const compacting = compactingProp ?? pending;

  // Crossing into a new level plays one soft ring, once. Going back down plays nothing.
  const rank = { ok: 0, warn: 1, full: 2 }[level];
  const [seen, setSeen] = useState({ level, pulse: 0 });
  if (seen.level !== level) setSeen({ level, pulse: rank > { ok: 0, warn: 1, full: 2 }[seen.level] ? seen.pulse + 1 : seen.pulse });

  const summary = `${formatTokens(used)} of ${formatTokens(limit)} tokens, ${pct}% used`;

  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={200}
        closeDelay={120}
        aria-label={`Context window: ${summary}`}
        data-level={level}
        data-variant={variant}
        className={cn(
          "group/meter relative inline-flex h-7 shrink-0 select-none items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium tabular text-fg-3 outline-none",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg-2 active:scale-[0.96] active:duration-75",
          "data-popup-open:bg-hover data-popup-open:text-fg-2",
          "data-[level=warn]:text-warning data-[level=full]:text-danger",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden motion-reduce:active:scale-100",
          className,
        )}
      >
        {variant === "ring" ? <Ring ratio={ratio} level={level} pulse={seen.pulse} reduce={reduce} /> : <Bar ratio={ratio} />}
        {showLabel && (
          <span aria-hidden className="min-w-[3ch] text-right">
            <NumberFlow value={pct} suffix="%" animated={!reduce} locales="en-US" className="tabular" />
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal container={container}>
        <Popover.Positioner side={side} align={align} sideOffset={8} collisionPadding={12} className="z-(--z-popover)">
          <Popover.Popup
            className={cn(
              "w-[min(18.5rem,calc(100vw-24px))] origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-3 text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-160 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1",
              "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
            )}
          >
            <Meter.Root value={used} min={0} max={limit} getAriaValueText={() => summary} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <Meter.Label render={<Popover.Title />} className="text-[13px] font-medium tracking-[-0.01em]">
                  Context window
                </Meter.Label>
                <span className={cn("text-[12px] font-medium tabular", level === "ok" ? "text-fg-2" : level === "warn" ? "text-warning" : "text-danger")}>
                  <NumberFlow value={pct} suffix="%" animated={!reduce} locales="en-US" className="tabular" />
                </span>
              </div>
              <Popover.Description className="-mt-2 text-[12px] tabular text-fg-3">
                <NumberFlow value={used} format={compact} animated={!reduce} locales="en-US" className="tabular" /> of {formatTokens(limit)} tokens
              </Popover.Description>

              {/* One bar, a segment per kind of context, with the free space left as track. */}
              <Meter.Track className="relative flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-fg/[0.08]">
                {segments.map((s, i) => (
                  <span
                    key={s.id}
                    aria-hidden
                    className={cn("h-full shrink-0 transition-[width] duration-500 ease-out-quart motion-reduce:transition-none", shades[Math.min(i, shades.length - 1)])}
                    style={{ width: `${(Math.max(0, s.tokens) / limit) * 100}%` }}
                  />
                ))}
                {/* The threshold, marked on the track so "near the limit" has a place. */}
                <span aria-hidden className="absolute inset-y-0 w-px bg-warning/70" style={{ left: `${fullAt * 100}%` }} />
              </Meter.Track>

              <ul className="flex flex-col gap-1 text-[12px]">
                {segments.map((s, i) => (
                  <li key={s.id} className={cn("flex items-center gap-2", s.tokens <= 0 && "opacity-50")}>
                    <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", shades[Math.min(i, shades.length - 1)])} />
                    <span className="min-w-0 flex-1 truncate text-fg-2">{s.label}</span>
                    <span className="tabular text-fg">{formatTokens(s.tokens)}</span>
                    <span className="w-9 text-right tabular text-fg-4">{limit ? Math.round((s.tokens / limit) * 100) : 0}%</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 border-t border-line pt-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px] border border-line-2" />
                  {used > limit ? (
                    // Past the window, the honest number is how far over it is.
                    <>
                      <span className="min-w-0 flex-1 text-danger">Over the limit by</span>
                      <span className="tabular text-danger">{formatTokens(used - limit)}</span>
                      <span className="w-9" />
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 text-fg-3">Free</span>
                      <span className="tabular text-fg-2">{formatTokens(limit - used)}</span>
                      <span className="w-9 text-right tabular text-fg-4">{100 - pct}%</span>
                    </>
                  )}
                </li>
              </ul>
            </Meter.Root>

            <AnimatePresence initial={false}>
              {level !== "ok" && (
                <motion.div
                  key="warning"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.in } }}
                  transition={{ duration: 0.24, ease: ease.out }}
                  className="overflow-hidden"
                >
                  <div className={cn("mt-3 flex flex-col gap-2 rounded-lg p-2.5 text-[12px] leading-[1.45]", level === "warn" ? "bg-warning-soft" : "bg-danger-soft")}>
                    <p className="flex gap-2">
                      <Warning size={14} className={cn("mt-px shrink-0", level === "warn" ? "text-warning" : "text-danger")} />
                      <span className="text-fg-2">
                        <span className="font-medium text-fg">{level === "warn" ? "Nearing the limit." : "Context is full."}</span> {fullHint}
                      </span>
                    </p>
                    {onCompact && (
                      <button
                        type="button"
                        aria-busy={compacting || undefined}
                        onClick={() => {
                          if (compacting) return;
                          const r = onCompact();
                          if (r && typeof (r as Promise<unknown>).then === "function") {
                            setPending(true);
                            (r as Promise<unknown>).finally(() => setPending(false));
                          }
                        }}
                        className={cn(
                          "relative ms-6 inline-grid h-7 w-fit place-items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                          "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
                          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 aria-busy:cursor-progress",
                        )}
                      >
                        {/* Both labels share one cell, so the button keeps its width while busy. */}
                        <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", compacting && "opacity-0")}>Summarize older messages</span>
                        <span aria-hidden={!compacting} className={cn("col-start-1 row-start-1 flex items-center gap-1.5 transition-opacity duration-150", !compacting && "opacity-0")}>
                          <Loader size={14} className="animate-spin-slow" />
                          Summarizing…
                        </span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Glyphs
 * -----------------------------------------------------------------------------------------------*/

function Ring({ ratio, level, pulse, reduce }: { ratio: number; level: ContextLevel; pulse: number; reduce: boolean }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-4 place-items-center">
      <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden className="-rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth={2} className="stroke-fg/15" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          // A sliver always shows once anything is used, so a new chat still reads as a meter.
          strokeDashoffset={c * (1 - Math.max(ratio, ratio > 0 ? 0.04 : 0))}
          className={cn(
            "transition-[stroke-dashoffset,color] duration-600 ease-out-quart motion-reduce:transition-none",
            level === "ok" ? "text-fg-2" : level === "warn" ? "text-warning" : "text-danger",
          )}
        />
      </svg>
      {/* Crossing a threshold rings once, like a soft bell, then stays quiet. */}
      <AnimatePresence>
        {pulse > 0 && !reduce && (
          <motion.span
            key={pulse}
            aria-hidden
            className={cn("pointer-events-none absolute inset-0 rounded-full border-2", level === "full" ? "border-danger" : "border-warning")}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 0.9, ease: ease.out }}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

function Bar({ ratio }: { ratio: number }) {
  return (
    <span className="relative h-1 w-12 overflow-hidden rounded-full bg-fg/15">
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-current transition-[width] duration-500 ease-out-quart motion-reduce:transition-none"
        style={{ width: `${Math.max(ratio, ratio > 0 ? 0.03 : 0) * 100}%` }}
      />
    </span>
  );
}
