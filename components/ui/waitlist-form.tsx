"use client";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Alert, ArrowUp, Link, Loader, Share } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type WaitlistEntry = {
  email: string;
  /** 1-based place in line. */
  position: number;
  /** The link that credits this person when someone joins through it. */
  referralUrl: string;
};

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Follows an element's height so the wrapper can animate between two contents of different size. */
function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}

export type WaitlistFormProps = Omit<React.ComponentProps<"div">, "onSubmit" | "children"> & {
  /** Adds the address to the list and returns its place and referral link. Throw with a message to show it under the field. */
  onJoin: (email: string) => Promise<Omit<WaitlistEntry, "email">>;
  /** Start already on the list, for a returning visitor. */
  defaultEntry?: WaitlistEntry;
  /** A live place in line (from polling or a socket). Moving up shows how many places they gained. */
  position?: number;
  /** Friends who joined through the link. */
  referrals?: number;
  /** How to call the people who join through the link, singular and plural. */
  referralNoun?: [string, string];
  /** What a referral is worth, in one line: "Each friend who joins moves you up 50 places." */
  reward?: React.ReactNode;
  /** One quiet line under the field before joining. */
  hint?: React.ReactNode;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Title of the share block and the native share sheet. */
  shareTitle?: string;
  /** Locale for the numbers. Fixed, so the server and the browser print the same thing. */
  locale?: string;
  disabled?: boolean;
  onJoined?: (entry: WaitlistEntry) => void;
};

/**
 * Join the waitlist, then see your place: the number rolls up to where you
 * stand, the share link sits underneath with a copy button, and every place
 * gained through a referral rolls the number down with a "+N" beside it.
 */
export function WaitlistForm({
  onJoin,
  defaultEntry,
  position: positionProp,
  referrals = 0,
  referralNoun = ["friend", "friends"],
  reward = "Each friend who joins with your link moves you up the line.",
  hint,
  label = "Email address",
  placeholder = "you@company.com",
  submitLabel = "Join waitlist",
  shareTitle = "Move up the line",
  locale = "en-US",
  disabled = false,
  onJoined,
  className,
  ...rest
}: WaitlistFormProps) {
  const reduce = useReducedMotion();
  const [entry, setEntry] = useState<WaitlistEntry | null>(defaultEntry ?? null);
  // Only a join that just happened rolls the number up from zero; a returning visitor sees it settled.
  const [fresh, setFresh] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inner, height] = useHeight<HTMLDivElement>();
  const [resizing, setResizing] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setSlow(true), 150);
    return () => {
      window.clearTimeout(t);
      setSlow(false);
    };
  }, [busy]);

  const join = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setErrors({});
    const started = performance.now();
    const settle = async () => {
      const elapsed = performance.now() - started;
      if (elapsed > 150 && elapsed < 450) await wait(450 - elapsed);
    };
    try {
      const result = await onJoin(value);
      await settle();
      if (!alive.current) return;
      const next = { email: value, ...result };
      setFresh(true);
      setEntry(next);
      onJoined?.(next);
    } catch (error) {
      await settle();
      if (!alive.current) return;
      setErrors({ email: error instanceof Error && error.message ? error.message : "Couldn’t add you to the list. Try again." });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div data-slot="waitlist-form" data-state={entry ? "joined" : busy ? "submitting" : "idle"} className={cn("w-full min-w-0", className)} {...rest}>
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.38, ease: ease.inOut }}
      onAnimationStart={() => setResizing(true)}
      onAnimationComplete={() => setResizing(false)}
      // Clip only while the height is changing, so the card's shadow and focus rings are never cut at rest.
      style={{ overflow: resizing ? "clip" : undefined, overflowClipMargin: 8 }}
    >
      <div ref={inner}>
        <AnimatePresence mode="popLayout" initial={false}>
          {entry ? (
            <motion.div
              key="joined"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: reduce ? 0.15 : 0.4, ease: ease.out, delay: reduce ? 0 : 0.08 }}
            >
              <Joined
                entry={entry}
                position={positionProp ?? entry.position}
                referrals={referrals}
                noun={referralNoun}
                reward={reward}
                shareTitle={shareTitle}
                locale={locale}
                roll={fresh}
              />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
            >
              <Form errors={errors} onFormSubmit={(v) => join(String(v.email ?? "").trim())} aria-busy={busy || undefined}>
                <Field.Root
                  name="email"
                  disabled={disabled}
                  validate={(v) => {
                    const s = String(v ?? "").trim();
                    if (!s) return "Enter your email address";
                    if (!EMAIL.test(s)) return "Enter a valid email, like name@company.com";
                    return null;
                  }}
                  className="group/wl flex flex-col gap-2"
                >
                  <Field.Label className="sr-only">{label}</Field.Label>
                  <div
                    className={cn(
                      "relative flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-line-2 bg-raised pl-3 pr-[3px] shadow-[var(--shadow)]",
                      "transition-[border-color,box-shadow] duration-150 ease-out",
                      "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
                      "group-data-invalid/wl:border-danger/70 group-data-invalid/wl:hover:border-danger group-data-invalid/wl:focus-within:border-danger group-data-invalid/wl:hover:focus-within:border-danger group-data-invalid/wl:focus-within:ring-danger/15",
                      "group-data-disabled/wl:opacity-50 group-data-disabled/wl:shadow-none",
                    )}
                  >
                    <Field.Control
                      type="text"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      placeholder={placeholder}
                      value={email}
                      onValueChange={setEmail}
                      readOnly={busy}
                      className={cn(
                        "h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]",
                        "transition-colors duration-150 read-only:text-fg-2 disabled:cursor-not-allowed",
                        "autofill:shadow-[inset_0_0_0_1000px_var(--raised)] autofill:[-webkit-text-fill-color:var(--fg)]",
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={disabled}
                      aria-disabled={busy || undefined}
                      data-busy={busy || undefined}
                      className={cn(
                        "relative inline-flex h-8 shrink-0 select-none items-center justify-center rounded-md bg-fg px-3 text-[12.5px] font-medium tracking-[-0.005em] text-frame",
                        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                        "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                        "data-busy:pointer-events-none data-disabled:pointer-events-none",
                        "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
                      )}
                    >
                      <span className="grid place-items-center">
                        <span className={cn("col-start-1 row-start-1 transition-[opacity,filter] duration-150 ease-out", busy && "opacity-60", slow && "opacity-0 blur-[2px] motion-reduce:blur-none")}>
                          {submitLabel}
                        </span>
                        <span aria-hidden className={cn("col-start-1 row-start-1 grid place-items-center transition-[opacity,scale] duration-200 ease-out-expo", slow ? "scale-100 opacity-100" : "scale-75 opacity-0")}>
                          <Loader size={14} className={cn(slow && "animate-spin motion-reduce:animate-spin-slow")} />
                        </span>
                      </span>
                      {busy && <span className="sr-only">Joining</span>}
                    </Button>
                  </div>

                  <div className="grid min-h-[18px] text-[12px] leading-[18px]">
                    {hint != null && (
                      <Field.Description className="col-start-1 row-start-1 text-pretty text-fg-3 transition-opacity duration-150 group-data-invalid/wl:opacity-0">
                        {hint}
                      </Field.Description>
                    )}
                    <Field.Error
                      className={cn(
                        "col-start-1 row-start-1 flex items-start gap-1.5 text-danger transition-[opacity,translate] duration-200 ease-out-expo",
                        "data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100 motion-reduce:translate-y-0",
                      )}
                      render={({ children, ...props }) => (
                        <div {...props}>
                          <Alert size={14} className="mt-0.5 shrink-0" />
                          <span className="min-w-0 text-pretty">{children}</span>
                        </div>
                      )}
                    />
                  </div>
                </Field.Root>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    </div>
  );
}

function Joined({
  entry,
  position,
  referrals,
  noun,
  reward,
  shareTitle,
  locale,
  roll,
}: {
  entry: WaitlistEntry;
  position: number;
  referrals: number;
  noun: [string, string];
  reward: React.ReactNode;
  shareTitle: string;
  locale: string;
  roll: boolean;
}) {
  const reduce = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  // A fresh join starts the counter at zero for one frame, then rolls it to the real place.
  const [shown, setShown] = useState(roll ? 0 : position);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(position));
    return () => cancelAnimationFrame(id);
  }, [position]);

  // Places gained since the last update, shown for a moment beside the number.
  const [prev, setPrev] = useState(position);
  const [gain, setGain] = useState<{ amount: number; at: number } | null>(null);
  if (position !== prev) {
    setPrev(position);
    if (position < prev) setGain({ amount: prev - position, at: position });
  }
  useEffect(() => {
    if (!gain) return;
    const t = window.setTimeout(() => setGain(null), 2600);
    return () => window.clearTimeout(t);
  }, [gain]);

  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches));
    return () => cancelAnimationFrame(id);
  }, []);

  // Focus lands on the card when it replaces the form, so the keyboard continues from here.
  useEffect(() => {
    if (roll) card.current?.focus({ preventScroll: true });
  }, [roll]);

  const ahead = Math.max(0, position - 1);
  const fmt = new Intl.NumberFormat(locale);
  const display = entry.referralUrl.replace(/^https?:\/\/(www\.)?/, "");
  const announce = gain
    ? `You moved up ${fmt.format(gain.amount)} ${gain.amount === 1 ? "place" : "places"}. You’re number ${fmt.format(position)} in line.`
    : `You’re on the list. You’re number ${fmt.format(position)} in line.`;

  return (
    <div
      ref={card}
      tabIndex={-1}
      className="flex flex-col rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)] outline-none"
    >
      <div className="flex flex-col gap-1 px-4 pb-4 pt-3.5">
        <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
          <Tick draw={roll && !reduce} />
          <span className="shrink-0 text-fg-2">You’re on the list</span>
          <span aria-hidden className="text-fg-4">·</span>
          <span className="min-w-0 truncate">{entry.email}</span>
        </p>

        {/* NumberFlow pads itself vertically for the spin mask; pull the rows back to the type's rhythm. */}
        <div className="-my-1.5 flex items-center gap-2.5">
          <NumberFlow
            value={shown}
            locales={locale}
            prefix="#"
            aria-hidden
            className="text-[34px] font-medium leading-[40px] tracking-[-0.035em] text-fg"
            transformTiming={{ duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            spinTiming={{ duration: 1100, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
          <AnimatePresence>
            {gain && (
              <motion.span
                key={gain.at}
                aria-hidden
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.16, ease: ease.in } }}
                transition={reduce ? { duration: 0.15 } : { ...spring.pop, delay: 0.25 }}
                className="inline-flex h-6 items-center gap-1 rounded-full bg-success-soft pl-1.5 pr-2 text-[12px] font-medium text-success tabular"
              >
                <ArrowUp size={12} />
                {fmt.format(gain.amount)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[12.5px] text-fg-2 tabular">
          {ahead === 0 ? (
            "You’re first in line."
          ) : (
            <>
              <NumberFlow value={Math.max(0, shown - 1)} locales={locale} aria-hidden className="text-fg" />{" "}
ahead of you
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-4 pb-4 pt-3.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">{shareTitle}</p>
          <p className="text-pretty text-[12.5px] text-fg-2">{reward}</p>
        </div>

        <div className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-line bg-frame pl-2.5 pr-1">
          <Link size={14} className="shrink-0 text-fg-3" />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg" title={entry.referralUrl}>
            {display}
          </span>
          {canShare && (
            <button
              type="button"
              aria-label="Share link"
              onClick={() => navigator.share({ title: shareTitle, url: entry.referralUrl }).catch(() => {})}
              className={cn(
                "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-2 outline-none",
                "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92]",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "before:absolute before:-inset-2 before:content-['']",
              )}
            >
              <Share size={14} />
            </button>
          )}
          <CopyButton value={entry.referralUrl} size="sm" label="Copy link" copiedLabel="Copied" failedLabel="Failed" />
        </div>

        {referrals > 0 && (
          <p className="text-[12px] text-fg-3 tabular">
            <NumberFlow value={referrals} locales={locale} className="text-fg-2" /> {referrals === 1 ? `${noun[0]} has` : `${noun[1]} have`} joined with your link
          </p>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/** A small ring that closes, then a tick that draws inside it. */
function Tick({ draw }: { draw: boolean }) {
  const d = (delay: number, duration: number) => (draw ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration, ease: ease.out, delay } } : {});
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-success">
      <motion.circle cx="8" cy="8" r="6.25" opacity={0.4} {...d(0.15, 0.4)} />
      <motion.path d="m5.25 8.25 1.9 1.9 3.6-4.15" {...d(0.35, 0.3)} />
    </svg>
  );
}
