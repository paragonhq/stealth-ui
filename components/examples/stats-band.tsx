"use client";
import { Stat, StatsBand } from "@/components/ui/stats-band";

// The proof band under a deploy platform's hero. Press the stage's replay
// button to watch it count again; on a real page it counts when scrolled to.
export default function Demo() {
  return (
    <section aria-labelledby="stats-title" className="flex w-full max-w-[760px] flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">By the numbers</span>
        <h2 id="stats-title" className="text-[20px] font-medium leading-[1.2] tracking-[-0.02em] text-balance text-fg">
          The platform under 12,000 teams’ deploys
        </h2>
      </div>
      <StatsBand className="border-t border-line pt-8">
        <Stat value={2_400_000_000} format={{ notation: "compact", maximumFractionDigits: 1 }} label="Requests served each week" />
        <Stat value={0.9999} format={{ style: "percent", minimumFractionDigits: 2 }} label="Uptime over the last year" detail="Status page, Sep–Aug" />
        <Stat value={38} suffix="s" label="Median time from push to live" detail="p50, last 30 days" />
        <Stat value={12480} label="Teams deploying every day" />
      </StatsBand>
    </section>
  );
}
