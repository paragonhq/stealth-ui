"use client";
import NumberFlow, { continuous, type Format } from "@number-flow/react";
import { Children, createContext, use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Phase = "idle" | "armed" | "done";
type Align = "start" | "center";

type Ctx = { phase: Phase; reduce: boolean; locales: Intl.LocalesArgument; duration: number; stagger: number; align: Align };
const StatsBandContext = createContext<Ctx | null>(null);
const StatIndexContext = createContext(0);
const useStatsBand = () => {
  const ctx = use(StatsBandContext);
  if (!ctx) throw new Error("Stat must be used inside <StatsBand>");
  return ctx;
};

const noop = () => () => {};
// Every digit spins through the values in between, so it reads as counting, not swapping.
const plugins = [continuous];
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export type StatsBandProps = React.ComponentProps<"div"> & {
  /** Left-aligned columns, or each stat centered in its column. */
  align?: Align;
  /** Locale for every number. Fixed by default so the server and the browser print the same digits. */
  locales?: Intl.LocalesArgument;
  /** Milliseconds each number takes to count up. */
  duration?: number;
  /** Milliseconds between one stat starting and the next. */
  stagger?: number;
};

/**
 * A row of headline numbers that count up from zero the first time the band
 * scrolls into view, one after another. Numbers that were already on screen at
 * first paint are left alone: they have been read, and rewinding them to zero
 * would take them away. The real values are always in the HTML.
 */
export function StatsBand({ align = "start", locales = "en-US", duration = 1400, stagger = 90, className, children, ...rest }: StatsBandProps) {
  const reduce = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);
  // True only when mounted in the browser without server HTML (a client-side
  // navigation or a remount). Then nothing has been painted yet, so it can start at zero.
  const clientMount = useSyncExternalStore(noop, () => true, () => false);
  const [phase, setPhase] = useState<Phase>(() => (clientMount && !reduce ? "armed" : "idle"));
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!el || reduce || phase === "done") return;
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        const inView = e.isIntersecting && e.intersectionRatio >= 0.4;
        if (phase === "idle") {
          // Hydrated from server HTML: on screen already means read already.
          if (first && e.isIntersecting) setPhase("done");
          else if (!e.isIntersecting) setPhase("armed");
        } else if (inView) setPhase("done");
        first = false;
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, phase, reduce]);

  const ctx = useMemo(() => ({ phase, reduce, locales, duration, stagger, align }), [phase, reduce, locales, duration, stagger, align]);

  return (
    <StatsBandContext value={ctx}>
      {/* The wrapper is the container the layout queries; an element can't query its own width. */}
      <div
        ref={setEl}
        data-slot="stats-band"
        data-state={phase === "armed" && !reduce ? "waiting" : "shown"}
        className={cn("@container/stats min-w-0", className)}
        {...rest}
      >
        <dl className="grid grid-cols-2 gap-x-8 gap-y-10 @[640px]/stats:auto-cols-fr @[640px]/stats:grid-flow-col @[640px]/stats:grid-cols-none @[640px]/stats:gap-x-12">
          {Children.toArray(children).map((child, i) => (
            <StatIndexContext key={i} value={i}>
              {child}
            </StatIndexContext>
          ))}
        </dl>
      </div>
    </StatsBandContext>
  );
}

export type StatProps = Omit<React.ComponentProps<"div">, "children"> & {
  value: number;
  /** What the number counts. Keep it to one line where you can. */
  label: React.ReactNode;
  /** Intl.NumberFormat options: { notation: "compact" } for 2.4B, { style: "percent" }, { style: "currency", currency: "USD" }. */
  format?: Format;
  prefix?: string;
  suffix?: string;
  /** A short source or qualifier under the label: "p50, last 30 days". */
  detail?: React.ReactNode;
};

export function Stat({ value, label, format, prefix, suffix, detail, className, ...rest }: StatProps) {
  const { phase, reduce, locales, duration, stagger, align } = useStatsBand();
  const index = use(StatIndexContext);
  const armed = phase === "armed" && !reduce;
  const final = useMemo(() => `${prefix ?? ""}${new Intl.NumberFormat(locales, format).format(value)}${suffix ?? ""}`, [locales, format, value, prefix, suffix]);

  // The counting ease is the library's entrance curve: fast off zero, a long settle into the value.
  const timing = useMemo(() => {
    const t: EffectTiming = { duration, delay: index * stagger, easing: `cubic-bezier(${ease.out.join(",")})`, fill: "backwards" };
    return { spin: t, transform: t, opacity: { ...t, duration: duration * 0.4 } };
  }, [duration, stagger, index]);

  return (
    <div
      data-slot="stat"
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5",
        align === "center" && "items-center text-center",
        // Dividers are drawn in the gaps and never cross: vertical between columns, horizontal between rows.
        "after:pointer-events-none after:absolute after:inset-y-0 after:w-px after:bg-line after:content-['']",
        "before:pointer-events-none before:absolute before:inset-x-0 before:-top-5 before:h-px before:bg-line before:content-['']",
        // Two columns on narrow containers.
        "@max-[639px]/stats:even:after:-left-4 @max-[639px]/stats:odd:after:hidden",
        "@max-[639px]/stats:[&:nth-child(-n+2)]:before:hidden",
        // One row from 640px.
        "@[640px]/stats:before:hidden @[640px]/stats:after:-left-6 @[640px]/stats:first:after:hidden",
        className,
      )}
      {...rest}
    >
      <dt className="text-[13px] leading-[1.45] text-pretty text-fg-2">{label}</dt>
      <dd className="order-first">
        <span className="sr-only">{final}</span>
        <NumberFlow
          aria-hidden
          value={armed ? 0 : value}
          locales={locales}
          format={format}
          prefix={prefix}
          suffix={suffix}
          trend={1}
          plugins={plugins}
          animated={!armed}
          spinTiming={timing.spin}
          transformTiming={timing.transform}
          opacityTiming={timing.opacity}
          className="text-[32px] font-medium leading-none tracking-[-0.035em] text-fg tabular @[640px]/stats:text-[40px]"
        />
      </dd>
      {detail && <dd className="font-mono text-[11px] leading-[1.4] text-fg-3">{detail}</dd>}
    </div>
  );
}
