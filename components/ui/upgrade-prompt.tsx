"use client";
import { Meter } from "@base-ui/react/meter";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Loader, X } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type UpgradePromptProps = Omit<React.ComponentProps<"section">, "title"> & {
  /** What happened, in plain words: "You’ve used all 3 projects on Free". */
  title: React.ReactNode;
  /** Why it matters or what the plan changes, one sentence. */
  description?: React.ReactNode;
  /** The limit that was hit, drawn as a full meter. */
  usage?: { used: number; limit: number; label: React.ReactNode };
  /** The plan that unlocks it. */
  plan: { name: string; price?: React.ReactNode; perks?: React.ReactNode[] };
  /** "card" is a block with the plan's perks; "inline" is one row for lists, tables and toolbars. */
  variant?: "card" | "inline";
  upgradeLabel?: string;
  dismissLabel?: string;
  /** Return a promise to show progress on the button; a rejection is shown beside the actions. */
  onUpgrade?: () => void | Promise<unknown>;
  /** Shown instead of the button once onUpgrade resolves. */
  upgradedLabel?: string;
  errorMessage?: React.ReactNode;
  /** Visible. Set false from "Not now"; control it to bring the prompt back later. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide "Not now" when the limit blocks the task outright. */
  dismissible?: boolean;
  /** Where keyboard focus goes after "Not now" removes the prompt, usually the control that hit the limit. */
  returnFocus?: React.RefObject<HTMLElement | null>;
};

export function UpgradePrompt({
  title,
  description,
  usage,
  plan,
  variant = "card",
  upgradeLabel,
  dismissLabel = "Not now",
  onUpgrade,
  upgradedLabel,
  errorMessage = "Couldn’t open checkout. Try again.",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  dismissible = true,
  returnFocus,
  className,
  ...rest
}: UpgradePromptProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const reduce = useReducedMotion();
  const titleId = useId();
  const errorId = useId();
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "failed">("idle");
  // Clip only while the height animates, so the card's shadow isn't cut off at rest.
  const [clip, setClip] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const label = upgradeLabel ?? `Upgrade to ${plan.name}`;
  const doneLabel = upgradedLabel ?? `You’re on ${plan.name}`;
  const inline = variant === "inline";

  function dismiss() {
    setOpen(false);
    // The button that had focus is about to unmount; hand focus somewhere that still exists.
    returnFocus?.current?.focus({ preventScroll: true });
  }

  async function upgrade() {
    if (status === "busy" || status === "done") return;
    setStatus("busy");
    try {
      await onUpgrade?.();
      if (mounted.current) setStatus("done");
    } catch {
      if (mounted.current) setStatus("failed");
    }
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key="prompt"
          aria-labelledby={titleId}
          data-variant={variant}
          data-state={status}
          // Leaving collapses its own height so whatever sits below closes the gap instead of jumping.
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.98 }}
          animate={{ opacity: 1, height: "auto", scale: 1 }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, height: 0, scale: 0.98, transition: { duration: 0.2, ease: ease.inOut, opacity: { duration: 0.12 } } }
          }
          transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out }}
          onAnimationStart={() => setClip(true)}
          onAnimationComplete={() => setClip(false)}
          className={cn("group/prompt w-full min-w-0 origin-top", clip && "overflow-hidden", className)}
          {...(rest as React.ComponentProps<typeof motion.section>)}
        >
          <div
            className={cn(
              "rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]",
              inline ? "flex flex-wrap items-center gap-x-3 gap-y-2 py-2 pl-3 pr-2" : "flex flex-col gap-4 p-4",
            )}
          >
            <div className={cn("flex min-w-0 gap-3", inline ? "min-w-[min(15rem,100%)] flex-1 items-center" : "items-start")}>
              <LockBadge open={status === "done"} small={inline} />
              <div className="min-w-0 flex-1">
                <h3
                  id={titleId}
                  className={cn("font-medium tracking-[-0.01em] text-fg text-balance", inline ? "text-[13px] leading-[18px]" : "text-[14px] leading-5")}
                >
                  {title}
                </h3>
                {description != null && (
                  <p className={cn("text-fg-3 text-pretty", inline ? "text-[12px] leading-4" : "mt-1 text-[12.5px] leading-[18px]")}>{description}</p>
                )}
              </div>
            </div>

            {!inline && usage && <Usage {...usage} reduce={!!reduce} />}

            {!inline && (plan.perks?.length || plan.price != null) ? (
              <div className="rounded-lg border border-line bg-frame p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12.5px] font-medium text-fg">{plan.name} includes</p>
                  {plan.price != null && <p className="shrink-0 text-[12px] text-fg-3 tabular">{plan.price}</p>}
                </div>
                {plan.perks?.length ? (
                  <ul className="mt-2 grid gap-1.5">
                    {plan.perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] leading-[18px] text-fg-2">
                        <span className="flex h-[18px] shrink-0 items-center">
                          <Check size={14} className="text-fg" />
                        </span>
                        <span className="min-w-0">{perk}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className={cn("flex items-center gap-2", inline ? "ml-auto shrink-0" : "flex-wrap")}>
              <button
                type="button"
                data-upgrade
                onClick={upgrade}
                aria-busy={status === "busy" || undefined}
                aria-describedby={status === "failed" ? errorId : undefined}
                className={cn(
                  "relative inline-flex select-none items-center justify-center rounded-lg font-medium tracking-[-0.005em]",
                  inline ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  "transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
                  status === "done" ? "pointer-events-none bg-success-soft text-success" : "bg-fg text-frame hover:bg-fg/90",
                  status === "busy" && "pointer-events-none",
                )}
              >
                {/* Every label shares one cell, so the button keeps the width of the longest. */}
                <span className="grid">
                  {[label, doneLabel].map((l) => (
                    <span key={l} aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="size-3.5" />
                      {l}
                    </span>
                  ))}
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={status === "done" ? "done" : "idle"}
                      className="col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                      animate={{ opacity: status === "busy" ? 0 : 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.12 } }}
                      transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
                    >
                      {status === "done" ? <Check size={14} /> : null}
                      {status === "done" ? doneLabel : label}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {status === "busy" && (
                  <span className="absolute inset-0 grid place-items-center">
                    <Loader size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                    <span className="sr-only">Opening checkout</span>
                  </span>
                )}
              </button>

              {dismissible && status !== "done" &&
                (inline ? (
                  <button
                    type="button"
                    aria-label={dismissLabel}
                    onClick={dismiss}
                    className={cn(
                      "relative grid size-7 place-items-center rounded-md text-fg-3 outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                      "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={dismiss}
                    className={cn(
                      "inline-flex h-8 select-none items-center rounded-lg px-3 text-[13px] font-medium tracking-[-0.005em] text-fg-2 outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    )}
                  >
                    {dismissLabel}
                  </button>
                ))}
            </div>

            {status === "failed" && (
              <p id={errorId} role="alert" className={cn("text-[12px] leading-4 text-danger", inline ? "basis-full pb-1 pl-10" : "-mt-2")}>
                {errorMessage}
              </p>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Usage({ used, limit, label, reduce }: { used: number; limit: number; label: React.ReactNode; reduce: boolean }) {
  const full = used >= limit;
  const pct = Math.min(100, (used / Math.max(1, limit)) * 100);
  return (
    <Meter.Root value={Math.min(used, limit)} max={limit} className="flex flex-col gap-1.5" aria-valuetext={`${used} of ${limit} used`}>
      <div className="flex items-baseline justify-between gap-3 text-[12px] leading-4">
        <Meter.Label className="text-fg-2">{label}</Meter.Label>
        <span className={cn("tabular", full ? "text-warning" : "text-fg-3")}>
          {used} of {limit}
        </span>
      </div>
      <Meter.Track className="relative h-1 overflow-hidden rounded-full bg-fg/10">
        {/* Fills once on arrival, so the limit reads as reached rather than just stated. */}
        <motion.div
          aria-hidden
          className={cn("absolute inset-y-0 left-0 origin-left rounded-full", full ? "bg-warning" : "bg-fg")}
          style={{ width: `${pct}%` }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: ease.out, delay: 0.1 }}
        />
      </Meter.Track>
    </Meter.Root>
  );
}

// A padlock whose shackle lifts a pixel when Upgrade is hovered or focused, and opens once the upgrade lands.
function LockBadge({ open, small }: { open: boolean; small: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center border border-line-2 bg-frame text-fg-2",
        small ? "size-7 rounded-md" : "size-8 rounded-lg",
        open && "text-success",
        "transition-colors duration-200",
      )}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
        <path
          d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7"
          className={cn(
            "[transform-box:fill-box] origin-[100%_100%] transition-transform duration-200 ease-out-expo motion-reduce:transition-none",
            open
              ? "-translate-y-[2px] rotate-[18deg]"
              : "group-has-[[data-upgrade]:hover]/prompt:-translate-y-[1.5px] group-has-[[data-upgrade]:focus-visible]/prompt:-translate-y-[1.5px]",
          )}
        />
        <path d="M8 9.75v1.25" />
      </svg>
    </span>
  );
}
