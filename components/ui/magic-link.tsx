"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, ArrowLeft, ArrowUpRight } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type MailApp = "gmail" | "outlook" | "outlook-work" | "yahoo" | "icloud" | "proton";

const mailApps: Record<MailApp, { name: string; href: (sender?: string) => string }> = {
  // With a sender, Gmail opens straight onto a search for the email instead of the inbox.
  gmail: {
    name: "Gmail",
    href: (sender) =>
      sender
        ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${sender} in:anywhere newer_than:1h`)}`
        : "https://mail.google.com/mail/u/0/#inbox",
  },
  outlook: { name: "Outlook", href: () => "https://outlook.live.com/mail/0/" },
  "outlook-work": { name: "Outlook", href: () => "https://outlook.office.com/mail/" },
  yahoo: { name: "Yahoo Mail", href: () => "https://mail.yahoo.com/" },
  icloud: { name: "iCloud Mail", href: () => "https://www.icloud.com/mail/" },
  proton: { name: "Proton Mail", href: () => "https://mail.proton.me/u/0/inbox" },
};

/** Guess the inbox from the address. Company domains usually live on one of the two big suites, so offer both. */
export function mailAppsFor(email: string): MailApp[] {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (/^(gmail|googlemail)\.com$/.test(domain)) return ["gmail"];
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return ["outlook"];
  if (/^(yahoo|ymail)\.[a-z.]+$/.test(domain)) return ["yahoo"];
  if (/^(icloud|me|mac)\.com$/.test(domain)) return ["icloud"];
  if (/^(proton\.me|protonmail\.com|pm\.me)$/.test(domain)) return ["proton"];
  return ["gmail", "outlook-work"];
}

/**
 * A resend cooldown measured against the clock, so a background tab still lands
 * on the right second. Pass a list to back off: 30s, then 60s, then 120s.
 */
export function useResendCooldown(cooldown: number | number[] = 30, startOnMount = true) {
  const steps = Array.isArray(cooldown) ? cooldown : [cooldown];
  const [count, setCount] = useState(0);
  const [clock, setClock] = useState({ until: 0, now: 0 });
  const started = useRef(false);

  const start = () => {
    const now = Date.now();
    const seconds = steps[Math.min(count, steps.length - 1)] ?? 30;
    setCount((c) => c + 1);
    setClock({ until: now + seconds * 1000, now });
  };

  // The first cooldown starts when the screen appears: an email was just sent.
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });
  useEffect(() => {
    if (!startOnMount || started.current) return;
    const id = window.setTimeout(() => {
      started.current = true;
      startRef.current();
    }, 0);
    return () => window.clearTimeout(id);
  }, [startOnMount]);

  useEffect(() => {
    if (!clock.until) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setClock((c) => ({ ...c, now }));
      if (now >= clock.until) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [clock.until]);

  // Before the first tick (and on the server) show the full first wait, so the
  // label never flashes "Resend" before the countdown has started.
  const remaining = clock.until ? Math.max(0, Math.ceil((clock.until - clock.now) / 1000)) : startOnMount ? (steps[0] ?? 0) : 0;
  return { remaining, ready: remaining === 0 && (clock.until > 0 || !startOnMount), start };
}

export type MagicLinkProps = Omit<React.ComponentProps<"div">, "title" | "children"> & {
  /** Where the link went. */
  email: string;
  /** The address the email comes from. Lets the Gmail shortcut open straight onto it. */
  sender?: string;
  /** Minutes until the link stops working. */
  expiresIn?: number;
  /** Send another link. Throw with a message to show it in place. */
  onResend?: () => Promise<void> | void;
  /** Seconds before another link can be sent; a list backs off with each send. */
  cooldown?: number | number[];
  onChangeEmail?: () => void;
  /** Inbox shortcuts. Guessed from the address by default; an empty list hides them. */
  apps?: MailApp[];
  /** The link was opened (usually in another tab). The envelope opens and the copy changes. */
  verified?: boolean;
  title?: React.ReactNode;
  verifiedTitle?: React.ReactNode;
  verifiedDescription?: React.ReactNode;
};

export function MagicLink({
  email,
  sender,
  expiresIn = 15,
  onResend,
  cooldown = [30, 60, 120],
  onChangeEmail,
  apps,
  verified = false,
  title = "Check your email",
  verifiedTitle = "You’re signed in",
  verifiedDescription = "Carry on in this tab. You can close the other one.",
  className,
  ...rest
}: MagicLinkProps) {
  const reduce = useReducedMotion();
  const { remaining, ready, start } = useResendCooldown(cooldown);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  // Bumping this replays the letter going into the envelope.
  const [sends, setSends] = useState(0);
  const [announce, setAnnounce] = useState("");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const shortcuts = apps ?? mailAppsFor(email);

  async function resend() {
    if (state !== "idle" || !ready || verified) return;
    setState("sending");
    setError(null);
    try {
      await onResend?.();
      setState("sent");
      setSends((n) => n + 1);
      setAnnounce(`We sent another link to ${email}`);
      start();
      timer.current = window.setTimeout(() => setState("idle"), 1800);
    } catch (err) {
      setState("idle");
      setError(err instanceof Error && err.message ? err.message : "Couldn’t send another link. Try again in a moment.");
    }
  }

  const label = state === "sending" ? "sending" : state === "sent" ? "sent" : remaining > 0 ? "wait" : "ready";

  // When the link is opened the card sheds its actions; its height glides down
  // instead of snapping. At rest it is auto, so hints and errors grow it freely.
  const card = useRef<HTMLDivElement>(null);
  const settled = useRef(0);
  const moving = useRef<AnimationPlaybackControls | null>(null);
  const lastVerified = useRef(verified);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!moving.current) settled.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (lastVerified.current === verified) return;
    lastVerified.current = verified;
    const el = card.current;
    if (!el || reduce) return;
    const from = moving.current ? el.offsetHeight : settled.current;
    moving.current?.stop();
    el.style.height = "";
    const to = el.offsetHeight;
    if (!from || Math.abs(from - to) < 1) return;
    el.dataset.moving = "";
    const controls = animate(el, { height: [from, to] }, { duration: 0.36, ease: ease.inOut });
    moving.current = controls;
    controls.then(() => {
      if (moving.current !== controls) return;
      moving.current = null;
      el.style.height = "";
      delete el.dataset.moving;
      settled.current = el.offsetHeight;
    });
  }, [verified, reduce]);

  return (
    <div
      ref={card}
      data-state={verified ? "verified" : "waiting"}
      className={cn(
        "flex w-full max-w-[360px] flex-col items-center gap-5 rounded-xl border border-line bg-raised px-5 pb-5 pt-4 text-center shadow-[var(--shadow)] data-moving:overflow-hidden sm:px-6 sm:pb-6",
        className,
      )}
      {...rest}
    >
      <Envelope key={sends} open={verified} reduce={!!reduce} />

      <div className="grid w-full">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={verified ? "verified" : "waiting"}
            className="flex min-w-0 flex-col items-center gap-1.5"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: ease.out, delay: reduce ? 0 : 0.05 }}
          >
            <h2 className="text-balance text-[15px] font-medium leading-5 tracking-[-0.015em] text-fg">{verified ? verifiedTitle : title}</h2>
            {verified ? (
              <p className="text-pretty text-[12.5px] leading-[18px] text-fg-2">{verifiedDescription}</p>
            ) : (
              <>
                <p className="text-pretty text-[12.5px] leading-[18px] text-fg-2">We sent a sign-in link to</p>
                <span className="inline-flex h-7 min-w-0 max-w-full items-center rounded-full border border-line bg-frame px-3" title={email}>
                  <span className="min-w-0 truncate text-[12.5px] font-medium text-fg">{email}</span>
                </span>
                {expiresIn > 0 && (
                  <p className="pt-0.5 text-[12px] text-fg-3">
                    The link works for {expiresIn} {expiresIn === 1 ? "minute" : "minutes"}.
                  </p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!verified && shortcuts.length > 0 && (
        // Two inboxes sit side by side, and stack when the card is too narrow for both names.
        <div className="@container/apps w-full">
          <div className={cn("grid w-full gap-2", shortcuts.length > 1 && "@[18rem]/apps:grid-cols-2")}>
          {shortcuts.map((app) => (
            <a
              key={app}
              href={mailApps[app].href(sender)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group/app inline-flex h-9 min-w-0 select-none items-center justify-center gap-1.5 rounded-lg border border-line-2 bg-raised px-3 text-[13px] font-medium text-fg shadow-[var(--shadow)] outline-none pointer-coarse:h-11",
                "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.98] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              )}
            >
              <span className="min-w-0 truncate">Open {mailApps[app].name}</span>
              <ArrowUpRight
                size={14}
                className="shrink-0 text-fg-3 transition-[translate,color] duration-200 ease-out group-hover/app:translate-x-px group-hover/app:-translate-y-px group-hover/app:text-fg"
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
          </div>
        </div>
      )}

      {!verified && (
        <div className="flex w-full flex-col gap-2">
          <AnimatePresence initial={false}>
            {(error || (ready && state === "idle")) && (
              <motion.div
                key={error ? "error" : "hint"}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.in } }}
                transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { duration: 0.22, ease: ease.out }}
                className="overflow-hidden"
              >
                {error ? (
                  <p role="alert" className="flex items-start justify-center gap-1.5 text-[12px] leading-4 text-danger">
                    <Alert size={14} className="mt-px shrink-0" />
                    <span className="text-pretty">{error}</span>
                  </p>
                ) : (
                  <p className="text-[12px] leading-4 text-fg-3">Not in your inbox? Check spam before sending another.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex min-h-7 w-full items-center justify-between gap-3">
            {onChangeEmail ? (
              <TextButton onClick={onChangeEmail} className="group/back">
                <ArrowLeft size={14} className="shrink-0 transition-transform duration-200 ease-out group-hover/back:-translate-x-0.5" />
                Use a different email
              </TextButton>
            ) : (
              <span />
            )}
            {onResend && (
              <TextButton
                onClick={resend}
                disabled={label === "wait" || label === "sent"}
                aria-busy={label === "sending" || undefined}
                aria-label={label === "wait" ? `Resend email, available in ${remaining} seconds` : undefined}
              >
                <span className="grid justify-items-end">
                  {["Resend in 0:00", "Resend email", "Sending…", "Sent"].map((l) => (
                    <span key={l} aria-hidden className="invisible col-start-1 row-start-1 tabular">
                      {l}
                    </span>
                  ))}
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={label}
                      className="col-start-1 row-start-1 inline-flex items-center gap-1 tabular"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
                      transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
                    >
                      {label === "wait" && (
                        <span>
                          Resend in {Math.floor(remaining / 60)}:
                          <NumberFlow value={remaining % 60} format={{ minimumIntegerDigits: 2 }} trend={-1} animated={!reduce} />
                        </span>
                      )}
                      {label === "ready" && "Resend email"}
                      {label === "sending" && "Sending…"}
                      {label === "sent" && (
                        <>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-success">
                            <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }} />
                          </svg>
                          Sent
                        </>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </TextButton>
            )}
          </div>
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {verified ? "Signed in" : announce}
      </span>
    </div>
  );
}

function TextButton({ className, children, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "-mx-1.5 inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12.5px] text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:text-fg-3",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// The letter drops into the envelope and the flap folds shut, once per email sent.
// When the link is opened the flap lifts and the letter rises with a check. The
// flap is two shapes: the open half behind the letter, the shut half in front of
// it, each folding flat at the hinge, so it reads as one flap turning over.
// The server and client render the same starting frame; reduced motion only
// zeroes the durations, so hydration never disagrees.
function Envelope({ open, reduce }: { open: boolean; reduce: boolean }) {
  const t = (closing: object, opening: object) => (reduce ? { duration: 0 } : open ? opening : closing);
  return (
    <svg width="64" height="60" viewBox="0 0 64 60" fill="none" aria-hidden className="shrink-0 overflow-visible text-fg-3">
      <rect x="8" y="24" width="48" height="31" rx="4" className="fill-hover" stroke="currentColor" strokeWidth="1.25" />
      {/* Flap, open: behind the letter */}
      <motion.path
        d="M8.6 24.4 32 8.5l23.4 15.9"
        className="fill-hover"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        style={{ originY: 1 }}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: open ? 1 : 0 }}
        transition={t({ duration: 0.16, ease: ease.in, delay: 0.52 }, { duration: 0.16, ease: ease.out, delay: 0.16 })}
      />
      <motion.g
        initial={{ y: -22, opacity: 0 }}
        animate={{ y: open ? -12 : 10, opacity: 1 }}
        transition={reduce ? { duration: 0 } : open ? { ...spring.soft, delay: 0.26 } : { duration: 0.55, ease: ease.out, delay: 0.08, opacity: { duration: 0.2, delay: 0.08 } }}
      >
        <rect x="15" y="16" width="34" height="26" rx="2.5" className="fill-raised" stroke="currentColor" strokeWidth="1.25" />
        <AnimatePresence initial={false}>
          {open ? (
            <motion.path
              key="check"
              d="M26.5 28.5 30.5 32.5 38 24"
              className="text-success"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: ease.out, delay: 0.5, opacity: { duration: 0.01, delay: 0.5 } }}
            />
          ) : (
            <motion.path
              key="lines"
              d="M21 23.5h22M21 28.5h22M21 33.5h13"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              opacity="0.6"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            />
          )}
        </AnimatePresence>
      </motion.g>
      {/* Front pocket, which hides the lower part of the letter */}
      <path d="M8 27.5 32 43.5 56 27.5V51a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" className="fill-raised" />
      <path d="M8 27V51a4 4 0 0 0 4 4h40a4 4 0 0 0 4-4V27" stroke="currentColor" strokeWidth="1.25" />
      {/* The pocket's edge shows only while the flap is up; shut, the flap's own edge takes its place. */}
      <motion.path
        d="M8.6 27.9 32 43.5l23.4-15.6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        initial={{ opacity: 1 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={t({ duration: 0.08, delay: 0.72 }, { duration: 0.08 })}
      />
      <path d="M9.5 53.5 26 39.8M54.5 53.5 38 39.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.45" />
      {/* Flap, shut: in front of the letter */}
      <motion.path
        d="M8.6 25.4 32 43.5l23.4-18.1"
        className="fill-raised"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        style={{ originY: 0 }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: open ? 0 : 1 }}
        transition={t({ duration: 0.2, ease: ease.out, delay: 0.68 }, { duration: 0.16, ease: ease.in })}
      />
    </svg>
  );
}
