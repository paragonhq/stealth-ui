"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Eye, EyeOff, Loader, Refresh, Warning } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

const DOT = "•";
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Prefix, then dots, then the last four. As long as the real key, so revealing it never reflows the field. */
export function maskKey(key: string, prefix = "") {
  const head = key.startsWith(prefix) ? prefix : "";
  const tail = key.slice(-4);
  return head + DOT.repeat(Math.max(4, key.length - head.length - 4)) + tail;
}

/**
 * Animates a string toward a target: each position churns through random
 * glyphs until its turn comes, left to right, then settles. Runs on
 * requestAnimationFrame from the event that started it and cancels cleanly.
 */
export function useScramble(initial: string) {
  const [text, setText] = useState(initial);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const run = useCallback((from: string, to: string, { duration = 520, instant = false, keep = 0 }: { duration?: number; instant?: boolean; keep?: number } = {}) => {
    cancelAnimationFrame(frame.current);
    if (instant) return setText(to);
    const start = performance.now();
    const len = to.length;
    let lastChurn = 0;
    let churn = from;
    const tick = (now: number) => {
      const t = now - start;
      // Positions under `keep` (the prefix) never scramble; the rest resolve in order.
      const resolved = Math.min(len, keep + Math.floor(((len - keep) * t) / duration));
      // Re-roll the unresolved glyphs every ~45ms, so it reads as churning rather than flicker.
      if (now - lastChurn > 45) {
        lastChurn = now;
        // What the mask already showed (prefix, last four) holds still; only the hidden part churns,
        // and dots far ahead of the sweep wait their turn.
        churn = Array.from({ length: len }, (_, i) =>
          i < keep || from[i] === to[i] ? to[i] : from[i] === DOT && i > resolved + 6 ? DOT : GLYPHS[(Math.random() * GLYPHS.length) | 0],
        ).join("");
      }
      setText(to.slice(0, resolved) + churn.slice(resolved));
      if (resolved < len) frame.current = requestAnimationFrame(tick);
      else setText(to);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  return [text, run] as const;
}

// Ticks every 30s so "Last used 4m ago" stays true. Null on the server.
const subscribeClock = (fn: () => void) => {
  const t = window.setInterval(fn, 30_000);
  return () => window.clearInterval(t);
};
function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => null,
  );
}

function relative(date: Date, now: number) {
  const s = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });
  const abs = Math.abs(s);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), "day");
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

export type ApiKeyProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What the key is for: Production, CI runner, Zapier. */
  name: React.ReactNode;
  /** The full secret, when you're allowed to show it. Leave it out and pass `last4` to only ever show the mask. */
  value?: string;
  /** Last four characters, for keys whose full value you don't have. */
  last4?: string;
  /** Stays readable in the mask: sk_demo_, pk_test_. */
  prefix?: string;
  /** Fetch the full key on reveal (behind re-auth, say). Used when `value` isn't given. */
  onReveal?: () => Promise<string>;
  /** Show `value` as a brand-new key: revealed, with a warning that it won't be shown again. */
  once?: boolean;
  /** Called when the person confirms they've saved a once-only key. The key is forgotten after this. */
  onDismissOnce?: () => void;
  /** Resolve with the new full key. The old one is shown until it resolves; a rejection keeps it. */
  onRegenerate?: () => Promise<string>;
  createdAt?: Date | string | number;
  /** `null` for a key that has never been used. */
  lastUsedAt?: Date | string | number | null;
  /** Container for the confirm popover. */
  container?: Popover.Portal.Props["container"];
};

export function ApiKey({
  name,
  value,
  last4,
  prefix = "",
  onReveal,
  once = false,
  onDismissOnce,
  onRegenerate,
  createdAt,
  lastUsedAt,
  container,
  className,
  ...rest
}: ApiKeyProps) {
  const reduce = !!useReducedMotion();
  const now = useNow();
  const warningId = useId();
  // The secret we currently hold. A once-only key is dropped when dismissed.
  const [secret, setSecret] = useState<string | null>(value ?? null);
  const [tail, setTail] = useState(value ? value.slice(-4) : (last4 ?? ""));
  const [fresh, setFresh] = useState(once && !!value);
  const [revealed, setRevealed] = useState(once && !!value);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState(false);
  const fallbackMask = prefix + DOT.repeat(24) + tail;
  const masked = secret ? maskKey(secret, prefix) : fallbackMask;
  const [text, scramble] = useScramble(revealed && secret ? secret : masked);

  const canReveal = !!secret || !!onReveal;

  const show = (key: string) => {
    setSecret(key);
    setRevealed(true);
    scramble(maskKey(key, prefix), key, { instant: reduce, keep: prefix.length });
  };

  const toggle = async () => {
    setRevealError(false);
    if (revealed) {
      setRevealed(false);
      // Hiding is not a moment: it happens now.
      scramble(text, masked, { instant: true });
      return;
    }
    if (secret) return show(secret);
    if (!onReveal) return;
    setRevealing(true);
    try {
      show(await onReveal());
    } catch {
      setRevealError(true);
    } finally {
      setRevealing(false);
    }
  };

  const dismissOnce = () => {
    setFresh(false);
    setRevealed(false);
    // A once-only key is never kept around after the person says they've saved it.
    setSecret(null);
    scramble(text, secret ? maskKey(secret, prefix) : fallbackMask, { instant: true });
    onDismissOnce?.();
  };

  const regenerated = (key: string) => {
    setTail(key.slice(-4));
    setFresh(true);
    setRevealError(false);
    setSecret(key);
    setRevealed(true);
    scramble(secret ? maskKey(secret, prefix) : fallbackMask, key, { instant: reduce, keep: prefix.length, duration: 640 });
  };

  const copyRef = useRef<HTMLButtonElement>(null);
  const copyValue = secret ?? onReveal ?? "";

  return (
    <div
      data-state={fresh ? "new" : revealed ? "revealed" : "masked"}
      className={cn("flex w-full min-w-0 flex-col gap-3 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-[13px] font-medium leading-5 tracking-[-0.005em] text-fg">{name}</h3>
          <p className="flex min-w-0 flex-col text-[12px] leading-[18px] text-fg-3 tabular min-[420px]:flex-row min-[420px]:gap-x-1.5">
            {createdAt != null && (
              <span suppressHydrationWarning>
                Created {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(toDate(createdAt))}
              </span>
            )}
            {createdAt != null && lastUsedAt !== undefined && <span aria-hidden className="hidden text-fg-4 min-[420px]:inline">·</span>}
            {lastUsedAt === null && <span>Never used</span>}
            {lastUsedAt != null && (
              <span suppressHydrationWarning title={toDate(lastUsedAt).toLocaleString()}>
                Last used {now == null ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(toDate(lastUsedAt)) : relative(toDate(lastUsedAt), now)}
              </span>
            )}
          </p>
        </div>
        {onRegenerate && <Regenerate onRegenerate={onRegenerate} onDone={regenerated} copyRef={copyRef} container={container} disabled={fresh} />}
      </div>

      <div
        className={cn(
          "flex min-h-10 items-center gap-1 rounded-lg border bg-frame py-1 pr-1 pl-3 transition-[border-color] duration-200",
          fresh ? "border-warning/40" : "border-line",
        )}
      >
        {/* Break anywhere so a long key wraps rather than hides its end. The mask is as long as the key, so nothing reflows on reveal. */}
        <code
          aria-label={revealed ? undefined : `Hidden key ending in ${tail}`}
          aria-describedby={fresh ? warningId : undefined}
          className={cn("min-w-0 flex-1 break-all py-1 font-mono text-[12px] leading-[18px] tracking-[0.01em]", revealed ? "text-fg" : "text-fg-2")}
        >
          {text}
        </code>
        {canReveal && (
          <button
            type="button"
            onClick={toggle}
            aria-label={revealed ? "Hide key" : "Reveal key"}
            aria-pressed={revealed}
            aria-busy={revealing || undefined}
            className={cn(
              "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
              "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={revealing ? "busy" : revealed ? "hide" : "show"}
                className="grid place-items-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                transition={reduce ? { duration: 0.12 } : spring.pop}
              >
                {revealing ? <Loader size={14} className="animate-spin-slow" /> : revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
        {copyValue !== "" && <CopyButton ref={copyRef} value={copyValue} size="sm" variant="ghost" iconOnly label="Copy key" copiedLabel="Key copied" failedLabel="Couldn’t copy key" />}
      </div>

      {revealError && (
        <p role="alert" className="-mt-1 text-[12.5px] leading-[18px] text-danger">
          Couldn’t reveal the key. Try again.
        </p>
      )}

      <AnimatePresence initial={false}>
        {fresh && (
          <motion.div
            key="once"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -12 }}
            animate={{ opacity: 1, height: "auto", marginTop: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -12, transition: { duration: 0.18, ease: ease.out } }}
            transition={{ duration: 0.28, ease: ease.out }}
            className="overflow-hidden"
          >
            <div id={warningId} role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-warning-soft py-2 pr-2 pl-3">
              <p className="flex min-w-0 flex-[1_1_14rem] items-start gap-2 text-[12.5px] leading-[18px] text-warning">
                <Warning size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">Copy this key now.</span> You won’t be able to see it again.
                </span>
              </p>
              <button
                type="button"
                onClick={dismissOnce}
                className={cn(
                  "ml-auto inline-flex h-7 shrink-0 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                  "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                )}
              >
                I’ve saved it
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Regenerate({
  onRegenerate,
  onDone,
  copyRef,
  container,
  disabled,
}: {
  onRegenerate: () => Promise<string>;
  onDone: (key: string) => void;
  copyRef: React.RefObject<HTMLButtonElement | null>;
  container?: Popover.Portal.Props["container"];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const succeeded = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = async () => {
    setPending(true);
    setError(false);
    try {
      const key = await onRegenerate();
      succeeded.current = true;
      onDone(key);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // The request is in flight: closing now would hide whether it worked.
        if (pending) return;
        if (next) {
          setError(false);
          succeeded.current = false;
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          "group/regen -my-1 -mr-1 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
          "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 data-popup-open:bg-hover data-popup-open:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {/* The arrow winds back a half turn while the question is open. */}
        <Refresh size={14} className="transition-transform duration-300 ease-out-expo group-data-popup-open/regen:-rotate-180 motion-reduce:transition-none" />
        Regenerate
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            initialFocus={cancelRef}
            // After a new key arrives, focus lands on its copy button: the next thing anyone does.
            finalFocus={() => (succeeded.current ? copyRef.current : true)}
            className={cn(
              "w-[min(300px,var(--available-width))] origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-3.5 text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <Popover.Title className="text-[13px] font-medium leading-5 text-fg">Regenerate this key?</Popover.Title>
            <Popover.Description className="mt-1 text-[12.5px] leading-[18px] text-fg-3">
              Anything using the current key stops working right away.
            </Popover.Description>
            {error && (
              <p role="alert" className="mt-2 text-[12.5px] leading-[18px] text-danger">
                Couldn’t regenerate the key. Try again.
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Popover.Close
                ref={cancelRef}
                disabled={pending}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg outline-none",
                  "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:opacity-50",
                )}
              >
                Cancel
              </Popover.Close>
              <button
                type="button"
                onClick={confirm}
                aria-busy={pending || undefined}
                className={cn(
                  "relative inline-grid h-7 items-center rounded-md bg-danger px-2.5 text-[12px] font-medium text-frame outline-none",
                  "transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[0.97] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  pending && "pointer-events-none",
                )}
              >
                {/* The spinner overlays the label's cell, so the button keeps its width. */}
                <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", pending && "opacity-0")}>Regenerate</span>
                <span className={cn("col-start-1 row-start-1 grid place-items-center transition-opacity duration-150", !pending && "opacity-0")}>
                  <Loader size={14} className="animate-spin-slow" />
                </span>
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
