"use client";
import { useState } from "react";
import { SortableGrid, SortableGridItem } from "@/components/ui/sortable-grid";

type Metric = { id: string; label: string; value: string; delta: string; good: boolean; points: number[] };

const metrics: Metric[] = [
  { id: "mrr", label: "MRR", value: "$48.2k", delta: "+6.4%", good: true, points: [18, 20, 19, 23, 24, 27, 26, 30, 33] },
  { id: "active", label: "Active users", value: "12,480", delta: "+3.1%", good: true, points: [30, 29, 31, 33, 32, 34, 36, 35, 37] },
  { id: "churn", label: "Churn", value: "1.8%", delta: "+0.2 pt", good: false, points: [12, 13, 12, 14, 13, 15, 16, 15, 17] },
  { id: "latency", label: "p95 latency", value: "212 ms", delta: "−18 ms", good: true, points: [34, 33, 35, 30, 29, 27, 28, 25, 24] },
  { id: "deploys", label: "Deploys", value: "38", delta: "+9", good: true, points: [8, 12, 10, 14, 13, 17, 15, 19, 22] },
  { id: "incidents", label: "Open incidents", value: "2", delta: "−3", good: true, points: [22, 26, 24, 20, 18, 15, 16, 12, 10] },
];
const initial = metrics.map((m) => m.id);

// A dashboard's pinned metrics. Drag any tile, or Tab in, press Space, and use the arrow keys.
export default function Demo() {
  const [order, setOrder] = useState(initial);
  const pristine = order.join() === initial.join();

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <div className="flex h-8 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[14px] font-medium leading-5 tracking-[-0.015em] text-fg">Pinned metrics</h3>
          <span className="truncate text-[12px] text-fg-3">Last 30 days</span>
        </div>
        <button
          type="button"
          disabled={pristine}
          onClick={() => setOrder(initial)}
          className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,opacity,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
        >
          Reset layout
        </button>
      </div>

      <SortableGrid aria-label="Pinned metrics" value={order} onValueChange={setOrder}>
        {metrics.map((m) => (
          <SortableGridItem key={m.id} value={m.id} label={`${m.label}, ${m.value}`}>
            <div className="flex h-full flex-col gap-2.5">
              <span className="truncate text-[12px] leading-4 text-fg-3">{m.label}</span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[18px] font-medium leading-6 tracking-[-0.02em] text-fg tabular">{m.value}</span>
                <span className={`shrink-0 text-[11px] leading-4 tabular ${m.good ? "text-success" : "text-danger"}`}>{m.delta}</span>
              </div>
              <Spark points={m.points} />
            </div>
          </SortableGridItem>
        ))}
      </SortableGrid>
    </div>
  );
}

function Spark({ points }: { points: number[] }) {
  const w = 120;
  const h = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * w).toFixed(1)} ${(h - 2 - ((p - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-6 w-full overflow-visible text-fg-3" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
