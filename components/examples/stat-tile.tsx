"use client";
import { useEffect, useState } from "react";
import { StatTile, type StatPoint } from "@/components/ui/stat-tile";

type Period = "7d" | "30d" | "90d";

// A fixed seed keeps the server and client drawing the same line.
function series(days: number, start: number, drift: number, noise: number, seed: number): StatPoint[] {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const end = Date.UTC(2026, 8, 21);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  let v = start;
  return Array.from({ length: days }, (_, i) => {
    v = Math.max(0, v * (1 + drift + rand() * noise));
    return { label: fmt.format(end - (days - 1 - i) * 86400000), value: Math.round(v) };
  });
}

const revenue: Record<Period, { data: StatPoint[]; delta: number; comparison: string }> = {
  "7d": { data: series(7, 38200, 0.012, 0.12, 7), delta: 4.2, comparison: "vs previous 7 days" },
  "30d": { data: series(30, 31000, 0.009, 0.1, 30), delta: 12.4, comparison: "vs previous 30 days" },
  "90d": { data: series(90, 21000, 0.007, 0.09, 90), delta: 38.9, comparison: "vs previous 90 days" },
};
const sum = (d: StatPoint[]) => d.reduce((a, p) => a + p.value, 0);

const latency = series(30, 240, -0.006, 0.08, 12);

export default function Demo() {
  const [period, setPeriod] = useState<Period>("30d");
  const [shown, setShown] = useState<Period>("30d");
  const [loadingLatency, setLoadingLatency] = useState(true);

  // Changing the period "fetches" for 700ms: the tile keeps its numbers and dims the line meanwhile.
  useEffect(() => {
    if (period === shown) return;
    const t = window.setTimeout(() => setShown(period), 700);
    return () => window.clearTimeout(t);
  }, [period, shown]);

  // The second tile is still on its first load when the page opens.
  useEffect(() => {
    const t = window.setTimeout(() => setLoadingLatency(false), 2400);
    return () => window.clearTimeout(t);
  }, []);

  const r = revenue[shown];

  return (
    <div className="grid w-full max-w-[560px] gap-3 sm:grid-cols-2">
      <StatTile
        label="Revenue"
        value={sum(r.data)}
        currency="USD"
        compact
        delta={r.delta}
        comparison={r.comparison}
        data={r.data}
        periods={[
          { value: "7d", label: "7D" },
          { value: "30d", label: "30D" },
          { value: "90d", label: "90D" },
        ]}
        period={period}
        onPeriodChange={(p) => setPeriod(p as Period)}
        loading={period !== shown}
      />
      <StatTile
        label="p95 latency"
        value={loadingLatency ? null : latency[latency.length - 1].value}
        format={{ style: "unit", unit: "millisecond", unitDisplay: "short" }}
        inverse
        delta={loadingLatency ? null : -8.3}
        comparison="vs previous 30 days"
        data={loadingLatency ? undefined : latency}
        loading={loadingLatency}
      />
    </div>
  );
}
