"use client";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

const noop = () => () => {};
/** The reader's locale on the client, a fixed one on the server, so hydration always matches. */
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.NumberFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

export type SparklineDatum = number | null;

export type SparklineGeometry = {
  /** One entry per datum: x from 0 to 1, y in pixels from the top. null for a gap. */
  points: ({ x: number; y: number } | null)[];
  /** The line, in a viewBox that is 100 wide and `height` tall. */
  line: string;
  /** The line closed down to the bottom edge, for the area wash. */
  area: string;
  min: number;
  max: number;
};

/**
 * Plots values into a box 100 units wide and `height` pixels tall. Width is in
 * percent so the SVG can stretch to any container without measuring it; height
 * is real pixels so the stroke and the padding stay true. Nulls break the line.
 */
export function sparklineGeometry(data: SparklineDatum[], height: number, domain?: [number, number], pad = 4): SparklineGeometry {
  const values = data.filter((v): v is number => v != null && Number.isFinite(v));
  let [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  if (!values.length && !domain) [min, max] = [0, 1];
  // A flat series sits in the middle rather than on the floor.
  if (min === max) [min, max] = [min - 1, max + 1];
  const n = data.length;
  const points = data.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return null;
    const x = n === 1 ? 0.5 : i / (n - 1);
    const y = pad + (1 - (v - min) / (max - min)) * (height - pad * 2);
    return { x, y };
  });
  let line = "";
  let area = "";
  let run: { x: number; y: number }[] = [];
  const flush = () => {
    if (!run.length) return;
    // A lone point between gaps still gets a visible stub.
    const pts = run.length === 1 ? [{ x: run[0].x - 0.004, y: run[0].y }, { x: run[0].x + 0.004, y: run[0].y }] : run;
    const seg = pts.map((p, i) => `${i ? "L" : "M"}${(p.x * 100).toFixed(3)} ${p.y.toFixed(2)}`).join("");
    line += seg;
    area += `${seg}L${(pts[pts.length - 1].x * 100).toFixed(3)} ${height}L${(pts[0].x * 100).toFixed(3)} ${height}Z`;
    run = [];
  };
  for (const p of points) {
    if (p) run.push(p);
    else flush();
  }
  flush();
  return { points, line, area, min, max };
}

export type SparklineProps = Omit<React.ComponentProps<"div">, "children" | "onChange"> & {
  /** The series, oldest first. null marks a gap (downtime, a missing day). */
  data: SparklineDatum[];
  /** One label per point, shown and announced while scrubbing: "Mar 4", "14:05". */
  labels?: string[];
  /** Names the series for screen readers: "Revenue, last 30 days". */
  label?: string;
  variant?: "line" | "area";
  /**
   * neutral draws in the foreground; trend turns success when the last value is
   * above the first and danger when below; success and danger force a color.
   */
  tone?: "neutral" | "trend" | "success" | "danger";
  /** For latency, errors or cost: a fall is good news under tone="trend". */
  inverse?: boolean;
  /** Pixels. Width always follows the container. */
  height?: number;
  /** Fix the y range, so several sparklines compare honestly. Defaults to the data's own min and max. */
  domain?: [number, number];
  formatValue?: (value: number) => string;
  locale?: string;
  /** Pointer and arrow-key scrubbing. Off, it is a static image. */
  scrub?: boolean;
  /** Show the value pill while scrubbing. Turn off when onScrub drives a headline instead. */
  tooltip?: boolean;
  /** Called with the scrubbed index, and null when scrubbing ends. */
  onScrub?: (index: number | null) => void;
  /** A soft pulse on the last point, for data that is still arriving. */
  live?: boolean;
  /** Reveal left to right the first time it scrolls into view. */
  animated?: boolean;
};

export function Sparkline({
  data,
  labels,
  label = "Trend",
  variant = "line",
  tone = "neutral",
  inverse = false,
  height = 32,
  domain,
  formatValue,
  locale: localeProp,
  scrub = true,
  tooltip = true,
  onScrub,
  live = false,
  animated = true,
  className,
  style,
  ...rest
}: SparklineProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const gradient = useId();
  const clip = useId();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.6 });
  const [index, setIndex] = useState<number | null>(null);
  const [touching, setTouching] = useState(false);
  // The last dot waits for the reveal once; after that it comes back at once.
  const [revealed, setRevealed] = useState(false);
  const summaryId = useId();

  const geo = useMemo(() => sparklineGeometry(data, height, domain), [data, height, domain]);
  const fmt = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    return formatValue ?? ((v: number) => nf.format(v));
  }, [formatValue, locale]);

  const lastIndex = findLast(geo.points);
  const firstIndex = geo.points.findIndex(Boolean);
  const first = firstIndex >= 0 ? (data[firstIndex] as number) : null;
  const last = lastIndex >= 0 ? (data[lastIndex] as number) : null;
  const up = first != null && last != null ? last > first : null;
  const resolvedTone = tone === "trend" ? (up == null || last === first ? "neutral" : up !== inverse ? "success" : "danger") : tone;
  const empty = lastIndex < 0;

  // One scrub position, sprung after the pointer and jumped for the keyboard.
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const left = useTransform(rx, (v) => `${v * 100}%`);
  // Shifting the pill by the same percentage of its own width keeps it inside the box at both ends.
  const shift = useTransform(rx, (v) => `${-v * 100}%`);
  const clipWidth = useTransform(rx, (v) => v * 100);

  const moveTo = (i: number | null, instant: boolean) => {
    if (i === index) return;
    setIndex(i);
    onScrub?.(i);
    const p = i == null ? null : geo.points[i];
    if (!p) return;
    const jump = instant || reduce || index == null;
    if (jump) {
      rx.jump(p.x);
      ry.jump(p.y);
    } else {
      animate(rx, p.x, spring.follow);
      animate(ry, p.y, spring.follow);
    }
  };

  // Snap to the nearest point that has a value, so a gap never strands the scrubber.
  const nearest = (ratio: number) => {
    const n = data.length;
    const target = Math.round(Math.min(1, Math.max(0, ratio)) * (n - 1));
    for (let d = 0; d < n; d++) {
      if (geo.points[target - d]) return target - d;
      if (geo.points[target + d]) return target + d;
    }
    return null;
  };

  const fromPointer = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return nearest((e.clientX - r.left) / r.width);
  };

  const interactive = scrub && !empty && data.length > 1;
  const current = index ?? lastIndex;
  const valueText =
    current >= 0 && data[current] != null ? `${labels?.[current] ? `${labels[current]}: ` : ""}${fmt(data[current] as number)}` : "No data";
  const summary = empty
    ? `${label}: no data`
    : `${label}: ${fmt(first as number)} to ${fmt(last as number)}, low ${fmt(Math.min(...(data.filter((v) => v != null) as number[])))}, high ${fmt(
        Math.max(...(data.filter((v) => v != null) as number[])),
      )}`;

  // Render output never depends on reduced motion (the server can't know it); only the transitions do.
  const shown = !animated || inView;
  useEffect(() => {
    if (!shown || revealed) return;
    const t = window.setTimeout(() => setRevealed(true), 900);
    return () => window.clearTimeout(t);
  }, [shown, revealed]);
  const lastPoint = lastIndex >= 0 ? geo.points[lastIndex] : null;
  const scrubbing = index != null;

  return (
    <div
      ref={box}
      data-slot="sparkline"
      data-tone={resolvedTone}
      data-state={scrubbing ? "scrubbing" : "idle"}
      data-empty={empty || undefined}
      role={interactive ? "slider" : "img"}
      aria-label={interactive ? label : summary}
      aria-describedby={interactive ? summaryId : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? data.length - 1 : undefined}
      aria-valuenow={interactive ? current : undefined}
      aria-valuetext={interactive ? valueText : undefined}
      aria-orientation={interactive ? "horizontal" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onPointerMove={interactive ? (e) => moveTo(fromPointer(e), false) : undefined}
      onPointerDown={interactive ? (e) => {
        if (e.pointerType !== "mouse") setTouching(true);
        moveTo(fromPointer(e), true);
      } : undefined}
      onPointerLeave={interactive ? () => {
        setTouching(false);
        moveTo(null, true);
      } : undefined}
      onPointerCancel={interactive ? () => {
        setTouching(false);
        moveTo(null, true);
      } : undefined}
      // Keyboard focus lands on the latest point, so the value is there before the first arrow press.
      onFocus={interactive ? (e) => {
        if (e.currentTarget.matches(":focus-visible")) moveTo(lastIndex, true);
      } : undefined}
      onBlur={interactive ? () => moveTo(null, true) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              const from = index ?? lastIndex;
              const step = (dir: 1 | -1, start: number) => {
                for (let i = start + dir; i >= 0 && i < data.length; i += dir) if (geo.points[i]) return i;
                return start;
              };
              let next: number | null | undefined;
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = index == null ? lastIndex : step(-1, from);
              else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = index == null ? lastIndex : step(1, from);
              else if (e.key === "Home") next = firstIndex;
              else if (e.key === "End") next = lastIndex;
              else if (e.key === "Escape" && index != null) next = null;
              if (next === undefined) return;
              e.preventDefault();
              moveTo(next, true);
            }
          : undefined
      }
      style={{ height, ...style }}
      className={cn(
        "group/spark relative w-full min-w-0 select-none",
        resolvedTone === "neutral" && "text-fg-2",
        resolvedTone === "success" && "text-success",
        resolvedTone === "danger" && "text-danger",
        interactive && "cursor-crosshair touch-pan-y rounded-[3px] outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={false}
        animate={shown ? { clipPath: "inset(-4px -4px -4px -4px)", opacity: 1 } : { clipPath: "inset(-4px 100% -4px -4px)", opacity: 0 }}
        transition={reduce ? { clipPath: { duration: 0 }, opacity: { duration: 0.2 } } : { clipPath: { duration: 0.9, ease: ease.outQuart }, opacity: { duration: 0.2 } }}
      >
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" fill="none">
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity={0.16} />
              <stop offset="1" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
            <clipPath id={clip}>
              <motion.rect x={-1} y={-4} height={height + 8} width={clipWidth} />
            </clipPath>
          </defs>
          {empty ? (
            <line x1={0} x2={100} y1={height / 2} y2={height / 2} className="stroke-fg-4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ) : (
            <>
              {variant === "area" && (
                <path d={geo.area} fill={`url(#${gradient})`} className="transition-opacity duration-150" style={{ opacity: scrubbing ? 0.5 : 1 }} />
              )}
              {/* While scrubbing, the stretch after the pointer steps back and the part already traveled keeps full ink. */}
              <path
                d={geo.line}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="transition-opacity duration-150"
                style={{ opacity: scrubbing ? 0.3 : 1 }}
              />
              {scrubbing && (
                <path
                  d={geo.line}
                  clipPath={`url(#${clip})`}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </>
          )}
        </svg>
      </motion.div>

      {lastPoint && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${lastPoint.x * 100}%`, top: lastPoint.y }}
          initial={false}
          animate={shown && !scrubbing ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
          transition={
            reduce
              ? { opacity: { duration: 0.15, delay: revealed ? 0 : 0.2 }, scale: { duration: 0 } }
              : shown && !scrubbing
                ? { ...spring.pop, delay: revealed ? 0 : 0.7 }
                : { duration: 0.12 }
          }
        >
          {live && <span className="absolute inset-0 rounded-full bg-current motion-safe:animate-ping-soft" />}
          <span className="absolute inset-0 rounded-full bg-current ring-[1.5px] ring-[color:var(--sparkline-surface,var(--raised))]" />
        </motion.span>
      )}

      {/* The scrubber: a hairline, a dot riding the line, and the value above. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-fg/15"
        style={{ left }}
        initial={false}
        animate={{ opacity: scrubbing ? 1 : 0 }}
        transition={{ duration: scrubbing ? 0.12 : 0.1 }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-0 -mt-[3.5px] size-[7px] rounded-full bg-current ring-[1.5px] ring-[color:var(--sparkline-surface,var(--raised))]"
        style={{ left, y: ry, x: "-50%" }}
        initial={false}
        animate={{ opacity: scrubbing ? 1 : 0, scale: scrubbing ? 1 : 0.4 }}
        transition={{ duration: 0.14, ease: ease.out, scale: { duration: reduce ? 0 : 0.14, ease: ease.out } }}
      />
      {interactive && (
        <span id={summaryId} className="sr-only">
          {summary}
        </span>
      )}
      {tooltip && interactive && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-full z-(--z-tooltip) pb-1.5"
          style={{ left, x: shift }}
          initial={false}
          animate={scrubbing ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 3, scale: 0.96 }}
          transition={{ duration: scrubbing ? 0.16 : 0.1, ease: ease.out, ...(reduce ? { y: { duration: 0 }, scale: { duration: 0 } } : null) }}
        >
          <div
            className={cn(
              "flex items-baseline gap-1.5 whitespace-nowrap rounded-md border border-line-2 bg-raised px-1.5 py-[3px] text-[11px] leading-none shadow-pop",
              touching && "-translate-y-5",
            )}
          >
            <span className="font-medium text-fg tabular">{index != null && data[index] != null ? fmt(data[index] as number) : ""}</span>
            {index != null && labels?.[index] && <span className="text-fg-3">{labels[index]}</span>}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function findLast<T>(list: (T | null)[]) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i]) return i;
  return -1;
}
