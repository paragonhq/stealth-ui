"use client";
import { Meter } from "@base-ui/react/meter";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Loader, X } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type TrialTone = "calm" | "urgent" | "ended";

/** Whole days from `now` until `end`, counting today as 0. Negative once the trial is over. Call it in an effect or on the server, never during render with Date.now(). */
export function daysUntil(end: Date, now: Date) {
  const day = 86_400_000;
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / day);
}

export type TrialBannerProps = Omit<React.ComponentProps<"section">, "title"> & {
  /** Days until the trial ends: 0 is today, below 0 is over. */
  daysLeft: number;
  /** Length of the trial in days. */
  totalDays: number;
  /** The plan being trialled, named in the message. */
  plan?: string;
  /** The end date, already formatted: "Sep 27". Shown beside the countdown. */
  endsOn?: string;
  /** One line under the message: what they keep by upgrading. */
  description?: React.ReactNode;
  /** Days left at which the banner turns urgent. */
  urgentAt?: number;
  /** "bar" spans the top of a page; "card" sits in a sidebar. */
  variant?: "bar" | "card";
  upgradeLabel?: string;
  /** Return a promise to show progress on the button. */
  onUpgrade?: () => void | Promise<unknown>;
  /** Visible, controlled. Dismissing is only offered while the trial is calm. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dismissible?: boolean;
  /** Where keyboard focus goes after dismissing, since the dismiss button disappears with the banner. */
  returnFocus?: React.RefObject<HTMLElement | null>;
};

export function TrialBanner({
  daysLeft,
  totalDays,
  plan,
  endsOn,
  description,
  urgentAt = 2,
  variant = "bar",
  upgradeLabel,
  onUpgrade,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  dismissible = true,
  returnFocus,
  className,
  ...rest
}: TrialBannerProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const reduce = useReducedMotion();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const tone: TrialTone = daysLeft < 0 ? "ended" : daysLeft <= urgentAt ? "urgent" : "calm";
  const card = variant === "card";
  const name = plan ? `${plan} trial` : "trial";
  const used = Math.min(totalDays, Math.max(0, totalDays - Math.max(0, daysLeft)));
  // A reminder put away while calm comes back by itself once the trial turns urgent.
  const shown = open || tone !== "calm";
  const cta = upgradeLabel ?? (tone === "ended" ? "Choose a plan" : "Upgrade");

  async function upgrade() {
    if (busy) return;
    const result = onUpgrade?.();
    if (!(result instanceof Promise)) return;
    setBusy(true);
    try {
      await result;
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  // The countdown keeps one sentence shape so the number can roll in place.
  const message =
    tone === "ended" ? (
      <>Your {name} has ended</>
    ) : daysLeft === 0 ? (
      <>Your {name} ends today</>
    ) : daysLeft === 1 ? (
      <>Your {name} ends tomorrow</>
    ) : (
      <>
        Your {name} ends in <NumberFlow value={daysLeft} className="tabular" /> days
      </>
    );

  return (
    <AnimatePresence initial={false}>
      {shown && (
        <motion.section
          key="trial"
          aria-labelledby={titleId}
          data-tone={tone}
          data-variant={variant}
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, height: 0, transition: { duration: 0.2, ease: ease.inOut, opacity: { duration: 0.12 } } }}
          transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out }}
          className={cn("@container w-full min-w-0 overflow-hidden", className)}
          {...(rest as React.ComponentProps<typeof motion.section>)}
        >
          <div
            className={cn(
              "border transition-[background-color,border-color] duration-300 ease-out",
              card ? "flex flex-col gap-3 rounded-xl p-3" : "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg py-2 pl-3 pr-2",
              tone === "calm" && "border-line-2 bg-raised",
              tone === "urgent" && "border-warning/25 bg-warning-soft",
              tone === "ended" && "border-danger/25 bg-danger-soft",
            )}
          >
            <div className={cn("flex min-w-0 flex-1 gap-2.5", card ? "items-start" : "items-center")}>
              <ClockGlyph tone={tone} reduce={!!reduce} />
              <div className="min-w-0 flex-1">
                <h3 id={titleId} className="text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg text-balance">
                  {message}
                  {endsOn && tone !== "ended" && !card && <span className="font-normal text-fg-3"> · {endsOn}</span>}
                </h3>
                {(description != null || (card && endsOn && tone !== "ended")) && (
                  <p className="text-[12px] leading-4 text-fg-3 text-pretty">
                    {description ?? `Ends ${endsOn}`}
                  </p>
                )}
              </div>
            </div>

            <DayMeter used={used} total={totalDays} urgentAt={urgentAt} tone={tone} card={card} />

            <div className={cn("flex items-center gap-1", card ? "" : "ml-auto shrink-0")}>
              <button
                type="button"
                onClick={upgrade}
                aria-busy={busy || undefined}
                className={cn(
                  "relative inline-flex h-7 select-none items-center justify-center rounded-md px-2.5 text-[12.5px] font-medium tracking-[-0.005em]",
                  card && "w-full",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  "bg-fg text-frame transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                  busy && "pointer-events-none",
                )}
              >
                <span className={cn("transition-opacity duration-150", busy && "opacity-0")}>{cta}</span>
                {busy && (
                  <span className="absolute inset-0 grid place-items-center">
                    <Loader size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
                    <span className="sr-only">Opening checkout</span>
                  </span>
                )}
              </button>
              {/* Only a calm trial can be put away; an ending one should stay in view. */}
              {dismissible && tone === "calm" && !card && (
                <button
                  type="button"
                  aria-label="Dismiss trial reminder"
                  onClick={() => {
                    setOpen(false);
                    returnFocus?.current?.focus({ preventScroll: true });
                  }}
                  className={cn(
                    "relative grid size-7 place-items-center rounded-md text-fg-3 outline-none",
                    "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

// One segment per trial day, so "5 days left" is five empty cells rather than a percentage.
// Past a month it becomes a plain bar.
function DayMeter({ used, total, urgentAt, tone, card }: { used: number; total: number; urgentAt: number; tone: TrialTone; card: boolean }) {
  const segmented = total <= 31;
  const fill = tone === "calm" ? "bg-fg" : tone === "urgent" ? "bg-warning" : "bg-danger";
  return (
    <Meter.Root
      value={used}
      max={total}
      aria-label="Trial days used"
      getAriaValueText={() => `${used} of ${total} days used`}
      // In a narrow bar the meter drops to its own full-width row under the message; from 36rem it sits inline.
      className={cn("min-w-0", card ? "w-full" : "order-last basis-full pb-1 pl-[26px] pr-1 @xl:order-none @xl:w-32 @xl:shrink-0 @xl:basis-auto @xl:p-0")}
    >
      <Meter.Track className={cn("flex h-1 w-full gap-[2px] overflow-hidden", !segmented && "rounded-full bg-fg/10")}>
        {segmented ? (
          Array.from({ length: total }, (_, i) => {
            const on = i < used;
            // The last urgentAt + 1 days are marked so the deadline is visible before it arrives.
            const late = i >= total - (urgentAt + 1);
            return (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "h-full min-w-0 flex-1 rounded-full transition-colors duration-300 ease-out",
                  on ? fill : late ? "bg-fg/20" : "bg-fg/10",
                )}
              />
            );
          })
        ) : (
          <Meter.Indicator className={cn("rounded-full transition-[width,background-color] duration-300 ease-out", fill)} />
        )}
      </Meter.Track>
    </Meter.Root>
  );
}

// A clock whose hand sweeps once when the trial turns urgent: the moment worth noticing.
function ClockGlyph({ tone, reduce }: { tone: TrialTone; reduce: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-[18px] shrink-0 place-items-center transition-colors duration-300",
        tone === "calm" ? "text-fg-2" : tone === "urgent" ? "text-warning" : "text-danger",
      )}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="5.75" />
        <motion.path
          d="M8 5v3"
          style={{ originX: "50%", originY: "100%" }}
          initial={false}
          animate={{ rotate: tone === "calm" || reduce ? 0 : 360 }}
          transition={{ duration: 0.7, ease: ease.inOut }}
        />
        <path d="M8 8l2 1.25" />
      </svg>
    </span>
  );
}
