"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type MessageStatusValue = "sending" | "sent" | "delivered" | "read" | "failed";

export const statusLabels: Record<MessageStatusValue, string> = {
  sending: "Sending…",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Not delivered",
};

// A send that settles inside this window never shows the clock at all: a clock
// that flashes for 80ms reads as a glitch, not as progress.
const SENDING_DELAY = 0.3;

export type MessageStatusProps = Omit<React.ComponentProps<"span">, "children"> & {
  status: MessageStatusValue;
  /** When it happened, already formatted ("9:41"). Joins the label and the accessible name: "Read 9:41". */
  time?: string;
  /** Show the words next to the ticks. Off, the ticks carry an accessible name instead. */
  label?: boolean;
  /** Which side the ticks sit on. "end" keeps them on the right edge, under a right-aligned bubble. */
  align?: "start" | "end";
  /** Resend a failed message. When set, the failed state becomes a button. */
  onRetry?: () => void;
  /** Words for each state, for other languages or products. */
  labels?: Partial<Record<MessageStatusValue, string>>;
  /** Text of the retry action. */
  retryLabel?: string;
  /** Say state changes out loud. Failures are always announced; the rest only when this is on. */
  announce?: boolean;
};

/**
 * Ticks that morph: a clock that only shows up when sending is slow, a check that draws,
 * a second check that slides in beside it, a brightening for read, and a failure you can press.
 */
export function MessageStatus({
  status,
  time,
  label = false,
  align = "end",
  onRetry,
  labels: labelsProp,
  retryLabel = "Try again",
  announce = false,
  className,
  ...rest
}: MessageStatusProps) {
  const reduce = useReducedMotion();
  const labels = { ...statusLabels, ...labelsProp };
  const withTime = (s: MessageStatusValue) => (time && s !== "sending" && s !== "failed" ? `${labels[s]} ${time}` : labels[s]);
  const text = withTime(status);
  const failed = status === "failed";
  const retry = failed && !!onRetry;
  const spoken = failed && onRetry ? `${labels.failed}. ${retryLabel}` : text;

  const glyph = <Ticks status={status} reduce={!!reduce} />;

  // Pressing retry swaps the button for a plain status, which would drop focus on the page.
  // Hand it to the status instead, so keyboard and screen reader users stay on the message.
  const root = useRef<HTMLSpanElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current || failed) return;
    refocus.current = false;
    root.current?.focus({ preventScroll: true });
  }, [failed]);

  const words = label && (
    // Every label sits in the same grid cell, so the row is as wide as the longest one and
    // the ticks never move. The text hugs the ticks; the spare room falls on the far side.
    <span className={cn("grid overflow-hidden", align === "end" ? "justify-items-end text-right" : "justify-items-start text-left")} aria-hidden>
      {(Object.keys(labels) as MessageStatusValue[]).map((s) => (
        <span key={s} className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {s === "failed" && onRetry ? <FailedWords text={labels.failed} retry={retryLabel} /> : withTime(s)}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={status}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
          transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out, delay: status === "sending" ? SENDING_DELAY : 0 }}
        >
          {failed && onRetry ? <FailedWords text={labels.failed} retry={retryLabel} /> : text}
        </motion.span>
      </AnimatePresence>
    </span>
  );

  const inner = (
    <>
      {align === "start" && glyph}
      {words}
      {align === "end" && glyph}
    </>
  );

  const shared = cn(
    "relative inline-flex shrink-0 select-none items-center gap-1 align-middle text-[11px] leading-4 tabular",
    "transition-colors duration-200 ease-out",
    "text-fg-3 data-[status=read]:text-fg data-[status=failed]:text-danger",
    className,
  );

  return (
    <>
      {retry ? (
        <RetryButton
          label={label}
          name={spoken}
          className={shared}
          status={status}
          onRetry={() => {
            refocus.current = true;
            onRetry?.();
          }}
          {...rest}
        >
          {inner}
        </RetryButton>
      ) : (
        <span ref={root} role="img" aria-label={spoken} tabIndex={-1} data-status={status} className={cn(shared, "rounded-sm outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3")} {...rest}>
          {inner}
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {failed ? `Message not delivered.${onRetry ? ` ${retryLabel} is available.` : ""}` : announce ? text : ""}
      </span>
    </>
  );
}

function FailedWords({ text, retry }: { text: string; retry: string }) {
  return (
    <>
      {text}
      <span className="px-1 opacity-60">·</span>
      <span className="font-medium underline decoration-current/40 underline-offset-2 transition-[text-decoration-color] duration-150 group-hover/retry:decoration-current">
        {retry}
      </span>
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The failed state as a button: whole label when it shows, the glyph alone (with a tooltip) when not
 * -----------------------------------------------------------------------------------------------*/

function RetryButton({
  label,
  name,
  status,
  onRetry,
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<"span">, "onClick"> & { label: boolean; name: string; status: MessageStatusValue; onRetry?: () => void }) {
  const button = (
    <button
      type="button"
      aria-label={name}
      data-status={status}
      onClick={onRetry}
      className={cn(
        className,
        "group/retry rounded-sm outline-none active:scale-[0.95] active:duration-75",
        "transition-[color,scale] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        // A 16px glyph is too small to hit with a thumb; the target grows without the drawing.
        "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:-inset-1",
      )}
      {...(rest as React.ComponentProps<"button">)}
    >
      {children}
    </button>
  );
  if (label) return button;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={300} render={button} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
              "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
            )}
          >
            {name}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Ticks: one drawing that morphs between the states, never a stack of swapped icons
 * -----------------------------------------------------------------------------------------------*/

// Offsets that keep the drawing optically centered in its 18px box: one check sits in the
// middle; two checks share the middle between them.
const A_ALONE = 2.75;
const A_PAIR = 0.5;

function Ticks({ status, reduce }: { status: MessageStatusValue; reduce: boolean }) {
  const [scope, animate] = useAnimate<SVGGElement>();
  const previous = useRef(status);

  // Read is a change that happens while nobody is looking: the pair gives one small nod
  // as it brightens, so the change is caught from the corner of the eye.
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (reduce || !scope.current || was === status || status !== "read") return;
    animate(scope.current, { scale: [1, 1.18, 1] }, { duration: 0.34, ease: ease.out, times: [0, 0.4, 1] });
  }, [status, reduce, animate, scope]);

  const sending = status === "sending";
  const failed = status === "failed";
  const checked = status === "sent" || status === "delivered" || status === "read";
  const pair = status === "delivered" || status === "read";

  // Targets never depend on reduced motion (the server can't know it); only the timing does.
  const draw = (on: boolean, delay = 0) => ({
    animate: { opacity: on ? 1 : 0, pathLength: on ? 1 : 0 },
    transition: reduce
      ? { duration: on ? 0.15 : 0.1, pathLength: { duration: 0 } }
      : on
        ? { pathLength: { duration: 0.3, ease: ease.out, delay }, opacity: { duration: 0.05, delay } }
        : { pathLength: { duration: 0.12, ease: ease.in }, opacity: { duration: 0.12 } },
  });

  const a = draw(checked);
  const b = draw(pair, status === "delivered" || status === "read" ? 0.06 : 0);

  return (
    <span className="relative grid h-4 w-[18px] shrink-0 place-items-center" aria-hidden>
      <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="overflow-visible">
        {/* Clock: fades in only if sending takes longer than the delay; the hand turns while it waits. */}
        <motion.g
          initial={false}
          animate={sending ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
          transition={reduce ? { duration: 0.15, delay: sending ? SENDING_DELAY : 0, scale: { duration: 0 } } : sending ? { duration: 0.2, ease: ease.out, delay: SENDING_DELAY } : { duration: 0.12, ease: ease.in }}
        >
          <circle cx="9" cy="8" r="5.25" />
          <path d="M9 8 11.1 9.2" />
          <path d="M9 8V4.9" className={cn("origin-[9px_8px]", sending && "motion-safe:animate-spin motion-safe:[animation-duration:2.4s]")} />
        </motion.g>

        <motion.g ref={scope}>
          <motion.g initial={false} animate={{ x: pair ? A_PAIR : A_ALONE }} transition={reduce ? { duration: 0 } : spring.snappy}>
            <motion.path d="M2 8.5 5 11.5 10.5 5" initial={false} {...a} />
          </motion.g>
          <g transform={`translate(${A_PAIR} 0)`}>
            <motion.path d="M8.3 10.3 9.5 11.5 15 5" initial={false} {...b} />
          </g>
        </motion.g>
      </svg>

      <AnimatePresence initial={false}>
        {failed && (
          <motion.svg
            key="failed"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            className="absolute"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            <circle cx="8" cy="8" r="5.75" />
            <path d="M8 5v3.5" />
            <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}
