"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type ConnectionState = "online" | "offline" | "reconnecting";
type Phase = "hidden" | "offline" | "reconnecting" | "back";

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** The browser's own online flag, live. Always true on the server so nothing flashes on load. */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** Seconds until `at`, ticking on the second while `at` is set. null on the server or with no target. */
function useSecondsUntil(at: number | undefined) {
  const [clock] = useState(() => ({ now: 0 }));
  const subscribe = useCallback(
    (notify: () => void) => {
      if (at === undefined) return () => {};
      let timer = 0;
      const tick = () => {
        clock.now = Date.now();
        notify();
        const left = at - clock.now;
        if (left > 0) timer = window.setTimeout(tick, left % 1000 || 1000);
      };
      tick();
      return () => window.clearTimeout(timer);
    },
    [at, clock],
  );
  const now = useSyncExternalStore(
    subscribe,
    () => clock.now,
    () => 0,
  );
  if (at === undefined || now === 0) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
const digitTiming = {
  transformTiming: { duration: 380, easing: expo },
  spinTiming: { duration: 380, easing: expo },
  opacityTiming: { duration: 140, easing: "ease-out" },
};

export type ConnectionStatusProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Drive it from your own socket or sync engine. Left out, it follows the browser's online and offline events. */
  status?: ConnectionState;
  /** When the next automatic attempt happens (epoch ms), shown as a countdown while reconnecting. */
  retryAt?: number;
  /** Shows a Retry now button while reconnecting. */
  onRetry?: () => void;
  /** Changes waiting to sync. Named while offline; counted down to "synced" once back. */
  pending?: number;
  /** How long "Back online" stays after the last change has synced, in ms. */
  backOnlineFor?: number;
  /** fixed pins it to the viewport; absolute keeps it inside a positioned parent. */
  position?: "fixed" | "absolute";
  placement?: "top" | "bottom";
};

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

export function ConnectionStatus({
  status: statusProp,
  retryAt,
  onRetry,
  pending = 0,
  backOnlineFor = 2400,
  position = "fixed",
  placement = "bottom",
  className,
  ...rest
}: ConnectionStatusProps) {
  const reduce = useReducedMotion();
  const browserOnline = useOnlineStatus();
  const status: ConnectionState = statusProp ?? (browserOnline ? "online" : "offline");
  const seconds = useSecondsUntil(status === "reconnecting" ? retryAt : undefined);

  // "Back online" is a moment, not a state: it starts when the connection returns
  // and remembers how many changes it has to sync on the way out.
  const [previous, setPrevious] = useState(status);
  const [back, setBack] = useState(false);
  const [queued, setQueued] = useState(0);
  const [trying, setTrying] = useState(false);
  const [lastRetryAt, setLastRetryAt] = useState(retryAt);
  if (previous !== status) {
    setPrevious(status);
    setTrying(false);
    if (status === "online" && previous !== "online") {
      setBack(true);
      setQueued(pending);
    } else if (status !== "online") setBack(false);
  }
  if (lastRetryAt !== retryAt) {
    setLastRetryAt(retryAt);
    setTrying(false);
  }

  // Leave only once everything has synced, and then after a beat so the tick is seen.
  useEffect(() => {
    if (!back || pending > 0) return;
    const t = window.setTimeout(() => setBack(false), backOnlineFor);
    return () => window.clearTimeout(t);
  }, [back, pending, backOnlineFor]);

  const phase: Phase = status === "offline" ? "offline" : status === "reconnecting" ? "reconnecting" : back ? "back" : "hidden";
  const attempting = trying || seconds === 0;

  // The pill's width follows its content on a spring instead of snapping.
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  const fromEdge = placement === "bottom" ? 16 : -16;
  const content = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: fromEdge / 2, filter: "blur(3px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -fromEdge / 2, filter: "blur(3px)", transition: { duration: 0.14, ease: ease.in } },
    transition: { duration: reduce ? 0.12 : 0.24, ease: ease.out },
  };

  let spoken = "";
  if (phase === "offline") spoken = pending ? `You’re offline. ${plural(pending, "change", "changes")} will sync when you reconnect.` : "You’re offline. Changes will sync when you reconnect.";
  if (phase === "reconnecting") spoken = "Connection lost. Reconnecting.";
  if (phase === "back") spoken = "Back online.";

  return (
    <div
      data-slot="connection-status"
      data-state={phase}
      className={cn(
        "pointer-events-none inset-x-4 z-(--z-toast) flex justify-center @container",
        position === "fixed" ? "fixed" : "absolute",
        placement === "bottom" ? (position === "fixed" ? "bottom-[max(16px,env(safe-area-inset-bottom))]" : "bottom-4") : "top-4",
        className,
      )}
      {...rest}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {spoken}
      </span>
      <AnimatePresence>
        {phase !== "hidden" && (
          <motion.div
            key="pill"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: fromEdge, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", width: width ?? "auto" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: fromEdge * 0.75, scale: 0.98, transition: { duration: 0.18, ease: ease.in } }}
            transition={reduce ? { duration: 0.15, width: { duration: 0 } } : { ...spring.snappy, width: spring.soft }}
            className="pointer-events-auto relative h-10 overflow-hidden rounded-full border border-line-2 bg-raised shadow-pop"
          >
            <div ref={inner} className="flex h-full w-max max-w-[calc(100cqw-2px)] items-center">
              <AnimatePresence initial={false} mode="popLayout">
                {phase === "offline" && (
                  <motion.div key="offline" {...content} className="flex h-10 min-w-0 items-center gap-2.5 pl-3 pr-4">
                    <WifiOff />
                    <p className="flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-[13px]">
                      <span className="shrink-0 font-medium text-fg">You’re offline</span>
                      <span className="min-w-0 truncate text-[12.5px] text-fg-3">
                        {pending ? `${plural(pending, "change", "changes")} will sync later` : "Changes will sync later"}
                      </span>
                    </p>
                  </motion.div>
                )}
                {phase === "reconnecting" && (
                  <motion.div key="reconnecting" {...content} className={cn("flex h-10 min-w-0 items-center gap-2.5 pl-3", onRetry ? "pr-1" : "pr-4")}>
                    <Spinner />
                    <p className="flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-[13px]">
                      <span className="shrink-0 font-medium text-fg">Reconnecting</span>
                      <span aria-hidden className="inline-flex min-w-0 items-baseline overflow-hidden text-[12.5px] text-fg-3 tabular">
                        {attempting || seconds === null ? (
                          "Trying now…"
                        ) : (
                          <>
                            {/* Narrow containers keep just the seconds. */}
                            <span className="@max-sm:hidden">Trying again in&nbsp;</span>
                            <NumberFlow value={seconds} suffix="s" {...digitTiming} />
                          </>
                        )}
                      </span>
                    </p>
                    {onRetry && (
                      <button
                        type="button"
                        disabled={attempting}
                        onClick={() => {
                          setTrying(true);
                          onRetry();
                        }}
                        className={cn(
                          "relative ml-1 h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium text-fg outline-none",
                          "transition-[background-color,opacity,scale] duration-150 hover:bg-hover active:scale-[0.96] active:duration-75 disabled:pointer-events-none disabled:opacity-40",
                          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                          "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
                        )}
                      >
                        Retry now
                      </button>
                    )}
                  </motion.div>
                )}
                {phase === "back" && (
                  <motion.div key="back" {...content} className="flex h-10 min-w-0 items-center gap-2.5 pl-3 pr-4">
                    <Tick reduce={!!reduce} />
                    <p className="flex min-w-0 items-baseline gap-2 overflow-hidden whitespace-nowrap text-[13px]">
                      <span className="shrink-0 font-medium text-fg">Back online</span>
                      {queued > 0 && (
                        <span className="inline-flex min-w-0 items-baseline overflow-hidden text-[12.5px] text-fg-3 tabular">
                          {pending > 0 ? (
                            <>
                              Syncing&nbsp;
                              <NumberFlow value={Math.max(1, queued - pending + 1)} {...digitTiming} />
                              &nbsp;of {queued}
                            </>
                          ) : (
                            `${plural(queued, "change", "changes")} synced`
                          )}
                        </span>
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function WifiOff() {
  return (
    <svg {...svg} className="shrink-0 text-fg-2">
      <path d="M2.2 6.2a8.4 8.4 0 0 1 3.1-1.9M9.6 4.1a8.4 8.4 0 0 1 4.2 2.1M4.3 8.4a5.4 5.4 0 0 1 2.3-1.3M11.7 8.4a5.4 5.4 0 0 0-1.2-.8M6.4 10.6a2.4 2.4 0 0 1 3.2 0" />
      <circle cx="8" cy="12.9" r=".7" fill="currentColor" stroke="none" />
      <path d="m2.75 2.75 10.5 10.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg {...svg} className="shrink-0 animate-spin text-fg-2 [animation-duration:900ms] motion-reduce:animate-none">
      <circle cx="8" cy="8" r="5.75" className="opacity-25" />
      <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
    </svg>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      className="grid size-4 shrink-0 place-items-center rounded-full bg-success text-frame"
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.pop}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <motion.path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.32, ease: ease.out, delay: 0.1 }}
        />
      </svg>
    </motion.span>
  );
}
