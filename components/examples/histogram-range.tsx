"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { countInRange, HistogramRange, type Range } from "@/components/ui/histogram-range";

// Nightly prices for 1,284 stays: a long right tail, with everything past $600 grouped at the top.
// A seeded generator keeps server and client identical.
const PRICES = (() => {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 1284 }, () => {
    const g = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    return Math.round(Math.exp(5.1 + 0.55 * g));
  });
})();
const MIN = 20;
const MAX = 600;

export default function Demo() {
  const [range, setRange] = useState<Range>([80, 420]);
  const count = countInRange({ data: PRICES, min: MIN, max: MAX }, range);
  const filtered = range[0] > MIN || range[1] < MAX;

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="px-4 pb-4 pt-4">
        <HistogramRange
          data={PRICES}
          min={MIN}
          max={MAX}
          step={5}
          value={range}
          onValueChange={setRange}
          openEnded
          label="Price range"
          description="Nightly prices before fees and taxes"
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <button
          type="button"
          disabled={!filtered}
          onClick={() => setRange([MIN, MAX])}
          className={cn(
            "h-8 rounded-md px-2 text-[13px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[color,opacity,scale] duration-150 hover:decoration-fg-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          Clear
        </button>
        <button
          type="button"
          disabled={count === 0}
          className={cn(
            "h-9 min-w-[148px] rounded-lg bg-fg px-3.5 text-[13px] font-medium text-frame",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,scale,opacity] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75 disabled:opacity-50",
          )}
        >
          {count === 0 ? (
            "No stays in this range"
          ) : (
            <>
              Show <NumberFlow value={count} className="tabular" /> {count === 1 ? "stay" : "stays"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
