"use client";
import { animate, AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";
import { ease, spring } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.NumberFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

function useWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

/** Round ticks covering [min, max]. Lines don't need a zero baseline unless asked for. */
function niceTicks(min: number, max: number, count: number, zero: boolean) {
  let lo0 = zero ? Math.min(0, min) : min;
  let hi0 = zero ? Math.max(0, max) : max;
  if (hi0 === lo0) [lo0, hi0] = [lo0 - 1, hi0 + 1];
  const raw = (hi0 - lo0) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(lo0 / step) * step;
  const hi = Math.ceil(hi0 / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out;
}

type Pt = { x: number; y: number };

// Monotone cubic (Fritsch–Carlson): smooth, but never overshoots a peak or invents a dip.
function monotone(pts: Pt[]) {
  const n = pts.length;
  if (n < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("");
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i].x + h).toFixed(2)} ${(pts[i].y + h * t[i]).toFixed(2)} ${(pts[i + 1].x - h).toFixed(2)} ${(pts[i + 1].y - h * t[i + 1]).toFixed(2)} ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

function linePath(pts: (Pt | null)[], curve: "linear" | "monotone") {
  const runs: Pt[][] = [[]];
  for (const p of pts) {
    if (p) runs[runs.length - 1].push(p);
    else if (runs[runs.length - 1].length) runs.push([]);
  }
  return runs
    .filter((r) => r.length)
    .map((r) => (curve === "monotone" ? monotone(r) : r.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("")))
    .join("");
}

const inks = [0.95, 0.5, 0.3, 0.18];

export type LineSeries = {
  key: string;
  label: string;
  /** Text-color class for this series, e.g. "text-info". Defaults to the foreground at a stepped opacity. */
  className?: string;
  /** Dashed reads as "for comparison": last period, a forecast, a budget. */
  variant?: "solid" | "dashed";
};

export type LineChartProps<T extends Record<string, unknown>> = Omit<React.ComponentProps<"div">, "children"> & {
  data: T[];
  /** The field on the x axis: a date label, a week, a timestamp string. */
  xKey: keyof T & string;
  series: LineSeries[];
  /** Names the chart for screen readers. */
  label: string;
  /** Plot height in pixels. */
  height?: number;
  curve?: "linear" | "monotone";
  /** A soft wash under the first visible series. */
  area?: boolean;
  /** Keep zero on the y axis, for quantities where the distance from zero matters. */
  zero?: boolean;
  formatValue?: (value: number) => string;
  formatX?: (x: string) => string;
  locale?: string;
  /** Series keys hidden by the legend (controlled). */
  hidden?: string[];
  defaultHidden?: string[];
  onHiddenChange?: (hidden: string[]) => void;
  loading?: boolean;
  emptyLabel?: string;
  /** Draw the lines in the first time the chart scrolls into view. */
  animated?: boolean;
};

export function LineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  label,
  height = 220,
  curve = "linear",
  area = false,
  zero = false,
  formatValue,
  formatX = (x) => x,
  locale: localeProp,
  hidden: hiddenProp,
  defaultHidden = [],
  onHiddenChange,
  loading = false,
  emptyLabel = "No data for this period",
  animated = true,
  className,
  ...rest
}: LineChartProps<T>) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const [measure, width] = useWidth();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, amount: 0.35 });
  const [hidden, setHidden] = useControllableState({ value: hiddenProp, defaultValue: defaultHidden, onChange: onHiddenChange });
  const [index, setIndex] = useState<number | null>(null);
  const [emphasis, setEmphasis] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const gradient = useId();
  const descId = useId();

  const fmt = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
    return formatValue ?? ((v: number) => nf.format(v));
  }, [formatValue, locale]);

  const visible = series.filter((s) => !hidden.includes(s.key));
  const num = (d: T, key: string) => {
    const v = d[key];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // The y range follows the visible series, so hiding a tall line lets the rest fill the plot.
  const vals = data.flatMap((d) => visible.map((s) => num(d, s.key))).filter((v): v is number => v != null);
  const ticks = niceTicks(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 1, 4, zero);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];

  const tickWidth = Math.max(...ticks.map((t) => fmt(t).length)) * 6.4 + 10;
  const m = { top: 10, right: 12, bottom: 26, left: tickWidth };
  const plotW = Math.max(0, width - m.left - m.right);
  const n = data.length;
  const xAt = (i: number) => m.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => m.top + height - ((v - t0) / (t1 - t0 || 1)) * height;
  const totalH = height + m.top + m.bottom;

  const paths = series.map((s) => {
    const pts = data.map((d, i) => {
      const v = num(d, s.key);
      return v == null ? null : { x: xAt(i), y: yAt(v) };
    });
    return { key: s.key, pts, d: linePath(pts, curve) };
  });
  const firstVisible = paths.find((p) => !hidden.includes(p.key));
  const areaD =
    area && firstVisible
      ? (() => {
          const run = firstVisible.pts.filter((p): p is Pt => !!p);
          if (run.length < 2) return "";
          const floor = m.top + height;
          return `${linePath(firstVisible.pts, curve)}L${run[run.length - 1].x.toFixed(2)} ${floor}L${run[0].x.toFixed(2)} ${floor}Z`;
        })()
      : "";

  // X labels: as many as fit without touching, always including the last.
  const xLabel = (i: number) => formatX(String(data[i][xKey]));
  const longest = Math.max(4, ...data.map((_, i) => xLabel(i).length));
  const fit = Math.max(2, Math.floor(plotW / (longest * 6.4 + 24)));
  const stepX = Math.max(1, Math.ceil((n - 1) / (fit - 1)));
  const xTicks = n ? Array.from(new Set([...Array.from({ length: Math.floor((n - 1) / stepX) + 1 }, (_, k) => k * stepX)])) : [];
  if (xTicks.length && xTicks[xTicks.length - 1] !== n - 1) {
    // Swap the last regular tick for the final point when they'd collide.
    if ((n - 1 - xTicks[xTicks.length - 1]) * (plotW / Math.max(1, n - 1)) < longest * 6.4 + 12) xTicks.pop();
    xTicks.push(n - 1);
  }

  const empty = !loading && n === 0;
  const skeleton = loading && n === 0;
  const allHidden = n > 0 && visible.length === 0;
  const drawn = !animated || inView;
  const [settled, setSettled] = useState(!animated);
  useEffect(() => {
    if (!drawn || settled) return;
    const t = window.setTimeout(() => setSettled(true), 1100);
    return () => window.clearTimeout(t);
  }, [drawn, settled]);

  // The crosshair: one x, sprung after the pointer, jumped for the keyboard.
  const cx = useMotionValue(0);
  const side = useMotionValue(0);
  const tipX = useTransform([cx, side], ([x, s]: number[]) => `calc(${x}px + ${s < 0.5 ? 12 : -12}px - ${s * 100}%)`);
  const scrubbing = index != null && !empty && !skeleton && !allHidden;
  const wasOn = useRef(false);
  const targetX = index == null ? null : xAt(index);
  const flip = targetX != null && targetX > m.left + plotW / 2 ? 1 : 0;
  useEffect(() => {
    if (targetX == null) {
      wasOn.current = false;
      return;
    }
    // The tooltip sits right of the crosshair in the left half and left of it in the right half.
    side.jump(flip);
    if (!wasOn.current || reduce || keyboard) cx.jump(targetX);
    else animate(cx, targetX, spring.follow);
    wasOn.current = true;
  }, [targetX, flip, reduce, keyboard, cx, side]);

  const nearest = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - r.left - m.left) / (plotW || 1);
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
  };

  const toggle = (key: string) => {
    const hiding = !hidden.includes(key);
    setHidden(hiding ? [...hidden, key] : hidden.filter((k) => k !== key));
    // Showing a series again emphasizes it, so the eye finds where it came back; hiding lets go.
    setEmphasis(hiding ? null : key);
  };
  const inkOf = (si: number) => (series[si].className ? 1 : inks[Math.min(si, inks.length - 1)]);
  const readout = (i: number) =>
    `${xLabel(i)}: ${visible
      .map((s) => {
        const v = num(data[i], s.key);
        return `${s.label} ${v == null ? "no data" : fmt(v)}`;
      })
      .join(", ")}`;
  const current = index ?? (n ? n - 1 : 0);

  return (
    <div
      ref={root}
      data-slot="line-chart"
      data-state={skeleton ? "loading" : empty ? "empty" : loading ? "refreshing" : "ready"}
      aria-busy={loading || undefined}
      className={cn("flex w-full min-w-0 flex-col gap-3 text-fg", className)}
      {...rest}
    >
      {series.length > 1 && (
        <div role="group" aria-label="Series" className="-ml-1.5 flex flex-wrap items-center gap-0.5">
          {series.map((s, si) => {
            const on = !hidden.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                onPointerEnter={(e) => e.pointerType === "mouse" && on && setEmphasis(s.key)}
                onPointerLeave={() => setEmphasis(null)}
                onFocus={() => on && setEmphasis(s.key)}
                onBlur={() => setEmphasis(null)}
                className={cn(
                  "group/key relative flex h-7 select-none items-center gap-1.5 rounded-md px-1.5 text-[12px] outline-none",
                  "transition-[background-color,color,scale] duration-150 hover:bg-hover active:scale-[0.97]",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "before:absolute before:-inset-x-0.5 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
                  on ? "text-fg-2 hover:text-fg" : "text-fg-4 hover:text-fg-3",
                )}
              >
                <svg width="14" height="8" aria-hidden className={cn("shrink-0 transition-opacity duration-200", s.className ?? "text-fg")} style={{ opacity: on ? inkOf(si) : 0.25 }}>
                  <line x1="1" x2="13" y1="4" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={s.variant === "dashed" ? "3 3" : undefined} />
                </svg>
                <span className={cn("transition-[text-decoration-color] duration-200", !on && "line-through decoration-fg-4")}>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={measure}
        role={n > 0 && !allHidden ? "slider" : "img"}
        aria-label={label}
        aria-describedby={descId}
        aria-valuemin={n > 0 && !allHidden ? 0 : undefined}
        aria-valuemax={n > 0 && !allHidden ? n - 1 : undefined}
        aria-valuenow={n > 0 && !allHidden ? current : undefined}
        aria-valuetext={n > 0 && !allHidden ? readout(current) : undefined}
        tabIndex={n > 0 && !allHidden ? 0 : undefined}
        className="relative w-full cursor-crosshair touch-pan-y select-none rounded-md outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3"
        style={{ height: totalH }}
        onPointerMove={(e) => {
          if (!n || allHidden || (e.pointerType !== "mouse" && e.buttons === 0)) return;
          setKeyboard(false);
          setIndex(nearest(e));
        }}
        onPointerDown={(e) => {
          if (!n || allHidden) return;
          setKeyboard(false);
          setIndex(nearest(e));
        }}
        onPointerUp={(e) => e.pointerType !== "mouse" && setIndex(null)}
        onPointerLeave={() => setIndex(null)}
        onPointerCancel={() => setIndex(null)}
        onFocus={(e) => {
          if (n && !allHidden && e.currentTarget.matches(":focus-visible")) {
            setKeyboard(true);
            setIndex(n - 1);
          }
        }}
        onBlur={() => setIndex(null)}
        onKeyDown={(e) => {
          if (!n || allHidden) return;
          const from = index ?? n - 1;
          const to =
            e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? Math.max(0, from - 1)
              : e.key === "ArrowRight" || e.key === "ArrowUp"
                ? Math.min(n - 1, from + 1)
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? n - 1
                    : e.key === "PageDown"
                      ? Math.max(0, from - 7)
                      : e.key === "PageUp"
                        ? Math.min(n - 1, from + 7)
                        : undefined;
          if (e.key === "Escape" && index != null) {
            e.preventDefault();
            setIndex(null);
            return;
          }
          if (to == null) return;
          e.preventDefault();
          setKeyboard(true);
          setIndex(to);
        }}
      >
        <span id={descId} className="sr-only">
          {n ? `${n} points from ${xLabel(0)} to ${xLabel(n - 1)}. Use the arrow keys to read each point.` : emptyLabel}
        </span>
        {width > 0 && (
          <>
            <svg width={width} height={totalH} aria-hidden className={cn("block overflow-visible transition-opacity duration-200", loading && n > 0 && "opacity-50")}>
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity={0.12} />
                  <stop offset="1" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <AnimatePresence initial={false}>
                {ticks.map((t) => {
                  const y = Math.round(yAt(t)) + 0.5;
                  return (
                    <motion.line
                      key={t}
                      x1={m.left}
                      x2={width - m.right}
                      className={t === 0 ? "stroke-line-2" : "stroke-line"}
                      strokeWidth={1}
                      initial={{ opacity: 0, y1: y, y2: y }}
                      animate={{ opacity: 1, y1: y, y2: y }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: reduce ? 0 : 0.45, ease: ease.inOut }}
                    />
                  );
                })}
              </AnimatePresence>

              {skeleton && (
                <path
                  d={monotone(Array.from({ length: 8 }, (_, i) => ({ x: m.left + (i / 7) * plotW, y: m.top + height * (0.35 + 0.3 * Math.sin(i * 1.1)) })))}
                  fill="none"
                  strokeWidth={2}
                  className="stroke-fg/[0.08] motion-safe:animate-pulse-soft"
                />
              )}

              {areaD && firstVisible && (
                <motion.path
                  className={series.find((s) => s.key === firstVisible.key)?.className ?? "text-fg"}
                  fill={`url(#${gradient})`}
                  initial={false}
                  animate={{ d: areaD, opacity: drawn ? (emphasis && emphasis !== firstVisible.key && !hidden.includes(emphasis) ? 0.3 : 1) : 0 }}
                  transition={{ d: { duration: reduce ? 0 : 0.45, ease: ease.inOut }, opacity: { duration: 0.4, delay: !settled && !reduce ? 0.5 : 0 } }}
                />
              )}

              {paths.map((p, si) => {
                const s = series[si];
                const on = !hidden.includes(p.key);
                const dim = emphasis != null && emphasis !== p.key && !hidden.includes(emphasis);
                const dashed = s.variant === "dashed";
                return (
                  <motion.path
                    key={p.key}
                    className={s.className ?? "text-fg"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={dashed ? "4 4" : undefined}
                    initial={false}
                    // Solid lines draw along their length; a dashed comparison line fades in once they have.
                    animate={{
                      d: p.d,
                      ...(dashed ? null : { pathLength: drawn ? 1 : 0 }),
                      opacity: !on || (dashed && !drawn) ? 0 : dim ? inkOf(si) * 0.25 : inkOf(si),
                    }}
                    transition={{
                      d: { duration: reduce ? 0 : 0.45, ease: ease.inOut },
                      pathLength: { duration: reduce ? 0 : 1, ease: ease.outQuart, delay: reduce ? 0 : si * 0.08 },
                      opacity: { duration: reduce ? 0.15 : dashed && !settled ? 0.4 : 0.2, delay: dashed && !settled && !reduce ? 0.6 : 0 },
                    }}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}

              {/* Crosshair and a ringed dot where it crosses each visible line. */}
              <motion.g initial={false} animate={{ opacity: scrubbing ? 1 : 0 }} transition={{ duration: scrubbing ? 0.1 : 0.12 }}>
                <motion.line y1={m.top} y2={m.top + height} x1={cx} x2={cx} className="stroke-fg/25" strokeWidth={1} />
                {scrubbing &&
                  index != null &&
                  paths.map((p, si) => {
                    const pt = p.pts[index];
                    if (!pt || hidden.includes(p.key)) return null;
                    return (
                      <motion.circle
                        key={p.key}
                        r={4}
                        cx={cx}
                        initial={false}
                        animate={{ cy: pt.y }}
                        transition={reduce || keyboard ? { duration: 0 } : spring.follow}
                        className={cn(series[si].className ?? "text-fg", "stroke-raised")}
                        fill="currentColor"
                        fillOpacity={Math.max(inkOf(si), 0.5)}
                        strokeWidth={2}
                      />
                    );
                  })}
              </motion.g>
            </svg>

            <div aria-hidden className="pointer-events-none absolute inset-0 text-2xs text-fg-3 tabular">
              <AnimatePresence initial={false}>
                {n > 0 &&
                  !allHidden &&
                  ticks.map((t) => (
                    <motion.span
                      key={t}
                      className="absolute left-0 -translate-y-1/2 whitespace-nowrap pr-2 text-right"
                      style={{ width: m.left }}
                      initial={{ opacity: 0, top: yAt(t) }}
                      animate={{ opacity: 1, top: yAt(t) }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: reduce ? 0 : 0.45, ease: ease.inOut }}
                    >
                      {fmt(t)}
                    </motion.span>
                  ))}
              </AnimatePresence>
              {xTicks.map((i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute whitespace-nowrap text-[11px] transition-colors duration-150",
                    i === 0 && n > 1 ? "" : i === n - 1 && n > 1 ? "-translate-x-full" : "-translate-x-1/2",
                    index === i ? "text-fg" : "text-fg-3",
                  )}
                  style={{ left: xAt(i), top: m.top + height + 8 }}
                >
                  {xLabel(i)}
                </span>
              ))}
            </div>

            {(empty || allHidden) && (
              <div className="absolute grid place-items-center" style={{ left: m.left, top: m.top, width: plotW, height }}>
                {empty ? (
                  <span role="status" className="text-[12.5px] text-fg-3">
                    {emptyLabel}
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[12.5px] text-fg-3">All series are hidden</span>
                    <button
                      type="button"
                      onClick={() => setHidden([])}
                      className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
                    >
                      Show all
                    </button>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {scrubbing && index != null && (
                <motion.div
                  key="tip"
                  className="pointer-events-none absolute left-0 z-(--z-tooltip)"
                  style={{ top: m.top, x: tipX }}
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.14, ease: ease.out }}
                >
                  <div className="min-w-[136px] rounded-lg border border-line-2 bg-raised px-2.5 py-2 shadow-pop">
                    <div className="mb-1.5 whitespace-nowrap text-[11.5px] text-fg-2">{xLabel(index)}</div>
                    <div className="flex flex-col gap-1">
                      {series.map((s, si) => {
                        if (hidden.includes(s.key)) return null;
                        const v = num(data[index], s.key);
                        return (
                          <div key={s.key} className="flex items-center gap-2 whitespace-nowrap text-[12px]">
                            <svg width="10" height="4" aria-hidden className={cn("shrink-0", s.className ?? "text-fg")} style={{ opacity: Math.max(inkOf(si), 0.45) }}>
                              <line x1="1" x2="9" y1="2" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={s.variant === "dashed" ? "2 2" : undefined} />
                            </svg>
                            <span className="min-w-0 flex-1 text-fg-2">{s.label}</span>
                            <span className="pl-3 font-medium text-fg tabular">{v == null ? "–" : fmt(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
