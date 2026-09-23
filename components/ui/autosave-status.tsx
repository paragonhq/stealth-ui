"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type AutosaveState = "idle" | "saving" | "saved" | "offline" | "error";

/** Whether the browser thinks it is online, kept current. Renders as online on the server. */
export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export type AutosaveStatusProps = Omit<React.ComponentProps<"div">, "children"> & {
  status: AutosaveState;
  /** When the last save landed. Drives “Saved 2m ago”, refreshed every 30 seconds. */
  savedAt?: Date | number | null;
  /** Changes waiting while offline, e.g. “3 changes waiting”. */
  pending?: number;
  /** Shown after “Couldn’t save”. Omit to hide the button. */
  onRetry?: () => void;
  /** The spinner holds at least this long, so a quick save never flickers. */
  minSaving?: number;
  locale?: string;
};

// A save that finishes in 80ms still shows "Saving…" for a readable moment.
function useHeldStatus(status: AutosaveState, minSaving: number) {
  const [shown, setShown] = useState(status);
  const since = useRef(0);
  useEffect(() => {
    if (status === shown) return;
    if (status === "saving") since.current = performance.now();
    const wait = shown === "saving" ? Math.max(0, minSaving - (performance.now() - since.current)) : 0;
    const t = window.setTimeout(() => setShown(status), wait);
    return () => window.clearTimeout(t);
  }, [status, shown, minSaving]);
  return shown;
}

function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);
  return now;
}

function relative(then: number, now: number, locale?: string) {
  const s = Math.round((then - now) / 1000);
  const f = new Intl.RelativeTimeFormat(locale, { style: "narrow", numeric: "auto" });
  if (s > -45) return "just now";
  if (s > -3600) return f.format(Math.round(s / 60), "minute");
  if (s > -86400) return f.format(Math.round(s / 3600), "hour");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(then);
}

export function AutosaveStatus({ status, savedAt, pending, onRetry, minSaving = 600, locale, className, ...rest }: AutosaveStatusProps) {
  const reduce = useReducedMotion();
  const shown = useHeldStatus(status, minSaving);
  const at = savedAt == null ? null : typeof savedAt === "number" ? savedAt : savedAt.getTime();
  const now = useNow(shown === "saved" && at != null);
  const when = at != null && now != null ? relative(at, now, locale) : null;

  const text =
    shown === "saving"
      ? "Saving…"
      : shown === "saved"
        ? "Saved"
        : shown === "offline"
          ? pending
            ? `Offline · ${pending} ${pending === 1 ? "change" : "changes"} waiting`
            : "Offline, will retry"
          : shown === "error"
            ? "Couldn’t save"
            : "";
  const announce = shown === "saving" ? "" : shown === "saved" ? "Saved" : text;

  // The pill's width springs to fit each state, measured from an invisible copy of the content.
  const sizer = useRef<HTMLSpanElement>(null);
  const width = useMotionValue(-1);
  const cssWidth = useTransform(width, (w) => (w < 0 ? "auto" : w));
  useLayoutEffect(() => {
    const w = sizer.current?.offsetWidth ?? 0;
    if (width.get() < 0 || reduce) width.set(w);
    else animate(width, w, spring.snappy);
  }, [shown, when, pending, width, reduce]);

  const content = (s: AutosaveState, live: boolean) => (
    <>
      {s !== "idle" && <Glyph state={s} reduce={!!reduce} live={live} />}
      <span className={cn("whitespace-nowrap", s === "error" ? "text-danger" : s === "saved" ? "text-fg-2" : "text-fg-3")}>{text}</span>
      {s === "saved" && when && (
        <time
          suppressHydrationWarning
          dateTime={at ? new Date(at).toISOString() : undefined}
          title={at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(at) : undefined}
          className="whitespace-nowrap text-fg-3 tabular"
        >
          {when}
        </time>
      )}
      {s === "error" && onRetry && <span className="w-[42px]" aria-hidden />}
    </>
  );

  return (
    <div data-state={shown} className={cn("relative inline-flex h-7 items-center", className)} {...rest}>
      <motion.span
        className="relative block h-7 overflow-hidden"
        style={{ width: cssWidth }}
        animate={{ opacity: shown === "idle" ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <span ref={sizer} aria-hidden className="invisible absolute left-0 top-0 inline-flex h-7 items-center gap-1.5 px-0.5 text-[12px]">
          {content(shown, false)}
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={shown}
            className="absolute left-0 top-0 inline-flex h-7 items-center gap-1.5 px-0.5 text-[12px]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
            transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
          >
            {content(shown, true)}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      {/* The retry sits outside the clipped pill so its focus ring and hit area are never cut. */}
      {shown === "error" && onRetry && (
        <motion.button
          type="button"
          onClick={onRetry}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: ease.out, delay: reduce ? 0 : 0.08 }}
          className={cn(
            "absolute right-0.5 rounded-[4px] text-[12px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none",
            "transition-[text-decoration-color] duration-150 hover:decoration-fg-2",
            "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
            "before:absolute before:-inset-x-2 before:-inset-y-2.5 before:content-['']",
          )}
        >
          Retry
        </motion.button>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

const svg = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Glyph({ state, reduce, live }: { state: AutosaveState; reduce: boolean; live: boolean }) {
  const draw = live && !reduce;
  if (state === "saving")
    return (
      <svg {...svg} strokeWidth={1.5} className="shrink-0 animate-spin text-fg-3 [animation-duration:0.8s]">
        <circle cx="8" cy="8" r="5.75" opacity="0.25" />
        <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
      </svg>
    );
  if (state === "saved")
    return (
      <svg {...svg} strokeWidth={1.7} className="shrink-0 text-success">
        <motion.path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          initial={draw ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }}
        />
      </svg>
    );
  if (state === "offline")
    return (
      <span className="relative grid size-3.5 shrink-0 place-items-center" aria-hidden>
        <span className="size-1.5 rounded-full bg-warning" />
        {live && <span className="absolute size-1.5 animate-ping-soft rounded-full bg-warning [animation-duration:2.4s]" />}
      </span>
    );
  if (state === "error")
    return (
      <svg {...svg} strokeWidth={1.5} className="shrink-0 text-danger">
        <circle cx="8" cy="8" r="5.75" />
        <motion.path d="M8 5v3.5" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.2, ease: ease.out }} />
        <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
      </svg>
    );
  return null;
}
