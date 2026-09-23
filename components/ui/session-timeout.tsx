"use client";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Clock, Lock } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const ACTIVITY = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

export type UseIdleWarningOptions = {
  /** Milliseconds without activity before the warning opens. */
  idleAfter: number;
  /** Stop listening, e.g. while signed out. */
  disabled?: boolean;
};

/**
 * Watches for input and says when the person has been idle long enough to warn.
 * Once warning, activity no longer counts: staying signed in is a choice.
 */
export function useIdleWarning({
  idleAfter,
  disabled = false,
}: UseIdleWarningOptions) {
  const [warning, setWarning] = useState(false);
  const last = useRef(0);
  const warningRef = useRef(false);

  const reset = useCallback(() => {
    last.current = Date.now();
    warningRef.current = false;
    setWarning(false);
  }, []);

  useEffect(() => {
    if (disabled) return;
    last.current = Date.now();
    const bump = () => {
      if (!warningRef.current) last.current = Date.now();
    };
    // Checked on a slow interval and when the tab comes back, measured against the
    // clock, so a throttled background tab still warns on time.
    const check = () => {
      if (warningRef.current || Date.now() - last.current < idleAfter) return;
      warningRef.current = true;
      setWarning(true);
    };
    ACTIVITY.forEach((e) =>
      window.addEventListener(e, bump, { passive: true, capture: true }),
    );
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 1000);
    return () => {
      ACTIVITY.forEach((e) =>
        window.removeEventListener(e, bump, { capture: true }),
      );
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [idleAfter, disabled]);

  return { warning, reset };
}

export type SessionTimeoutProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When the session ends. Takes precedence over `duration`. */
  expiresAt?: number | Date;
  /** Seconds of warning, counted from when the dialog opens. */
  duration?: number;
  /** Refresh the session. Return a promise to show progress; a rejection keeps the dialog open with the reason. */
  onStaySignedIn?: () => void | Promise<unknown>;
  onSignOut?: () => void | Promise<unknown>;
  /** Called once, when the countdown reaches zero. Sign the person out here. */
  onExpire?: () => void;
  /** The button shown after expiry. Without it, the button just closes the dialog. */
  onSignIn?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Render inside this element instead of document.body. */
  container?: HTMLElement | null;
  className?: string;
};

/**
 * The “are you still there” warning. The countdown is measured against the
 * clock, rolls down a digit at a time, and the dialog turns into a signed-out
 * notice in place when it runs out.
 */
export function SessionTimeout({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  container,
  className,
  ...rest
}: SessionTimeoutProps) {
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const stayRef = useRef<(() => void) | null>(null);
  const contained = container != null;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // Escape is a sign of life: treat it as Stay signed in rather than a silent close.
        if (!next && details.reason === "escape-key" && stayRef.current) {
          details.cancel();
          stayRef.current();
          return;
        }
        setOpen(next);
      }}
    >
      <AlertDialog.Portal container={container ?? undefined}>
        <AlertDialog.Backdrop
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-200 ease-out-quart",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150",
          )}
        />
        <AlertDialog.Viewport
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-dialog) flex items-center justify-center p-4",
            "max-sm:items-end max-sm:p-2 max-sm:pb-[max(8px,env(safe-area-inset-bottom))]",
          )}
        >
          <Body
            {...rest}
            className={className}
            close={() => setOpen(false)}
            stayRef={stayRef}
          />
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

type Phase = "counting" | "staying" | "leaving" | "expired";

// Lives inside the popup, so each opening starts with fresh state.
function Body({
  expiresAt,
  duration = 60,
  onStaySignedIn,
  onSignOut,
  onExpire,
  onSignIn,
  title = "You’re about to be signed out",
  description = "For your security, we sign you out after a while without activity. Anything unsaved on this page stays here.",
  className,
  close,
  stayRef,
}: Omit<
  SessionTimeoutProps,
  "open" | "defaultOpen" | "onOpenChange" | "container"
> & {
  close: () => void;
  stayRef: React.RefObject<(() => void) | null>;
}) {
  const [clock, setClock] = useState<{ left: number; total: number } | null>(
    null,
  );
  const [phase, setPhase] = useState<Phase>("counting");
  const [error, setError] = useState<string | null>(null);
  const stayButton = useRef<HTMLButtonElement>(null);
  const signInButton = useRef<HTMLButtonElement>(null);
  const expiredOnce = useRef(false);
  const live = useRef({ onExpire });
  const reduce = useReducedMotion();

  useEffect(() => {
    live.current = { onExpire };
  });

  useEffect(() => {
    const start = Date.now();
    const end = expiresAt != null ? +expiresAt : start + duration * 1000;
    const total = Math.max(1, Math.round((end - start) / 1000));
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setClock((prev) => (prev?.left === left ? prev : { left, total }));
      if (left === 0 && !expiredOnce.current) {
        expiredOnce.current = true;
        setPhase("expired");
        live.current.onExpire?.();
      }
    };
    const first = requestAnimationFrame(tick);
    // A quarter-second tick keeps the display within a frame of the true second, even after the tab was hidden.
    const timer = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [expiresAt, duration]);

  // Hand focus to the new primary action when the dialog turns into the signed-out notice.
  useEffect(() => {
    if (phase === "expired") signInButton.current?.focus();
  }, [phase]);

  const run = async (
    fn: (() => void | Promise<unknown>) | undefined,
    busy: Phase,
    failure: string,
  ) => {
    if (phase !== "counting") return;
    setError(null);
    const result = fn?.();
    if (!(result instanceof Promise)) return close();
    setPhase(busy);
    try {
      await result;
      close();
    } catch {
      // If the clock ran out while we waited, the expired notice has already taken over.
      setPhase((p) => (p === "expired" ? p : "counting"));
      setError(failure);
    }
  };
  const stay = () =>
    run(
      onStaySignedIn,
      "staying",
      "Couldn’t refresh your session. Try again, or save your work somewhere safe.",
    );

  useEffect(() => {
    // Escape means stay, and does nothing while a request is in flight (run() ignores it).
    stayRef.current = phase === "expired" ? null : stay;
  });

  const expired = phase === "expired";
  const left = clock?.left ?? 0;
  const urgent = !expired && clock != null && left <= 10;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  const spoken = `${minutes ? `${minutes} minute${minutes > 1 ? "s" : ""} ` : ""}${seconds} second${seconds === 1 ? "" : "s"}`;
  // Announce a few moments, not every second.
  const announce = expired
    ? "You’ve been signed out."
    : clock && [60, 30, 10].includes(left)
      ? `${spoken} left before you’re signed out.`
      : "";

  const swap = {
    initial: reduce
      ? { opacity: 0 }
      : { opacity: 0, y: 6, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" },
    transition: { duration: reduce ? 0.12 : 0.24, ease: ease.out },
  };

  return (
    <AlertDialog.Popup
      initialFocus={stayButton}
      data-phase={phase}
      onKeyDown={(e) => {
        // Keep Tab inside the dialog, wherever it has been portaled.
        if (e.key !== "Tab") return;
        const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, [href]")].filter((el) => !el.closest("[inert]"));
        const at = items.indexOf(document.activeElement as HTMLElement);
        const to = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
        if (items[to]) {
          e.preventDefault();
          items[to].focus();
        }
      }}
      className={cn(
        "relative flex w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
        "origin-center transition-[opacity,scale,translate] duration-[260ms] ease-out-expo",
        "data-starting-style:translate-y-1.5 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
        "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-[160ms] data-ending-style:ease-out-quart",
        "max-sm:data-starting-style:translate-y-4 max-sm:data-starting-style:scale-100",
        "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
        className,
      )}
    >
      {/* The time left, draining along the top edge; it turns amber for the last ten seconds. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-line">
        <div
          className={cn(
            "h-full origin-left transition-[transform,background-color] duration-1000 ease-linear motion-reduce:transition-none",
            urgent ? "bg-warning" : "bg-fg-3",
            expired && "opacity-0",
          )}
          style={{ transform: `scaleX(${clock ? left / clock.total : 1})` }}
        />
      </div>

      <div className="p-5">
        <div className="grid">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={expired ? "expired" : "counting"}
              className="col-start-1 row-start-1"
              {...swap}
            >
              <span
                aria-hidden
                className="mb-4 grid size-9 place-items-center rounded-full bg-hover text-fg-2"
              >
                {expired ? <Lock /> : <Clock />}
              </span>
              <AlertDialog.Title className="text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance">
                {expired ? "You’ve been signed out" : title}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-1.5 text-[13px] leading-[1.5] text-fg-2 text-pretty">
                {expired
                  ? "Your work on this page is still here. Sign in again to pick up where you left off."
                  : description}
              </AlertDialog.Description>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* On expiry the countdown folds away rather than vanishing, so the dialog settles instead of jumping. */}
        <div
          data-open={expired ? undefined : ""}
          inert={expired}
          className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-in-out-quart data-open:grid-rows-[1fr] data-open:opacity-100"
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-4 flex items-baseline justify-between gap-3 rounded-xl border border-line bg-frame px-3.5 py-3">
              <span className="text-[12.5px] text-fg-2">
                You will be signed out in
              </span>
              <span
                aria-hidden
                className={cn(
                  "font-mono text-[22px] font-medium leading-none tracking-[-0.02em] transition-[color,opacity] duration-300",
                  urgent ? "text-warning" : "text-fg",
                  clock ? "opacity-100" : "opacity-0",
                )}
              >
                {clock && (
                  <NumberFlowGroup>
                    <NumberFlow
                      value={minutes}
                      trend={-1}
                      className="tabular"
                    />
                    <span className="-mx-[0.08em]">:</span>
                    <NumberFlow
                      value={seconds}
                      trend={-1}
                      format={{ minimumIntegerDigits: 2 }}
                      className="tabular"
                    />
                  </NumberFlowGroup>
                )}
              </span>
              <span className="sr-only">{spoken}</span>
            </div>
          </div>
        </div>

        <div
          data-open={error ? "" : undefined}
          className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-in-out-quart data-open:grid-rows-[1fr]"
        >
          <div className="min-h-0 overflow-hidden">
            <p
              role="alert"
              className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] leading-[1.45] text-danger"
            >
              {error}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:*:h-10">
          {expired ? (
            <button
              ref={signInButton}
              type="button"
              onClick={() => {
                onSignIn?.();
                close();
              }}
              className={cn(button, primary)}
            >
              Sign in again
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-busy={phase === "leaving" || undefined}
                aria-disabled={phase === "staying" || undefined}
                onClick={() =>
                  run(onSignOut, "leaving", "Couldn’t sign you out. Try again.")
                }
                className={cn(
                  button,
                  "border border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover",
                )}
              >
                <Label
                  busy={phase === "leaving"}
                  idle="Sign out"
                  pending="Signing out…"
                />
              </button>
              <button
                ref={stayButton}
                type="button"
                aria-busy={phase === "staying" || undefined}
                aria-disabled={phase === "leaving" || undefined}
                onClick={stay}
                className={cn(button, primary)}
              >
                <Label
                  busy={phase === "staying"}
                  idle="Stay signed in"
                  pending="Refreshing…"
                />
              </button>
            </>
          )}
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </AlertDialog.Popup>
  );
}

const button = cn(
  "relative inline-flex h-8 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg px-3 text-[12.5px] font-medium shadow-[var(--shadow)] outline-none",
  "transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out-quart active:scale-[0.97] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-busy:pointer-events-none",
);
const primary = "bg-fg text-frame hover:bg-fg/90";

// Both labels share one cell, so a busy button keeps its width.
function Label({
  busy,
  idle,
  pending,
}: {
  busy: boolean;
  idle: string;
  pending: string;
}) {
  const reduce = useReducedMotion();
  return (
    <span className="grid overflow-hidden py-1">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {idle}
      </span>
      <span aria-hidden className="invisible col-start-1 row-start-1 pl-[22px]">
        {pending}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={busy ? "busy" : "idle"}
          className="col-start-1 row-start-1 flex items-center justify-center gap-1.5"
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }
          }
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }
          }
          transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
        >
          {busy && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
              className="shrink-0 animate-[spin_0.7s_linear_infinite]"
            >
              <circle
                cx="8"
                cy="8"
                r="5.75"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="1.5"
              />
              <path
                d="M8 2.25A5.75 5.75 0 0 1 13.75 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          {busy ? pending : idle}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
