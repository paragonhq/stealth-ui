"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { addDays, diffDays, useToday } from "@/components/ui/calendar";
import { DateRangePicker, type CompleteRange } from "@/components/ui/date-range-picker";

// A believable daily revenue series: deterministic per date, busier on weekdays.
const daily = (d: Date) => {
  const x = Math.sin(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) * 10000;
  const noise = x - Math.floor(x);
  return Math.round((d.getDay() % 6 === 0 ? 2600 : 4100) + noise * 1900);
};

function total(r: CompleteRange) {
  let sum = 0;
  for (let i = 0; i <= diffDays(r.start, r.end); i++) sum += daily(addDays(r.start, i));
  return sum;
}

// The date range on an analytics card: presets, a custom range, and nothing in the future.
export default function Demo() {
  const today = useToday();
  const [range, setRange] = useState<CompleteRange | null>(null);
  const r = range ?? (today ? { start: addDays(today, -29), end: today } : null);
  const len = r ? diffDays(r.start, r.end) + 1 : 0;
  const prev = r ? { start: addDays(r.start, -len), end: addDays(r.start, -1) } : null;
  const now = r ? total(r) : 0;
  const before = prev ? total(prev) : 0;
  const delta = before ? (now - before) / before : 0;
  const bars = r ? Array.from({ length: Math.min(len, 60) }, (_, i) => daily(addDays(r.end, -Math.min(len, 60) + 1 + i))) : [];
  const peak = Math.max(1, ...bars);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] font-medium tracking-[-0.015em]">Revenue</p>
        <DateRangePicker
          value={r}
          onValueChange={setRange}
          max={today ?? undefined}
          maxDays={365}
          align="end"
        />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <NumberFlow
            value={now}
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
            className="text-[24px] font-medium tracking-[-0.02em] tabular"
          />
          <p className="text-[12px] text-fg-3">
            <span className={delta >= 0 ? "text-success" : "text-danger"}>
              {delta >= 0 ? "↑" : "↓"} <NumberFlow value={Math.abs(delta)} format={{ style: "percent", maximumFractionDigits: 1 }} />
            </span>{" "}
            vs the {len} days before
          </p>
        </div>
      </div>
      <div aria-hidden className="flex h-16 items-end gap-px">
        {bars.map((v, i) => (
          <span
            key={i}
            className="min-w-px flex-1 rounded-t-[2px] bg-fg/25 transition-[height] duration-300 ease-out-expo"
            style={{ height: `${(v / peak) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
