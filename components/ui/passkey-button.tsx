"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { ease, spring, swap } from "@/lib/motion";

export type PasskeyState = "idle" | "prompting" | "success" | "cancelled" | "error";

const noop = () => () => {};
/** Whether this browser can do WebAuthn at all. Renders as supported on the server, then checks. */
export function usePasskeySupport() {
  return useSyncExternalStore(
    noop,
    () => typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined",
    () => true,
  );
}

// WebAuthn reports a dismissed or timed-out prompt as NotAllowedError. That's the
// person choosing not to, not a failure, so it gets calm copy and no red.
const isCancel = (error: unknown) => error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError");

export type PasskeyButtonProps = Omit<React.ComponentProps<"div">, "children" | "onError"> & {
  /**
   * Run the ceremony: call navigator.credentials.get with the signal, then verify on
   * your server. Resolve on success; reject to show the state. The signal aborts if
   * the button unmounts.
   */
  onAuthenticate: (signal: AbortSignal) => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  /** Offered when passkeys aren't available, or after a cancel or failure. */
  onFallback?: () => void;
  fallbackLabel?: string;
  label?: string;
  promptingLabel?: string;
  successLabel?: string;
  retryLabel?: string;
  /** Override detection, e.g. when your server knows this account has no passkey. */
  supported?: boolean;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function PasskeyButton({
  onAuthenticate,
  onSuccess,
  onError,
  onFallback,
  fallbackLabel = "Sign in another way",
  label = "Sign in with passkey",
  promptingLabel = "Waiting for passkey…",
  successLabel = "Signed in",
  retryLabel = "Try passkey again",
  supported: supportedProp,
  variant = "secondary",
  disabled = false,
  className,
  ...rest
}: PasskeyButtonProps) {
  const reduce = useReducedMotion();
  const detected = usePasskeySupport();
  const supported = supportedProp ?? detected;
  const [state, setState] = useState<PasskeyState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const messageId = useId();
  useEffect(() => () => controller.current?.abort(), []);

  async function run() {
    if (state === "prompting" || state === "success" || !supported || disabled) return;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setState("prompting");
    setMessage(null);
    try {
      await onAuthenticate(ac.signal);
      if (ac.signal.aborted) return;
      setState("success");
      onSuccess?.();
    } catch (error) {
      if (ac.signal.aborted) return;
      onError?.(error);
      if (isCancel(error)) {
        setState("cancelled");
        setMessage("The passkey request was cancelled or timed out.");
      } else {
        setState("error");
        setMessage(error instanceof Error && error.message ? error.message : "Couldn’t sign in with that passkey.");
      }
    }
  }

  const unavailable = !supported;
  const text = state === "prompting" ? promptingLabel : state === "success" ? successLabel : state === "cancelled" || state === "error" ? retryLabel : label;
  const note = unavailable ? "This browser can’t use passkeys." : message;
  const showFallback = !!onFallback && (unavailable || state === "cancelled" || state === "error");

  return (
    <div data-state={unavailable ? "unsupported" : state} className={cn("flex w-full flex-col gap-2", className)} {...rest}>
      <button
        type="button"
        data-state={unavailable ? "unsupported" : state}
        data-variant={variant}
        aria-busy={state === "prompting" || undefined}
        aria-disabled={unavailable || disabled || state === "prompting" || state === "success" || undefined}
        aria-describedby={note ? messageId : undefined}
        onClick={run}
        className={cn(
          "group/passkey relative inline-flex h-9 w-full select-none items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium tracking-[-0.005em] outline-none pointer-coarse:h-11",
          "transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out active:scale-[0.98] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          variant === "primary"
            ? "bg-fg text-frame hover:bg-fg/90 data-[state=prompting]:bg-fg/85"
            : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-[state=prompting]:bg-hover",
          "data-[state=prompting]:cursor-default data-[state=prompting]:active:scale-100 data-[state=success]:cursor-default data-[state=success]:active:scale-100",
          (unavailable || disabled) && "pointer-events-none opacity-50",
        )}
      >
        {/* The glyph and label stay centered as a pair: when the label changes length the glyph glides to its new spot. */}
        <motion.span layout="position" transition={reduce ? { duration: 0 } : spring.snappy} className="relative grid size-5 shrink-0 place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={state === "success" ? "check" : "key"}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : swap.initial}
              animate={swap.animate}
              exit={reduce ? { opacity: 0 } : swap.exit}
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {state === "success" ? <DrawnCheck reduce={!!reduce} /> : <PasskeyGlyph scanning={state === "prompting"} reduce={!!reduce} />}
            </motion.span>
          </AnimatePresence>
        </motion.span>
        <span className="relative flex min-w-0">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={text}
              layout="position"
              className="min-w-0 truncate"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0.12, layout: { duration: 0 } } : { duration: 0.22, ease: ease.out, layout: spring.snappy }}
            >
              {text}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {(note || showFallback) && (
          <motion.div
            key="note"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.in } }}
            transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { duration: 0.22, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-px pb-px pt-0.5">
              {note && (
                <p
                  id={messageId}
                  role={state === "error" ? "alert" : undefined}
                  className={cn("flex min-w-0 items-start gap-1.5 text-[12px] leading-4", state === "error" && !unavailable ? "text-danger" : "text-fg-2")}
                >
                  {state === "error" && !unavailable && <Alert size={14} className="mt-px shrink-0" />}
                  <span className="min-w-0 text-pretty">{note}</span>
                </p>
              )}
              {showFallback && (
                <button
                  type="button"
                  onClick={onFallback}
                  className={cn(
                    // Drawn as a text link so it lines up with the note; the hit area extends past the text.
                    "relative shrink-0 rounded-sm text-[12.5px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none",
                    "transition-[text-decoration-color,scale] duration-150 ease-out hover:decoration-fg-2 active:scale-[0.97]",
                    "before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-['']",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  )}
                >
                  {fallbackLabel}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "prompting" ? promptingLabel : state === "success" ? successLabel : state === "cancelled" ? message : ""}
      </span>
    </div>
  );
}

// A person with a key. While the browser's passkey prompt is open, a bright band
// sweeps up and down through it inside a viewfinder, like the scan happening on the device.
function PasskeyGlyph({ scanning, reduce }: { scanning: boolean; reduce: boolean }) {
  const clip = useId();
  const shape = (
    <>
      <circle cx="8.25" cy="7" r="2.5" />
      <path d="M3.75 15.25c.45-2.5 2.2-3.9 4.5-3.9 1.2 0 2.25.38 3.05 1.05" />
      <circle cx="13.75" cy="9.75" r="1.75" />
      <path d="M13.75 11.5v4.25M13.75 13.75h1.4M13.75 15.25h1" />
    </>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g className={cn("transition-opacity duration-200", scanning && (reduce ? "animate-pulse-soft" : "opacity-45"))}>{shape}</g>
      <AnimatePresence>
        {scanning && !reduce && (
          <motion.g key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <defs>
              <clipPath id={clip}>
                <motion.rect x="0" width="20" height="5" initial={{ y: 1 }} animate={{ y: [1, 15, 1] }} transition={{ duration: 1.6, ease: ease.inOut, repeat: Infinity }} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>{shape}</g>
            <motion.path
              d="M2.5 0h15"
              strokeWidth={0.9}
              opacity={0.55}
              initial={{ y: 3.5 }}
              animate={{ y: [3.5, 17.5, 3.5] }}
              transition={{ duration: 1.6, ease: ease.inOut, repeat: Infinity }}
            />
            {/* Viewfinder corners close in around the glyph */}
            <motion.path
              d="M1 5V3a2 2 0 0 1 2-2h2M15 1h2a2 2 0 0 1 2 2v2M19 15v2a2 2 0 0 1-2 2h-2M5 19H3a2 2 0 0 1-2-2v-2"
              strokeWidth={1.2}
              style={{ originX: 0.5, originY: 0.5 }}
              initial={{ scale: 1.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.pop}
            />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.34, ease: ease.out, delay: 0.06, opacity: { duration: 0.01, delay: 0.06 } }}
      />
    </svg>
  );
}
