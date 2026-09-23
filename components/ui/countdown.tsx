"use client";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type DateInput = Date | string | number;
type Unit = "day" | "hour" | "minute" | "second";

const toTime = (d: DateInput) => (d instanceof Date ? d.getTime() : typeof d === "number" ? d : Date.parse(d));
const noop = () => () => {};
const stamp = () => ({ now: Date.now() });

function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

/**
 * Milliseconds left until `to`, ticking on the exact second boundary of the
 * target. While `paused` (off screen, tab hidden) it stops ticking but still
 * wakes once at the end, so completion is never missed. null on the server.
 */
export function useCountdown(to: DateInput, { paused = false }: { paused?: boolean } = {}) {
  const at = toTime(to);
  const [clock] = useState(stamp);
  const subscribe = useCallback(
    (notify: () => void) => {
      let timer = 0;
      const tick = () => {
        window.clearTimeout(timer);
        clock.now = Date.now();
        notify();
        const left = at - clock.now;
        if (Number.isNaN(left) || left <= 0) return;
        // Asleep: skip the seconds and wake only for the finish.
        const next = paused || document.hidden ? left : left % 1000 || 1000;
        timer = window.setTimeout(tick, next + 2);
      };
      tick();
      document.addEventListener("visibilitychange", tick);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", tick);
      };
    },
    [clock, at, paused],
  );
  const now = useSyncExternalStore(
    subscribe,
    () => clock.now,
    () => null,
  );
  return useMemo(() => {
    if (now == null || Number.isNaN(at)) return { remaining: null, parts: null, ended: false };
    const remaining = Math.max(0, at - now);
    const total = Math.ceil(remaining / 1000);
    const parts: CountdownParts = {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
    return { remaining, parts, ended: remaining === 0 };
  }, [now, at]);
}

/** "2 days, 4 hours, 12 minutes" for screen readers, to the minute (or ten seconds near the end). */
function spoken(locale: string, p: CountdownParts) {
  const total = p.days * 86400 + p.hours * 3600 + p.minutes * 60 + p.seconds;
  const unit = (u: Unit, n: number) => new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "long" }).format(n);
  const list: string[] =
    total < 60
      ? [unit("second", Math.ceil(total / 10) * 10 || total)]
      : [p.days && unit("day", p.days), p.hours && unit("hour", p.hours), p.minutes && unit("minute", p.minutes)].filter((x): x is string => !!x);
  return new Intl.ListFormat(locale, { style: "long", type: "unit" }).format(list);
}

/** The word for a unit, plural-aware and in the reader's language: "days", "hour", "Minuten". */
function unitWord(locale: string, u: Unit, n: number, display: "long" | "narrow") {
  const parts = new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: display }).formatToParts(n);
  return parts.find((p) => p.type === "unit")?.value ?? u;
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
const timing = {
  transformTiming: { duration: 550, easing: expo },
  spinTiming: { duration: 550, easing: expo },
  opacityTiming: { duration: 200, easing: "ease-out" },
};

export type CountdownProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** When it ends: a Date, a timestamp in ms, or an ISO string. */
  to: DateInput;
  /** Tiles with unit labels, or one line of text that sits in a sentence. */
  variant?: "block" | "compact";
  /** Seconds left at which it turns to the warning color, for holds and expiring offers. */
  warnBelow?: number;
  /** What replaces the digits once it ends. */
  ended?: React.ReactNode;
  /** Called once, when it reaches zero while mounted. */
  onComplete?: () => void;
  /** Accessible name, read before the time: "Sale ends in". */
  label?: string;
  locale?: string;
};

export function Countdown({
  to,
  variant = "block",
  warnBelow,
  ended: endedContent = "Ended",
  onComplete,
  label,
  locale: localeProp,
  className,
  ref,
  ...rest
}: CountdownProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const { parts, ended, remaining } = useCountdown(to, { paused: !onScreen });
  const [announce, setAnnounce] = useState(false);
  const wasEnded = useRef<boolean | null>(null);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setEl(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // Off screen, the digits stop; they catch up with a roll when scrolled back.
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [el]);

  // onComplete fires on the live transition only, not when mounting already past.
  useEffect(() => {
    if (remaining == null) return;
    if (wasEnded.current === false && ended) {
      onComplete?.();
      setAnnounce(true);
    }
    wasEnded.current = ended;
  }, [ended, remaining, onComplete]);

  const warn = warnBelow != null && remaining != null && !ended && remaining <= warnBelow * 1000;
  const state = remaining == null ? "pending" : ended ? "ended" : "running";

  const numbers = (compact: boolean) => {
    if (!parts) return null;
    const units: { u: Unit; n: number; max?: number }[] = [];
    if (parts.days > 0) units.push({ u: "day", n: parts.days });
    if (!compact || parts.days > 0 || parts.hours > 0) units.push({ u: "hour", n: parts.hours, max: 2 });
    units.push({ u: "minute", n: parts.minutes, max: 5 }, { u: "second", n: parts.seconds, max: 5 });
    return units;
  };

  const flow = (n: number, u: Unit, max: number | undefined, pad: boolean) => (
    <NumberFlow
      value={n}
      locales={locale}
      format={{ minimumIntegerDigits: pad ? 2 : 1, useGrouping: false }}
      digits={max != null ? { 1: { max } } : undefined}
      trend={-1}
      animated={!reduce}
      data-unit={u}
      {...timing}
    />
  );

  const running =
    variant === "compact" ? (
      // NumberFlow's mask is taller than the line; a line-high box keeps it level with the text beside it.
      <span className="inline-flex h-[1lh] items-center">
        <span className="inline-flex items-baseline whitespace-nowrap">
          {(numbers(true) ?? []).map(({ u, n, max }, i, list) => {
            const prev = list[i - 1]?.u;
            // "2d 04:12:09", "4:12:09", "0:42": the leading unit is unpadded, the rest are two digits.
            return (
              <span key={u} className="inline-flex items-baseline">
                {prev === "day" ? <span className="w-[0.3em]" /> : prev ? <span className="px-px text-fg-4">:</span> : null}
                {flow(n, u, max, u !== "day" && !!prev)}
                {u === "day" && <span className="text-fg-3">{unitWord(locale, "day", n, "narrow")}</span>}
              </span>
            );
          })}
          {!parts && <span className="text-fg-4">–:––</span>}
        </span>
      </span>
    ) : (
      <span className="flex items-start gap-1.5">
        {(numbers(false) ?? (["hour", "minute", "second"] as Unit[]).map((u) => ({ u, n: -1, max: undefined }))).map(({ u, n, max }, i) => (
          <motion.span key={u} layout={!reduce} transition={{ duration: 0.3, ease: ease.inOut }} className="flex items-start gap-1.5">
            {i > 0 && (
              <span aria-hidden className="flex h-14 items-center text-[22px] text-fg-4">
                :
              </span>
            )}
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-14 min-w-14 items-center justify-center rounded-lg border bg-raised px-2 text-[28px] font-medium tracking-[-0.02em] shadow-[var(--shadow)]",
                  "transition-[border-color,color] duration-300",
                  warn ? "border-warning/40 text-warning" : "border-line text-fg",
                )}
              >
                {n < 0 ? <span className="text-fg-4">––</span> : flow(n, u, max, true)}
              </span>
              <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{unitWord(locale, u, n < 0 ? 2 : n, "long")}</span>
            </span>
          </motion.span>
        ))}
      </span>
    );

  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.28, ease: ease.out, delay: 0.06 } },
    exit: reduce
      ? { opacity: 0, transition: { duration: 0.12 } }
      : { opacity: 0, scale: 0.98, filter: "blur(2px)", transition: { duration: 0.18, ease: ease.in } },
  };

  return (
    <div
      ref={setRefs}
      role="timer"
      aria-label={label}
      data-state={state}
      data-variant={variant}
      data-warn={warn || undefined}
      className={cn(
        "grid tabular",
        // The block keeps its height when the tiles give way to the ended content.
        variant === "compact" ? "inline-grid align-baseline" : "min-h-[76px] items-center justify-items-center",
        variant === "compact" && (warn ? "text-warning" : ""),
        "transition-colors duration-300",
        className,
      )}
      {...rest}
    >
      <AnimatePresence initial={false}>
        {ended ? (
          <motion.span key="ended" className="col-start-1 row-start-1 flex items-center self-center" {...swap}>
            {endedContent}
          </motion.span>
        ) : (
          <motion.span key="running" aria-hidden className="col-start-1 row-start-1" {...swap}>
            <NumberFlowGroup>{running}</NumberFlowGroup>
          </motion.span>
        )}
      </AnimatePresence>
      {!ended && parts && <span className="sr-only">{spoken(locale, parts)}</span>}
      <span role="status" aria-live="polite" className="sr-only">
        {announce && typeof endedContent === "string" ? endedContent : ""}
      </span>
    </div>
  );
}
