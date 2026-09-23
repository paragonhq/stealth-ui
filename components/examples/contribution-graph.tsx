"use client";
import { useState } from "react";
import { ContributionGraph } from "@/components/ui/contribution-graph";

// A year of deploys for one service: quiet weekends, a busy launch in spring, a holiday lull.
const END = Date.UTC(2026, 8, 22);
const data = (() => {
  let s = 42;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 371 }, (_, i) => {
    const t = END - (370 - i) * 86_400_000;
    const d = new Date(t);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const launch = d.getUTCMonth() === 3 ? 2.2 : 1;
    const lull = d.getUTCMonth() === 11 && d.getUTCDate() > 20 ? 0.1 : 1;
    const r = rand();
    const count = r < (weekend ? 0.75 : 0.18) ? 0 : Math.round(r * r * 11 * launch * lull * (weekend ? 0.4 : 1));
    return { date: new Date(t).toISOString().slice(0, 10), count };
  });
})();

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const services = ["api", "web", "worker", "billing", "search"];

export default function Demo() {
  const [day, setDay] = useState<string | null>("2026-09-15");
  const count = day ? (data.find((d) => d.date === day)?.count ?? 0) : 0;

  return (
    <div className="w-full max-w-[740px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Deploys</span>
        <span className="font-mono text-2xs text-fg-3">checkout-service</span>
      </div>
      <ContributionGraph data={data} endDate="2026-09-22" unit={["deploy", "deploys"]} label="Deploys to checkout-service" selected={day} onSelectedChange={setDay} />
      <div className="mt-3 flex min-h-9 items-center justify-between gap-3 border-t border-line pt-3 text-[12.5px]" aria-live="polite">
        {day ? (
          <>
            <span className="text-fg-2">
              <span className="text-fg">{fmt.format(Date.parse(`${day}T00:00:00Z`))}</span>
              {" · "}
              {count === 0 ? "No deploys" : `${count} deploy${count === 1 ? "" : "s"}`}
            </span>
            <span className="hidden truncate font-mono text-2xs text-fg-3 sm:block">
              {count > 0 ? services.slice(0, Math.min(3, count)).join(", ") + (count > 3 ? ` +${count - 3}` : "") : "—"}
            </span>
          </>
        ) : (
          <span className="text-fg-3">Select a day to see its deploys</span>
        )}
      </div>
    </div>
  );
}
