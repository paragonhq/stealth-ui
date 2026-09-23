"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useState } from "react";
import { DeltaBadge } from "@/components/ui/delta-badge";

type Period = "week" | "month" | "year";

const periods: { value: Period; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

// Same four metrics, compared against three baselines. Churn and latency are better when they fall.
const rows: { name: string; value: string; inverse?: boolean; delta: Record<Period, number | null> }[] = [
  { name: "Recurring revenue", value: "$84,210", delta: { week: 2.3, month: 12.4, year: 148.2 } },
  { name: "Churn", value: "1.9%", inverse: true, delta: { week: 0.02, month: -0.8, year: -3.4 } },
  { name: "p95 latency", value: "182 ms", inverse: true, delta: { week: 3.1, month: -6.7, year: 0.3 } },
  { name: "Enterprise seats", value: "312", delta: { week: -1.2, month: 4.6, year: null } },
];

export default function Demo() {
  const [period, setPeriod] = useState<Period>("month");

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 pl-4 pr-2.5">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Compared with last</span>
        <RadioGroup
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
          aria-label="Compare with"
          className="flex h-7 rounded-md border border-line bg-page p-0.5"
        >
          {periods.map((p) => (
            <Radio.Root
              key={p.value}
              value={p.value}
              nativeButton
              render={<button type="button" />}
              className="rounded-[4px] px-2 text-[12px] font-medium text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.96] data-checked:bg-raised data-checked:text-fg data-checked:shadow-[var(--shadow)]"
            >
              {p.label}
            </Radio.Root>
          ))}
        </RadioGroup>
      </div>

      <ul aria-label="Metrics" className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2">{r.name}</span>
            <span className="text-[13px] font-medium text-fg tabular">{r.value}</span>
            <span className="flex w-[76px] justify-end">
              <DeltaBadge value={r.delta[period]} inverse={r.inverse} />
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-line px-4 py-2.5 text-[12px] text-fg-3">
        Enterprise seats since last {period}{" "}
        <DeltaBadge value={rows[3].delta[period]} variant="plain" size="sm" className="align-[-2px]" />
      </p>
    </div>
  );
}
