"use client";
import { LineChart } from "@/components/ui/line-chart";

// Deterministic noise, so the server and the browser draw the same lines.
function walk(n: number, start: number, drift: number, wobble: number, seed: number, weekly = 0) {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  let v = start;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, v + drift + rand() * wobble);
    // Weekends dip.
    return Math.round(v * (i % 7 === 5 || i % 7 === 6 ? 1 - weekly : 1));
  });
}

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const web = walk(30, 8200, 55, 520, 3, 0.18);
const mobile = walk(30, 3900, 70, 380, 9, 0.04);
const previous = walk(30, 7600, 30, 480, 21, 0.18);
const data = web.map((w, i) => ({
  date: day.format(Date.UTC(2026, 7, 24 + i)),
  web: w,
  mobile: mobile[i],
  previous: previous[i],
}));

const total = (k: "web" | "mobile") => data.reduce((s, d) => s + d[k], 0);
const n = new Intl.NumberFormat("en-US");

export default function Demo() {
  return (
    <div className="w-full max-w-[540px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="text-[12.5px] text-fg-2">Daily active users</div>
          <div className="mt-0.5 text-[22px] font-medium tracking-[-0.02em] text-fg">{n.format(Math.round((total("web") + total("mobile")) / 30))}</div>
        </div>
        <div className="text-[11.5px] text-fg-3">Aug 24 – Sep 22, average per day</div>
      </div>
      <LineChart
        data={data}
        xKey="date"
        label="Daily active users by platform, last 30 days"
        series={[
          { key: "web", label: "Web" },
          { key: "mobile", label: "Mobile" },
          { key: "previous", label: "Web, previous 30 days", variant: "dashed" },
        ]}
        curve="monotone"
        area
        height={190}
      />
    </div>
  );
}
