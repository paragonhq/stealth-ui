"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { RangeSlider } from "@/components/ui/range-slider";

// Nightly prices of the stays in a search, so the result count is real.
const PRICES = Array.from({ length: 240 }, (_, i) => Math.round(60 + ((i * 97) % 240) * 1.6 + ((i * 31) % 17) * 4));
const usd: Intl.NumberFormatOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };

// A stay-search filter: drag the ends, type an exact number, watch the count follow.
export default function Demo() {
  const [range, setRange] = useState<[number, number]>([120, 380]);
  const count = PRICES.filter((p) => p >= range[0] && p <= range[1]).length;

  return (
    <div className="w-full max-w-[360px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Price per night</h3>
        <p className="text-[12px] text-fg-3">Before taxes and fees</p>
      </div>

      <RangeSlider
        aria-label="Price per night"
        value={range}
        onValueChange={setRange}
        min={50}
        max={500}
        step={5}
        minDistance={20}
        format={usd}
        locale="en-US"
      />

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setRange([50, 500])}
          className="rounded-md px-1.5 py-1 text-[12.5px] text-fg-2 outline-none transition-[color,background-color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Clear
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          <span>
            Show <NumberFlow value={count} className="tabular" /> {count === 1 ? "stay" : "stays"}
          </span>
        </button>
      </div>
    </div>
  );
}
