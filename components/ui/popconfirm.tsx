"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Loader } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";
export type ConfirmStatus = "idle" | "pending" | "success" | "error";

/**
 * The confirm lifecycle on its own: runs the action, tracks pending, holds a success
 * beat before `onDone`, and keeps the error so the caller can say what went wrong.
 */
export function useConfirmAction({
  onConfirm,
  onDone,
  successHold = 650,
}: {
  onConfirm: () => void | Promise<unknown>;
  /** Called once the action succeeded (after the success beat for async actions). */
  onDone?: () => void;
  successHold?: number;
}) {
  const [status, setStatus] = useState<ConfirmStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const timer = useRef<number>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(async () => {
    if (status === "pending" || status === "success") return;
    let result: void | Promise<unknown>;
    try {
      result = onConfirm();
    } catch (e) {
      setError(e);
      setStatus("error");
      return;
    }
    // A plain function confirms on the spot: no spinner, no beat.
    if (!(result instanceof Promise)) {
      onDone?.();
      return;
    }
    setError(null);
    setStatus("pending");
    try {
      await result;
      if (!alive.current) return;
      setStatus("success");
      timer.current = window.setTimeout(() => onDone?.(), successHold);
    } catch (e) {
      if (!alive.current) return;
      setError(e);
      setStatus("error");
    }
  }, [status, onConfirm, onDone, successHold]);

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, run, reset };
}

export type PopconfirmProps = {
  /** The question, naming the thing: "Delete q3-forecast.xlsx?" */
  title: React.ReactNode;
  /** One line on the consequence. */
  description?: React.ReactNode;
  /** The verb. Never "Yes" or "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown with a drawn tick when an async action resolves, just before the popover closes. */
  successLabel?: string;
  /** Replaces the confirm label after a failure. */
  retryLabel?: string;
  /** What to say when the action throws or rejects. A function receives the error. */
  errorMessage?: React.ReactNode | ((error: unknown) => React.ReactNode);
  tone?: "default" | "danger";
  /** Optional mark before the title, e.g. a trash or warning icon. */
  icon?: React.ReactNode;
  /** Return a promise to keep the popover open with a spinner until it settles. */
  onConfirm: () => void | Promise<unknown>;
  onCancel?: () => void;
  /** Called after a confirmed action has finished and the popover has closed: the moment to remove the row. */
  onConfirmed?: () => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: Side;
  align?: Align;
  /** Where to portal the popover. Defaults to document.body. */
  container?: Popover.Portal.Props["container"];
  /** Milliseconds the success state holds before closing. */
  successHold?: number;
  /** Class for the popover surface. */
  className?: string;
  /** The trigger: a single button-like element. It stays pressed while the question is open. */
  children: React.ReactElement<Record<string, unknown>>;
};

/**
 * A small question anchored to the button that asked it. Focus starts on Cancel, Escape and
 * outside presses back out, and an async confirm keeps the question open until it settles.
 */
export function Popconfirm({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  successLabel = "Done",
  retryLabel = "Try again",
  errorMessage = "That didn’t go through. Try again.",
  tone = "default",
  icon,
  onConfirm,
  onCancel,
  onConfirmed,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = "bottom",
  align = "center",
  container,
  successHold,
  className,
  children,
}: PopconfirmProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const confirmed = useRef(false);
  const { status, error, run, reset } = useConfirmAction({
    onConfirm,
    onDone: () => {
      confirmed.current = true;
      setOpen(false);
    },
    successHold,
  });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const busy = status === "pending" || status === "success";
  const label = status === "success" ? successLabel : status === "error" ? retryLabel : confirmLabel;

  return (
    <Popover.Root
      open={open}
      modal="trap-focus"
      onOpenChange={(next, details) => {
        // Nothing dismisses the question while the action is in flight or finishing.
        if (!next && busy) {
          details.cancel();
          return;
        }
        if (!next && status !== "success") onCancel?.();
        setOpen(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        reset();
        // Only now, with the popover gone, is it safe to unmount the trigger's row.
        if (confirmed.current) {
          confirmed.current = false;
          onConfirmed?.();
        }
      }}
    >
      <Popover.Trigger render={children} />
      <Popover.Portal container={container}>
        <Popover.Positioner side={side} align={align} sideOffset={10} collisionPadding={8} arrowPadding={14} className="z-(--z-popover)">
          <Popover.Popup
            role="alertdialog"
            initialFocus={cancelRef}
            aria-busy={status === "pending" || undefined}
            data-status={status}
            data-tone={tone}
            className={cn(
              "relative w-72 max-w-(--available-width) rounded-xl border border-line-2 bg-raised p-3.5 text-[13px] text-fg shadow-pop outline-none",
              // Grows out of the trigger and drifts 4px away from it; leaves with a quick fade.
              "origin-(--transform-origin) transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-starting-style:blur-[2px]",
              "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
              "data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-140 data-ending-style:ease-out-quart",
              "data-instant:transition-none",
              "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
              className,
            )}
          >
            <Arrow />
            <div className="flex gap-2.5">
              {icon && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5",
                    tone === "danger" ? "bg-danger-soft text-danger" : "bg-hover text-fg-2",
                  )}
                >
                  {icon}
                </span>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <Popover.Title className="text-[13px] font-medium leading-5 tracking-[-0.01em] text-fg [overflow-wrap:anywhere] text-balance">{title}</Popover.Title>
                {description && (
                  <Popover.Description className="mt-0.5 text-[12.5px] leading-[18px] text-fg-2 text-pretty">{description}</Popover.Description>
                )}
              </div>
            </div>

            {/* The error slot opens by grid rows so the popover grows smoothly instead of jumping. */}
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out-expo motion-reduce:transition-none",
                status === "error" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-2.5 py-2 text-[12px] leading-[17px] text-danger text-pretty">
                  {status === "error" ? (typeof errorMessage === "function" ? errorMessage(error) : errorMessage) : null}
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-end gap-2">
              <Popover.Close
                ref={cancelRef}
                aria-disabled={busy || undefined}
                className={cn(
                  "relative inline-flex h-7 items-center justify-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                  "transition-[background-color,border-color,opacity,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  "aria-disabled:pointer-events-none aria-disabled:opacity-50",
                  "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
                )}
              >
                {cancelLabel}
              </Popover.Close>
              <button
                type="button"
                aria-disabled={busy || undefined}
                onClick={() => {
                  if (!busy) run();
                }}
                className={cn(
                  "relative inline-flex h-7 items-center justify-center gap-1.5 overflow-hidden rounded-md px-2.5 text-[12px] font-medium shadow-[var(--shadow)] outline-none",
                  "transition-[background-color,scale] duration-150 active:duration-75",
                  !busy && "active:scale-[0.97]",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
                  tone === "danger" ? "bg-danger text-frame" : "bg-fg text-frame",
                  !busy && (tone === "danger" ? "hover:bg-danger/90" : "hover:bg-fg/90"),
                )}
              >
                {/* Every label shares one grid cell, so the button is as wide as the longest and never shifts. */}
                <span className="relative grid">
                  {[confirmLabel, successLabel, retryLabel].map((l) => (
                    <span key={l} aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap">
                      {l === successLabel && <span className="size-3.5" />}
                      {l}
                    </span>
                  ))}
                  {/* A spinner that flashes for 80ms reads as a glitch: the label only gives way after 150ms. */}
                  <span
                    className={cn(
                      "col-start-1 row-start-1 grid transition-opacity duration-150",
                      status === "pending" && "opacity-0 delay-150",
                    )}
                  >
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={status === "pending" ? "idle" : status}
                        className="col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                        transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
                      >
                        {status === "success" && <Tick reduce={!!reduce} />}
                        {label}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 grid place-items-center transition-opacity duration-150",
                      status === "pending" ? "opacity-100 delay-150" : "opacity-0",
                    )}
                  >
                    <Loader size={14} className="animate-spin" />
                  </span>
                </span>
              </button>
            </div>
            <span role="status" aria-live="polite" className="sr-only">
              {status === "pending" ? `${confirmLabel}…` : status === "success" ? successLabel : ""}
            </span>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      initial={reduce ? false : { scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={spring.pop}
    >
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
      />
    </motion.svg>
  );
}

// Curved arrow drawn as fill plus stroke so it joins the hairline border without a seam.
function Arrow() {
  return (
    <Popover.Arrow
      className={cn(
        "pointer-events-none flex h-2.5 w-5",
        "data-[side=bottom]:-top-[9px] data-[side=top]:-bottom-[9px] data-[side=top]:rotate-180",
        "data-[side=left]:-right-3.5 data-[side=left]:rotate-90 data-[side=right]:-left-3.5 data-[side=right]:-rotate-90",
      )}
    >
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden className="block overflow-visible">
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2z" className="fill-raised" />
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2" className="stroke-line-2" vectorEffect="non-scaling-stroke" />
      </svg>
    </Popover.Arrow>
  );
}
