"use client";
import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef, useState } from "react";
import { BarChart } from "@/components/ui/bar-chart";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
// Revenue by plan, in dollars. 2026 grows mostly through Team.
const revenue = {
  "2025": months.map((month, i) => ({ month, pro: 8200 + i * 310, team: 5400 + i * 420, enterprise: 3100 + (i % 3) * 900 })),
  "2026": months.map((month, i) => ({ month, pro: 10100 + i * 260, team: 8800 + i * 910, enterprise: 4200 + (i % 4) * 1300 })),
};
const referrers = [
  { source: "google.com", visits: 18420 },
  { source: "news.ycombinator.com", visits: 9310 },
  { source: "github.com", visits: 6120 },
  { source: "x.com", visits: 3870 },
  { source: "linkedin.com", visits: 2140 },
  { source: "reddit.com/r/webdev", visits: 1480 },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const count = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const tab =
  "relative z-[1] flex h-7 items-center rounded-md px-2.5 text-[12.5px] text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 data-active:text-fg";

export default function Demo() {
  // The toggle answers at once; the chart keeps last year dimmed while the new one "loads".
  const [year, setYear] = useState<"2025" | "2026">("2026");
  const [shown, setShown] = useState<"2025" | "2026">("2026");
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pick = (y: "2025" | "2026") => {
    setYear(y);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(y), 650);
  };

  return (
    <Tabs.Root defaultValue="revenue" className="w-full max-w-[520px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <Tabs.List aria-label="Report" className="relative flex gap-0.5">
          <Tabs.Tab value="revenue" className={tab}>Revenue</Tabs.Tab>
          <Tabs.Tab value="referrers" className={tab}>Referrers</Tabs.Tab>
          <Tabs.Indicator className="absolute left-0 top-1/2 h-7 w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md bg-hover transition-[translate,width] duration-200 ease-in-out-quart" />
        </Tabs.List>
      </div>

      <Tabs.Panel value="revenue" className="px-4 pb-4 pt-3 outline-none">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-fg-2">Revenue by plan</span>
          <div role="group" aria-label="Year" className="flex rounded-md border border-line bg-page p-0.5">
            {(["2025", "2026"] as const).map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={year === y}
                onClick={() => pick(y)}
                className="h-6 rounded-[4px] px-2 text-[11.5px] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 tabular hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.95] aria-pressed:bg-raised aria-pressed:text-fg aria-pressed:shadow-[var(--shadow)]"
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          data={revenue[shown]}
          loading={year !== shown}
          categoryKey="month"
          series={[
            { key: "pro", label: "Pro" },
            { key: "team", label: "Team" },
            { key: "enterprise", label: "Enterprise" },
          ]}
          stacked
          label={`Revenue by plan, ${shown}`}
          height={200}
          formatValue={(v) => usd.format(v)}
          reference={{ value: 30000, label: "Target" }}
        />
      </Tabs.Panel>

      <Tabs.Panel value="referrers" className="px-4 pb-4 pt-3 outline-none">
        <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <span className="text-[12.5px] text-fg-2">Visits by source, last 30 days</span>
          <span className="truncate text-[11.5px] text-fg-3" aria-live="polite">
            {picked ? `Filtered to ${picked}` : "Select a source to filter"}
          </span>
        </div>
        <BarChart
          data={referrers}
          categoryKey="source"
          layout="horizontal"
          series={[{ key: "visits", label: "Visits" }]}
          label="Visits by referrer, last 30 days"
          formatValue={(v) => count.format(v)}
          onBarClick={(d) => setPicked((p) => (p === d.source ? null : d.source))}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
