"use client";
import NumberFlow, { type Format } from "@number-flow/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.NumberFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

export type DonutDatum = {
  label: string;
  value: number;
  /** Text-color class for this segment, e.g. "text-danger". Defaults to the foreground at a stepped opacity. */
  className?: string;
};

// Largest first gets the most ink; the tail steps down.
const inks = [0.92, 0.64, 0.44, 0.3, 0.2, 0.13];

function arc(c: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

// Every slice gets at least a visible sweep; the rest is shared out by value.
function layout(slices: DonutDatum[], sum: number, gap: number, minSweep: number, c: number, r0: number, r1: number) {
  const floor = slices.map((d) => Math.max((d.value / (sum || 1)) * Math.PI * 2, minSweep));
  const scale = (Math.PI * 2) / floor.reduce((s, v) => s + v, 0);
  let a = 0;
  return slices.map((d, i) => {
    const sweep = floor[i] * scale;
    const a0 = a + gap / 2;
    const a1 = a + sweep - gap / 2;
    a += sweep;
    return { ...d, i, a0, a1, d: arc(c, r0, r1, a0, Math.max(a0 + 0.001, a1)) };
  });
}

export type DonutChartProps = Omit<React.ComponentProps<"div">, "children"> & {
  data: DonutDatum[];
  /** Names the chart for screen readers: "Storage by file type". */
  label: string;
  /** Diameter in pixels. */
  size?: number;
  /** Ring thickness in pixels. */
  thickness?: number;
  /** Intl options for every number, e.g. { style: "currency", currency: "USD" }. */
  format?: Format;
  /** Text after every number: " GB", " seats". */
  suffix?: string;
  locale?: string;
  /** What the center says when nothing is highlighted. */
  totalLabel?: string;
  /** Override the center figure, e.g. used of a quota. Defaults to the sum. */
  total?: number;
  /** Segments past this many fold into one "Other" slice. */
  maxSegments?: number;
  legend?: "right" | "bottom" | "none";
  loading?: boolean;
  emptyLabel?: string;
  /** Sweep the ring in the first time it scrolls into view. */
  animated?: boolean;
};

export function DonutChart({
  data,
  label,
  size = 176,
  thickness = 22,
  format,
  suffix,
  locale: localeProp,
  totalLabel = "Total",
  total: totalProp,
  maxSegments = 6,
  legend = "right",
  loading = false,
  emptyLabel = "No data",
  animated = true,
  className,
  ...rest
}: DonutChartProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.5 });
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [rover, setRover] = useState(0);
  const maskId = useId();

  // Sorted largest first, with a long tail folded into "Other" so no slice is a sliver nobody can hover.
  const slices = useMemo(() => {
    const clean = data.filter((d) => Number.isFinite(d.value) && d.value > 0).sort((a, b) => b.value - a.value);
    if (clean.length <= maxSegments) return clean;
    const head = clean.slice(0, maxSegments - 1);
    const other = clean.slice(maxSegments - 1).reduce((s, d) => s + d.value, 0);
    return [...head, { label: "Other", value: other }];
  }, [data, maxSegments]);

  const sum = slices.reduce((s, d) => s + d.value, 0);
  const empty = !loading && sum === 0;
  const nf = useMemo(() => new Intl.NumberFormat(locale, format), [locale, format]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }), [locale]);
  const fmt = (v: number) => `${nf.format(v)}${suffix ?? ""}`;

  const c = size / 2;
  const r1 = c - 6; // room for the hover lift
  const r0 = r1 - thickness;
  const rMid = (r0 + r1) / 2;
  // A 2px surface gap between segments, measured at the middle of the ring.
  const gap = slices.length > 1 ? 2 / rMid : 0;
  const minSweep = gap + 0.035;
  const segments = useMemo(() => layout(slices, sum, gap, minSweep, c, r0, r1), [slices, sum, gap, minSweep, c, r0, r1]);

  const active = hover ?? focus;
  const on = active != null ? segments[active] : null;
  const shown = !animated || inView;
  const inkOf = (i: number) => (slices[i]?.className ? 1 : inks[Math.min(i, inks.length - 1)]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = segments.length;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (e.key === "Escape") return setFocus(null);
    if (to == null) return;
    e.preventDefault();
    e.currentTarget.parentElement?.querySelector<SVGElement>(`[data-index="${to}"]`)?.focus();
  };

  // Touch has no hover: a tap pins a segment, a second tap or a tap elsewhere lets it go.
  const tap = (i: number) => setHover((h) => (h === i ? null : i));
  useEffect(() => {
    if (hover == null) return;
    const off = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !box.current?.contains(e.target as Node)) setHover(null);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [hover]);

  const center = on ?? { label: totalLabel, value: totalProp ?? sum };

  return (
    <div
      ref={box}
      data-slot="donut-chart"
      data-state={loading ? "loading" : empty ? "empty" : "ready"}
      aria-busy={loading || undefined}
      className={cn(
        "flex min-w-0 items-center gap-x-8 gap-y-5",
        legend === "right" ? "flex-wrap justify-center" : "flex-col",
        className,
      )}
      {...rest}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="group" aria-label={label} aria-roledescription="donut chart" className="block overflow-visible">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
              {/* The sweep: one thick stroke drawn clockwise from twelve o'clock reveals the ring. */}
              <motion.circle
                cx={c}
                cy={c}
                r={rMid}
                fill="none"
                stroke="white"
                strokeWidth={thickness + 16}
                transform={`rotate(-90 ${c} ${c})`}
                initial={false}
                animate={{ pathLength: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
                transition={reduce ? { pathLength: { duration: 0 }, opacity: { duration: 0.2 } } : { pathLength: { duration: 0.9, ease: ease.outQuart }, opacity: { duration: 0.1 } }}
              />
            </mask>
          </defs>

          {(empty || loading) && (
            <circle cx={c} cy={c} r={rMid} fill="none" strokeWidth={thickness} className={cn("stroke-fg/[0.07]", loading && "motion-safe:animate-pulse-soft")} />
          )}

          {!loading && (
            <g mask={`url(#${maskId})`}>
              {segments.map((s) => {
                const lifted = active === s.i;
                const dim = active != null && !lifted;
                return (
                  <g
                    key={s.label}
                    data-index={s.i}
                    tabIndex={s.i === Math.min(rover, segments.length - 1) ? 0 : -1}
                    role="img"
                    aria-label={`${s.label}: ${fmt(s.value)}, ${pf.format(s.value / sum)}`}
                    className="outline-none"
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHover(s.i)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
                    onPointerDown={(e) => e.pointerType !== "mouse" && tap(s.i)}
                    onFocus={(e) => {
                      setRover(s.i);
                      if ((e.currentTarget as Element).matches(":focus-visible")) setFocus(s.i);
                    }}
                    onBlur={() => setFocus(null)}
                    onKeyDown={(e) => onKey(e, s.i)}
                  >
                    <path
                      d={s.d}
                      fill="currentColor"
                      fillOpacity={inkOf(s.i)}
                      className={cn(
                        s.className ?? "text-fg",
                        "transition-[transform,opacity] duration-200 ease-out-expo motion-reduce:transition-opacity",
                        focus === s.i && "stroke-fg-3",
                      )}
                      strokeWidth={focus === s.i ? 1 : 0}
                      style={{
                        transformBox: "view-box",
                        transformOrigin: `${c}px ${c}px`,
                        // The active segment grows outward by a few pixels; reduced motion keeps only the dimming.
                        transform: lifted && !reduce ? `scale(${(r1 + 4) / r1})` : "scale(1)",
                        opacity: dim ? 0.35 : 1,
                      }}
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* The center answers for whatever is highlighted, and for the whole when nothing is. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center text-center" style={{ maxWidth: r0 * 1.6 }}>
            {loading ? (
              <span className="h-5 w-16 rounded bg-fg/[0.07] motion-safe:animate-pulse-soft" />
            ) : empty ? (
              <span className="text-[12.5px] text-fg-3">{emptyLabel}</span>
            ) : (
              <>
                <NumberFlow
                  value={center.value}
                  locales={locale}
                  format={format}
                  suffix={suffix}
                  animated={!reduce}
                  className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-fg"
                />
                <span className="relative grid h-4 w-full place-items-center overflow-hidden text-[11.5px] text-fg-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={center.label}
                      className="col-start-1 row-start-1 max-w-full truncate"
                      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                      transition={{ duration: 0.18, ease: ease.out }}
                    >
                      {center.label}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </>
            )}
          </div>
        </div>
        <span role="status" className="sr-only">
          {on ? `${on.label}: ${fmt(on.value)}, ${pf.format(on.value / sum)}` : ""}
        </span>
      </div>

      {legend !== "none" && !empty && (
        <ul aria-label={`${label} legend`} className={cn("flex min-w-0 flex-col", legend === "right" ? "min-w-[200px] flex-1" : "w-full")}>
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex h-8 items-center gap-2.5 px-2">
                  <span className="size-2 rounded-[2px] bg-fg/[0.07]" />
                  <span className="h-2.5 flex-1 rounded bg-fg/[0.07] motion-safe:animate-pulse-soft" style={{ maxWidth: 60 + ((i * 37) % 50) }} />
                </li>
              ))
            : segments.map((s) => (
                <li
                  key={s.label}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHover(s.i)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
                  onPointerDown={(e) => e.pointerType !== "mouse" && tap(s.i)}
                  className={cn(
                    "flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-[12.5px] transition-[background-color,opacity] duration-150",
                    active === s.i && "bg-hover",
                    active != null && active !== s.i && "opacity-55",
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-[2px] bg-current", s.className ?? "text-fg")} style={{ opacity: inkOf(s.i) }} />
                  <span className="min-w-0 flex-1 truncate text-fg-2">{s.label}</span>
                  <span className="text-fg tabular">{fmt(s.value)}</span>
                  <span className="w-11 text-right text-[11.5px] text-fg-3 tabular">{pf.format(s.value / sum)}</span>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
