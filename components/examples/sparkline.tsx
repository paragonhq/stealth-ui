"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { Sparkline } from "@/components/ui/sparkline";

// Deterministic noise, so the server and the browser draw the same lines.
function series(n: number, start: number, drift: number, wobble: number, seed: number) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  let v = start;
  return Array.from({ length: n }, () => (v = Math.max(0, v + drift + rand() * wobble)));
}

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const days = Array.from({ length: 30 }, (_, i) => day.format(Date.UTC(2026, 7, 24 + i)));
const mrr = series(30, 41800, 240, 900, 7).map((v) => Math.round(v));
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const services = [
  {
    name: "api-gateway",
    metric: "p95 latency",
    data: series(24, 212, -2.2, 22, 3).map((v) => Math.round(v)),
    unit: (v: number) => `${v} ms`,
    inverse: true,
  },
  {
    name: "checkout",
    metric: "Error rate",
    // Two hours of missing samples while the collector restarted.
    data: series(24, 0.4, 0.035, 0.22, 11).map((v, i) => (i === 9 || i === 10 ? null : Math.round(v * 100) / 100)),
    unit: (v: number) => `${v.toFixed(2)}%`,
    inverse: true,
    live: true,
  },
  {
    name: "search-indexer",
    metric: "Throughput",
    data: series(24, 1200, 4, 140, 5).map((v) => Math.round(v)),
    unit: (v: number) => `${(v / 1000).toFixed(2)}k/s`,
    inverse: false,
  },
];

export default function Demo() {
  const [at, setAt] = useState<number | null>(null);
  const i = at ?? mrr.length - 1;
  const change = (mrr[i] - mrr[0]) / mrr[0];

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] text-fg-2">Monthly recurring revenue</span>
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4 tabular">{at == null ? "Today" : days[at]}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <NumberFlow
            value={mrr[i]}
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
            locales="en-US"
            className="text-[26px] font-medium tracking-[-0.03em] text-fg"
          />
          <span className={change >= 0 ? "text-[12px] text-success tabular" : "text-[12px] text-danger tabular"}>
            {change >= 0 ? "+" : "−"}
            {Math.abs(change * 100).toFixed(1)}%
          </span>
        </div>
        <Sparkline
          data={mrr}
          labels={days}
          label="Monthly recurring revenue, last 30 days"
          variant="area"
          height={56}
          tooltip={false}
          onScrub={setAt}
          formatValue={(v) => `$${v.toLocaleString("en-US")}`}
          className="mt-3"
        />
        <div className="mt-2 flex justify-between text-2xs text-fg-4 tabular">
          <span>{days[0]}</span>
          <span>{days[days.length - 1]}</span>
        </div>
      </div>

      <ul aria-label="Services, last 24 hours" className="divide-y divide-line rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        {services.map((s) => {
          const last = s.data.at(-1) as number;
          return (
            <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_80px_60px] items-center gap-3 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_120px_68px]">
              <div className="min-w-0">
                <div className="truncate font-mono text-[12px] text-fg">{s.name}</div>
                <div className="flex items-center gap-1.5 truncate text-[11.5px] text-fg-3">
                  {s.metric}
                  {s.live && <span className="text-2xs text-fg-4">· live</span>}
                </div>
              </div>
              <Sparkline
                data={s.data}
                labels={hours}
                label={`${s.name} ${s.metric.toLowerCase()}, last 24 hours`}
                tone="trend"
                inverse={s.inverse}
                live={s.live}
                height={24}
                formatValue={s.unit}
              />
              <span className="text-right text-[12px] text-fg tabular">{s.unit(last)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
