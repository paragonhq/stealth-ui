"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ApprovalDecision = "pending" | "allowed" | "always" | "denied" | "expired";
export type ApprovalRisk = "low" | "medium" | "high";

export type ApprovalCardProps = Omit<React.ComponentProps<"section">, "title" | "children"> & {
  /** What the agent wants to do, as a verb phrase: “Run a database migration”. */
  title: React.ReactNode;
  /** The exact target, one line: “on billing-staging”, “to alex@acme.dev”. */
  description?: React.ReactNode;
  /** The specifics: the command, the diff, the recipient, the amount. */
  children?: React.ReactNode;
  risk?: ApprovalRisk;
  /** Why it carries that risk, in one sentence. */
  riskReason?: React.ReactNode;
  /** Short text for the decided line. Defaults to the title. */
  summary?: React.ReactNode;
  /** Offers a third button that allows this kind of action from now on. Never offered for high risk. */
  alwaysLabel?: string;
  decision?: ApprovalDecision;
  defaultDecision?: ApprovalDecision;
  onDecisionChange?: (decision: ApprovalDecision) => void;
  /** Milliseconds to wait before denying on the person's behalf. The timer pauses while the pointer is over the card. */
  timeout?: number;
  /** Move focus to the card when it appears, so Enter and Escape answer it. */
  autoFocus?: boolean;
};

const riskCopy: Record<ApprovalRisk, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };
const decided: Record<Exclude<ApprovalDecision, "pending">, string> = { allowed: "Allowed", always: "Always allowed", denied: "Denied", expired: "Timed out" };

/**
 * A request from an agent, in the flow of the conversation, waiting for a person.
 * Enter allows and Escape denies while the card has focus; once answered it folds
 * to a single line that records what was decided.
 */
export function ApprovalCard({
  title,
  description,
  children,
  risk = "medium",
  riskReason,
  summary,
  alwaysLabel,
  decision: decisionProp,
  defaultDecision = "pending",
  onDecisionChange,
  timeout,
  autoFocus = true,
  className,
  ...rest
}: ApprovalCardProps) {
  const reduce = useReducedMotion();
  const [decision, setDecision] = useControllableState<ApprovalDecision>({ value: decisionProp, defaultValue: defaultDecision, onChange: onDecisionChange });
  const pending = decision === "pending";
  const card = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const hadFocus = useRef(false);
  const titleId = useId();
  const high = risk === "high";
  const offerAlways = !!alwaysLabel && !high;

  const decide = (next: Exclude<ApprovalDecision, "pending">) => {
    if (!pending) return;
    hadFocus.current = !!card.current?.contains(document.activeElement);
    setDecision(next);
  };

  // Countdown: one tick a second, paused while the pointer rests on the card.
  // Running out denies. Never the other way round.
  const [left, setLeft] = useState(timeout ?? 0);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(timeout ?? 0);
  const expire = useRef(() => {});
  useEffect(() => {
    expire.current = () => setDecision("expired");
  });
  useEffect(() => {
    if (!pending || timeout == null || paused) return;
    const id = window.setInterval(() => {
      remaining.current = Math.max(0, remaining.current - 1000);
      setLeft(remaining.current);
      if (remaining.current === 0) expire.current();
    }, 1000);
    return () => window.clearInterval(id);
  }, [pending, timeout, paused]);

  // Focus arrives with the request, and moves to the record once it is answered.
  useEffect(() => {
    if (pending && autoFocus) card.current?.focus({ preventScroll: true });
  }, [pending, autoFocus]);
  useEffect(() => {
    if (!pending && hadFocus.current) {
      hadFocus.current = false;
      line.current?.focus({ preventScroll: true });
    }
  }, [pending]);

  // Measure the content so the card can shrink to one line instead of snapping.
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!pending || e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.preventDefault();
      decide("denied");
    }
    // Enter on the card itself; on a focused button the button's own action wins.
    // High-risk requests don't take the shortcut: allowing them is a deliberate press.
    if (e.key === "Enter" && e.target === e.currentTarget && !high) {
      e.preventDefault();
      decide("allowed");
    }
  };

  const seconds = Math.ceil(left / 1000);

  return (
    <section
      aria-labelledby={pending ? titleId : `${titleId}-line`}
      data-decision={decision}
      data-risk={risk}
      className={cn("@container/approval min-w-0", className)}
      {...rest}
    >
      <motion.div
        className={cn(
          "relative overflow-hidden border bg-raised shadow-[var(--shadow)] transition-[border-color,border-radius] duration-300",
          pending ? "rounded-xl border-line-2" : "rounded-lg border-line",
        )}
        initial={false}
        animate={{ height: height ?? "auto" }}
        transition={reduce ? { duration: 0 } : { duration: 0.32, ease: ease.inOut }}
      >
        <div ref={inner}>
          <AnimatePresence initial={false} mode="popLayout">
            {pending ? (
              <motion.div
                key="request"
                ref={card}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
                onPointerLeave={() => setPaused(false)}
                className="rounded-[11px] outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
                exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.in } }}
              >
                <div className="flex flex-col gap-3 p-3.5 pb-3">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-px grid size-7 shrink-0 place-items-center rounded-lg border",
                        high ? "border-danger/25 bg-danger-soft text-danger" : risk === "medium" ? "border-warning/25 bg-warning-soft text-warning" : "border-line bg-hover text-fg-2",
                      )}
                    >
                      <Shield />
                    </span>
                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5">
                      <h3 id={titleId} className="min-w-0 text-balance text-[14px] font-medium leading-5 tracking-[-0.012em] text-fg">
                        {title}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex h-5 items-center gap-1.5 justify-self-end rounded-full px-2 text-[11px] font-medium",
                          high ? "bg-danger-soft text-danger" : risk === "medium" ? "bg-warning-soft text-warning" : "bg-hover text-fg-3",
                        )}
                      >
                        <span aria-hidden className="size-1.5 rounded-full bg-current" />
                        {riskCopy[risk]}
                      </span>
                      <p className="min-w-0 text-[12.5px] leading-[18px] text-fg-2">{description}</p>
                      {timeout != null && (
                        <span className="justify-self-end whitespace-nowrap text-[11px] leading-[18px] tabular text-fg-3">{paused ? "Timer paused" : `Denies in ${seconds}s`}</span>
                      )}
                    </div>
                  </div>

                  {children != null && <div className="flex min-w-0 flex-col gap-2 text-[12.5px] text-fg-2">{children}</div>}

                  {riskReason != null && (
                    <p className={cn("flex items-start gap-1.5 text-[12px] leading-[18px]", high ? "text-danger" : "text-fg-3")}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
                        <circle cx="8" cy="8" r="5.75" />
                        <path d="M8 5v3.5" />
                        <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
                      </svg>
                      <span className="min-w-0 text-pretty">{riskReason}</span>
                    </p>
                  )}
                </div>

                <div className="relative flex flex-wrap items-center justify-end gap-2 border-t border-line bg-frame/60 px-3 py-2.5">
                  {/* The divider doubles as the countdown: it drains toward the left. */}
                  {timeout != null && (
                    <span aria-hidden className="absolute inset-x-0 -top-px h-px overflow-hidden">
                      <span
                        className="absolute inset-0 origin-left bg-fg-3 transition-[scale] duration-1000 ease-linear motion-reduce:transition-none"
                        style={{ scale: `${Math.max(0, left - (paused ? 0 : 1000)) / timeout} 1` }}
                      />
                    </span>
                  )}
                  {offerAlways && (
                    <Button
                      variant="ghost"
                      // In a narrow column the two answers share the first row; the standing permission sits under them.
                      className="-ml-1.5 mr-auto justify-center @max-[26rem]/approval:order-last @max-[26rem]/approval:mx-0 @max-[26rem]/approval:w-full"
                      onClick={() => decide("always")}>
                      {alwaysLabel}
                    </Button>
                  )}
                  <Button variant="secondary" className="justify-center @max-[26rem]/approval:flex-1" onClick={() => decide("denied")} hint="Esc">
                    Deny
                  </Button>
                  <Button variant="primary" className="justify-center @max-[26rem]/approval:flex-1" onClick={() => decide("allowed")} hint={high ? undefined : "↵"}>
                    Allow
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="decided"
                id={`${titleId}-line`}
                ref={line}
                tabIndex={-1}
                className="flex h-9 min-w-0 items-center gap-2 rounded-[7px] px-2.5 outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={reduce ? { duration: 0.15 } : { duration: 0.26, ease: ease.out, delay: 0.08 }}
              >
                <Outcome decision={decision} reduce={!!reduce} />
                <span className={cn("shrink-0 text-[13px] font-medium", decision === "allowed" || decision === "always" ? "text-fg" : "text-fg-2")}>{decided[decision]}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-3">{decision === "always" && alwaysLabel ? alwaysLabel.replace(/^always allow\s*/i, "") || (summary ?? title) : (summary ?? title)}</span>
                {decision === "expired" && timeout != null && <span className="shrink-0 text-[12px] tabular text-fg-4">No answer in {Math.round(timeout / 1000)}s</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "" : decided[decision]}
      </span>
    </section>
  );
}

function Button({ variant, hint, className, children, ...rest }: React.ComponentProps<"button"> & { variant: "primary" | "secondary" | "ghost"; hint?: string }) {
  return (
    <button
      type="button"
      data-variant={variant}
      className={cn(
        "relative inline-flex h-8 shrink-0 select-none items-center gap-2 rounded-lg px-3 text-[12.5px] font-medium tracking-[-0.005em]",
        "touch-manipulation outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
        "pointer-coarse:before:absolute pointer-coarse:before:-inset-y-1.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']",
        variant === "primary" && "bg-fg text-frame hover:bg-fg/90",
        variant === "secondary" && "border border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover",
        variant === "ghost" && "px-2.5 text-fg-2 hover:bg-hover hover:text-fg",
        className,
      )}
      {...rest}
    >
      {children}
      {hint && (
        <kbd
          aria-hidden
          className={cn(
            "-mr-1 hidden h-[18px] min-w-[18px] items-center justify-center rounded px-1 font-mono text-[10.5px] font-normal pointer-fine:inline-flex",
            variant === "primary" ? "bg-frame/15 text-frame/70" : "bg-hover text-fg-3",
          )}
        >
          {hint}
        </kbd>
      )}
    </button>
  );
}

function Shield() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.25 3.25 4v3.6c0 3 2 5.1 4.75 6.15C10.75 12.7 12.75 10.6 12.75 7.6V4z" />
      <path d="M8 5.75v2.5" />
      <circle cx="8" cy="10.4" r=".6" fill="currentColor" stroke="none" />
    </svg>
  );
}

const glyph = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Outcome({ decision, reduce }: { decision: ApprovalDecision; reduce: boolean }) {
  const draw = (delay = 0.14) => ({
    initial: { pathLength: reduce ? 1 : 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration: 0.32, ease: ease.out, delay },
  });
  return (
    <motion.span
      className="grid size-4 shrink-0 place-items-center"
      initial={reduce ? false : { scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={spring.pop}
    >
      {decision === "allowed" || decision === "always" ? (
        <svg {...glyph} className="text-success">
          <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw()} />
        </svg>
      ) : decision === "denied" ? (
        <svg {...glyph} className="text-fg-3">
          <motion.path d="m4.5 4.5 7 7" {...draw()} />
          <motion.path d="m11.5 4.5-7 7" {...draw(0.22)} />
        </svg>
      ) : (
        <svg {...glyph} className="text-fg-3">
          <circle cx="8" cy="8" r="5.75" />
          <motion.path d="M8 4.75V8l2.25 1.5" {...draw()} />
        </svg>
      )}
    </motion.span>
  );
}
