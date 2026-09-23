"use client";
import { useState } from "react";
import { Calendar, Menu } from "@/lib/icons";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

function Board(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="2.5" y="3" width="3" height="10" rx="1" />
      <rect x="6.5" y="3" width="3" height="7" rx="1" />
      <rect x="10.5" y="3" width="3" height="8.5" rx="1" />
    </svg>
  );
}

const ranges = { "7d": "7 days", "30d": "30 days", "90d": "90 days", "12m": "12 months" } as const;

// The toolbar above an issue list: how to look at it, how to group it, and
// how far back to go. Arrow keys move the selection once a control has focus.
export default function Demo() {
  const [view, setView] = useState("board");
  const [range, setRange] = useState<keyof typeof ranges>("30d");

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Checkout issues</h3>
        <SegmentedControl aria-label="View" value={view} onValueChange={setView}>
          <SegmentedControlItem value="list" icon={<Menu />}>List</SegmentedControlItem>
          <SegmentedControlItem value="board" icon={<Board />}>Board</SegmentedControlItem>
          <SegmentedControlItem value="timeline" icon={<Calendar />}>Timeline</SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span id="group-by" className="text-[12.5px] text-fg-2">Group by</span>
        <SegmentedControl aria-labelledby="group-by" size="sm" defaultValue="status">
          <SegmentedControlItem value="status">Status</SegmentedControlItem>
          <SegmentedControlItem value="assignee">Assignee</SegmentedControlItem>
          <SegmentedControlItem value="cycle" disabled>Cycle</SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span id="range" className="text-[12.5px] text-fg-2">Closed in the last</span>
          <span className="text-[12px] tabular text-fg-3">{ranges[range]}</span>
        </div>
        <SegmentedControl aria-labelledby="range" fill value={range} onValueChange={(v) => setRange(v as keyof typeof ranges)}>
          {Object.keys(ranges).map((r) => (
            <SegmentedControlItem key={r} value={r} className="tabular">
              {r}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
    </div>
  );
}
