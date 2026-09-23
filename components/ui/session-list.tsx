"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Loader, Monitor } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SessionDevice = "desktop" | "laptop" | "phone" | "tablet";

export type Session = {
  id: string;
  device: SessionDevice;
  /** “Chrome”, “Safari”, “Stealth for iOS”. */
  browser?: string;
  /** “macOS”, “Windows 11”, “iOS 19”. */
  os?: string;
  /** Overrides “Browser on OS” as the row title. */
  name?: string;
  /** “Berlin, Germany”. */
  location?: string;
  ip?: string;
  lastActiveAt: Date | string | number;
  /** The session you're using right now. Listed first, can't be signed out here. */
  current?: boolean;
  /** A short warning tag, like “New location”. */
  flag?: string;
};

const title = (s: Session) => s.name ?? ([s.browser, s.os].filter(Boolean).join(" on ") || "Unknown device");

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

// One clock for every list on the page, ticking every 30s while the tab is visible.
// The server has no "now", so relative times render on the client only.
let clockNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;
function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (clockListeners.size === 1) {
    clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      if (document.hidden) return;
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size) window.clearInterval(clockTimer);
  };
}
function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow || (clockNow = Date.now()),
    () => null,
  );
}

function relative(t: number, now: number) {
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), "day");
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: t < now - 86400_000 * 300 ? "numeric" : undefined }).format(t);
}

/* ------------------------------------------------------------------ */
/* Device glyphs, on the library's 16px grid                           */
/* ------------------------------------------------------------------ */

function DeviceIcon({ device }: { device: SessionDevice }) {
  if (device === "desktop") return <Monitor />;
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false };
  if (device === "laptop")
    return (
      <svg {...common}>
        <rect x="3" y="3.25" width="10" height="7.25" rx="1.25" />
        <path d="M1.75 12.75h12.5" />
      </svg>
    );
  if (device === "tablet")
    return (
      <svg {...common}>
        <rect x="2.75" y="2" width="10.5" height="12" rx="1.75" />
        <path d="M7.25 11.75h1.5" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="4.25" y="1.75" width="7.5" height="12.5" rx="1.75" />
      <path d="M7 11.75h2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* SessionList                                                         */
/* ------------------------------------------------------------------ */

export type SessionListProps = Omit<React.ComponentProps<"section">, "title" | "defaultValue" | "onChange"> & {
  sessions?: Session[];
  defaultSessions?: Session[];
  onSessionsChange?: (sessions: Session[]) => void;
  /** Sign one session out. The row folds away when it resolves and shows the error if it rejects. */
  onRevoke?: (session: Session) => void | Promise<unknown>;
  /** Sign out every session but the current one. Falls back to onRevoke for each. */
  onRevokeOthers?: (sessions: Session[]) => void | Promise<unknown>;
  /** Show skeleton rows while the first load is in flight. */
  loading?: boolean;
  heading?: React.ReactNode;
  description?: React.ReactNode;
  /** Minutes within which a session counts as “Active now”. */
  activeWithin?: number;
};

type RowError = Record<string, string>;

export function SessionList({
  sessions: sessionsProp,
  defaultSessions = [],
  onSessionsChange,
  onRevoke,
  onRevokeOthers,
  loading = false,
  heading = "Active sessions",
  description = "Devices signed in to your account. Sign out any you don’t recognize.",
  activeWithin = 5,
  className,
  ...rest
}: SessionListProps) {
  const uid = useId();
  const reduce = !!useReducedMotion();
  const now = useNow();
  const [sessions, setSessions] = useControllableState({ value: sessionsProp, defaultValue: defaultSessions, onChange: onSessionsChange });
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [errors, setErrors] = useState<RowError>({});
  const [confirming, setConfirming] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  // Exit order for a sign-out-everywhere cascade; single sign-outs have no entry and leave at once.
  const [cascade, setCascade] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfter = useRef<string | null>(null);
  const refocusAction = useRef(false);
  const latest = useRef(sessions);
  useEffect(() => {
    latest.current = sessions;
  });

  // Current session first, then most recently active.
  const sorted = [...sessions].sort(
    (a, b) => Number(!!b.current) - Number(!!a.current) || new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
  );
  const others = sorted.filter((s) => !s.current);

  const setRowError = (id: string, message: string | null) =>
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });

  const revoke = async (s: Session) => {
    setRowError(s.id, null);
    setBusy((b) => new Set(b).add(s.id));
    try {
      await onRevoke?.(s);
      const i = others.findIndex((o) => o.id === s.id);
      focusAfter.current = others[i + 1]?.id ?? others[i - 1]?.id ?? "heading";
      setCascade(new Map());
      setSessions(latest.current.filter((x) => x.id !== s.id));
      setAnnouncement(`Signed out ${title(s)}`);
    } catch {
      setRowError(s.id, "Couldn’t sign out this session. Try again.");
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(s.id);
        return next;
      });
    }
  };

  const revokeOthers = async () => {
    setAllError(null);
    setSigningOutAll(true);
    try {
      if (onRevokeOthers) await onRevokeOthers(others);
      else await Promise.all(others.map((s) => onRevoke?.(s)));
      setCascade(new Map(others.map((s, i) => [s.id, i])));
      focusAfter.current = "heading";
      setSessions(latest.current.filter((x) => x.current));
      setConfirming(false);
      setAnnouncement(`Signed out ${others.length} other ${others.length === 1 ? "session" : "sessions"}`);
    } catch {
      setAllError("Couldn’t sign out the other sessions. Try again.");
    } finally {
      setSigningOutAll(false);
    }
  };

  const onExitComplete = () => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (!target) return;
    const el = target === "heading" ? headingRef.current : listRef.current?.querySelector<HTMLElement>(`[data-session="${CSS.escape(target)}"] button`);
    (el ?? headingRef.current)?.focus({ preventScroll: true });
  };

  return (
    <section aria-labelledby={`${uid}-h`} aria-busy={loading || undefined} className={cn("@container flex w-full min-w-0 flex-col gap-3", className)} {...rest}>
      {/* Title and the sign-out-everywhere action share a row; in a narrow column the action drops beneath. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-0.5 @max-[30rem]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 ref={headingRef} id={`${uid}-h`} tabIndex={-1} className="rounded-sm text-[14px] font-medium leading-5 tracking-[-0.015em] text-fg outline-none">
            {heading}
          </h3>
          {description && <p className="text-[12.5px] leading-[18px] text-pretty text-fg-3">{description}</p>}
        </div>
        <AnimatePresence initial={false} mode="popLayout">
          {/* Present but disabled while loading, so the header doesn't grow when the list arrives. */}
          {(loading || others.length > 0) && (
            <motion.div
              key={confirming ? "confirm" : "action"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="flex items-center gap-2"
            >
              {confirming ? (
                <ConfirmAll
                  count={others.length}
                  busy={signingOutAll}
                  onCancel={() => {
                    refocusAction.current = true;
                    setConfirming(false);
                  }}
                  onConfirm={() => void revokeOthers()}
                />
              ) : (
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setConfirming(true)}
                  // Backing out of the confirm puts focus back where it started.
                  ref={(el) => {
                    if (el && refocusAction.current) {
                      refocusAction.current = false;
                      el.focus({ preventScroll: true });
                    }
                  }}
                >
                  Sign out other sessions
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {allError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] leading-[18px] text-danger">
          {allError}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        {loading ? (
          <ul aria-label="Loading sessions" className="flex flex-col">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3 border-t border-line px-4 py-3 first:border-t-0">
                {/* Shaped like a real row, so nothing moves when the sessions arrive. */}
                <span className="mt-0.5 size-8 shrink-0 animate-pulse-soft self-start rounded-lg bg-fg/[0.06]" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="flex h-5 items-center">
                    <span className="h-3 w-36 animate-pulse-soft rounded-sm bg-fg/[0.06]" />
                  </span>
                  <span className="flex h-4 items-center">
                    <span className="h-2.5 w-52 max-w-full animate-pulse-soft rounded-sm bg-fg/[0.05]" />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul ref={listRef} aria-labelledby={`${uid}-h`} className="flex flex-col">
            <AnimatePresence initial={false} custom={cascade} onExitComplete={onExitComplete}>
              {sorted.map((s) => (
                <motion.li
                  key={s.id}
                  data-session={s.id}
                  custom={cascade}
                  initial={false}
                  exit="gone"
                  variants={{
                    // Signing out everywhere folds the rows shut top to bottom, 45ms apart, so you watch them go.
                    gone: (order: ReadonlyMap<string, number>) => {
                      const i = order.get(s.id) ?? 0;
                      const delay = Math.min(i, 8) * 0.045;
                      return reduce
                        ? { opacity: 0, transition: { duration: 0.12, delay: delay / 2 } }
                        : {
                            opacity: 0,
                            height: 0,
                            x: 8,
                            transition: {
                              opacity: { duration: 0.14, delay },
                              x: { duration: 0.18, ease: ease.in, delay },
                              height: { duration: 0.26, ease: ease.inOut, delay: delay + 0.06 },
                            },
                          };
                    },
                  }}
                  className="overflow-hidden border-t border-line first:border-t-0"
                >
                  <Row
                    session={s}
                    now={now}
                    activeWithin={activeWithin}
                    busy={busy.has(s.id) || (signingOutAll && !s.current)}
                    error={errors[s.id]}
                    canRevoke={!!onRevoke && !s.current}
                    onRevoke={() => void revoke(s)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        <AnimatePresence initial={false}>
          {!loading && others.length === 0 && (
            <motion.p
              key="alone"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ height: { duration: 0.24, ease: ease.inOut, delay: 0.2 }, opacity: { duration: 0.2, delay: 0.3 } }}
              className="overflow-hidden text-[12.5px] text-fg-3"
            >
              <span className="block border-t border-line px-4 py-3">No other sessions. You’re only signed in here.</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function Row({
  session: s,
  now,
  activeWithin,
  busy,
  error,
  canRevoke,
  onRevoke,
}: {
  session: Session;
  now: number | null;
  activeWithin: number;
  busy: boolean;
  error?: string;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  const errorId = useId();
  const t = new Date(s.lastActiveAt).getTime();
  const active = s.current || (now != null && now - t < activeWithin * 60_000);
  const name = title(s);

  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3">
      <span aria-hidden className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-hover text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <DeviceIcon device={s.device} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium leading-5 text-fg">
          <span className="min-w-0">{name}</span>
          {s.current && <span className="rounded-full bg-fg/[0.07] px-1.5 py-px text-[11px] font-medium leading-4 text-fg-2">This device</span>}
          {s.flag && <span className="rounded-full bg-warning-soft px-1.5 py-px text-[11px] font-medium leading-4 text-warning">{s.flag}</span>}
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] leading-4 text-fg-3">
          {(s.location || s.ip) && (
            // Where it is stays on one line; if space runs out the address trims, never a dangling dot.
            <span className="flex min-w-0 max-w-full items-center gap-x-1.5 overflow-hidden whitespace-nowrap" title={[s.location, s.ip].filter(Boolean).join(" · ")}>
              {s.location && <span className="shrink-0">{s.location}</span>}
              {s.location && s.ip && <Sep />}
              {s.ip && <span className="min-w-0 truncate font-mono text-[11px] tracking-[0.01em]">{s.ip}</span>}
            </span>
          )}
          {/* In a narrow column the status takes its own line instead of leaving a dot at a line end. */}
          {(s.location || s.ip) && <Sep className="@max-[30rem]:hidden" />}
          {active ? (
            <span className="inline-flex items-center gap-1.5 text-success @max-[30rem]:basis-full">
              <span aria-hidden className="relative grid size-1.5 place-items-center">
                <span className="absolute inset-0 animate-ping-soft rounded-full bg-success/70 motion-reduce:hidden" />
                <span className="size-1.5 rounded-full bg-success" />
              </span>
              Active now
            </span>
          ) : (
            <time dateTime={now != null ? new Date(t).toISOString() : undefined} title={now != null ? new Date(t).toLocaleString() : undefined} className="tabular @max-[30rem]:basis-full">
              {now != null ? `Last active ${relative(t, now)}` : " "}
            </time>
          )}
        </p>
        {error && (
          <p id={errorId} role="alert" className="pt-1 text-[12px] leading-4 text-danger">
            {error}
          </p>
        )}
      </div>

      {canRevoke && (
        <Button
          variant="ghost"
          busy={busy}
          onClick={onRevoke}
          aria-label={`Sign out ${name}${s.location ? `, ${s.location}` : ""}`}
          aria-describedby={error ? errorId : undefined}
          className="-mr-1.5 mt-0.5"
        >
          Sign out
        </Button>
      )}
    </div>
  );
}

const Sep = ({ className }: { className?: string }) => (
  <span aria-hidden className={cn("text-fg-4", className)}>
    ·
  </span>
);

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

function Button({
  variant,
  busy = false,
  className,
  children,
  onClick,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { variant: "secondary" | "ghost" | "danger"; busy?: boolean }) {
  // The spinner only shows if the wait passes 150ms, so quick sign-outs never flash it.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setSlow(true), 150);
    return () => {
      window.clearTimeout(t);
      setSlow(false);
    };
  }, [busy]);
  const spinning = busy && slow;

  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      data-variant={variant}
      onClick={busy ? undefined : onClick}
      className={cn(
        "relative inline-grid h-7 shrink-0 place-items-center rounded-md px-2.5 text-[12.5px] font-medium outline-none select-none",
        "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75 aria-busy:active:scale-100",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
        variant === "secondary" && "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] enabled:hover:border-fg-4 enabled:hover:bg-hover disabled:opacity-50",
        variant === "ghost" && (busy ? "text-fg-3" : "text-fg-2 hover:bg-danger-soft hover:text-danger"),
        variant === "danger" && "bg-danger text-frame shadow-[var(--shadow)] hover:bg-danger/90",
        className,
      )}
      {...props}
    >
      {/* The label keeps its place under the spinner, so the button never changes width. */}
      <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", spinning && "opacity-0")}>{children}</span>
      {spinning && (
        <span className="col-start-1 row-start-1 grid place-items-center">
          <Loader size={14} className="animate-spin" />
        </span>
      )}
    </button>
  );
}

function ConfirmAll({ count, busy, onCancel, onConfirm }: { count: number; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Keyboard users land on the verb; Escape backs out.
  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      role="group"
      aria-label="Confirm signing out other sessions"
      className="flex items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <span className="text-[12.5px] text-fg-2">
        Sign out {count} other {count === 1 ? "session" : "sessions"}?
      </span>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button ref={confirmRef} variant="danger" busy={busy} onClick={onConfirm}>
        Sign out
      </Button>
    </div>
  );
}
