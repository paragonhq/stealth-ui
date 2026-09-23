"use client";
import { useState } from "react";
import { ResizableBox, type BoxRect } from "@/components/ui/resizable-box";

const revenue = [42, 48, 45, 57, 61, 58, 72, 79];

// A slide editor: the chart on the slide resizes from any edge or corner.
export default function Demo() {
  const [rect, setRect] = useState<BoxRect>({ x: 24, y: 72, width: 232, height: 148 });
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Board update, slide 4</h3>
        <span className="tabular font-mono text-[11px] text-fg-3">
          {Math.round(rect.width)} × {Math.round(rect.height)}
        </span>
      </div>

      {/* The slide is the box's offset parent, so it's also the wall the box can't cross. */}
      <div className="relative h-[300px] w-full rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="pointer-events-none absolute left-6 top-6 select-none">
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Q3 results</p>
          <p className="mt-1 text-[15px] font-medium tracking-[-0.015em] text-fg">Revenue grew 18% on Q2</p>
        </div>

        <ResizableBox aria-label="Revenue chart" value={rect} onValueChange={setRect} minWidth={120} minHeight={80} className="rounded-lg">
          <figure className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-frame p-3">
            <figcaption className="flex items-baseline justify-between gap-2 text-[11px] text-fg-3">
              <span className="truncate">Monthly revenue, €k</span>
              <span className="tabular shrink-0 text-fg-2">79</span>
            </figcaption>
            <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="mt-2 min-h-0 w-full flex-1" aria-hidden>
              {revenue.map((v, i) => (
                <rect key={i} x={i * 20 + 3} y={100 - v * 1.15} width={14} height={v * 1.15} rx={1.5} className={i === revenue.length - 1 ? "fill-fg" : "fill-fg-4"} />
              ))}
            </svg>
          </figure>
        </ResizableBox>
      </div>

      <p className="text-[12px] text-fg-3">
        <span className="pointer-coarse:hidden">Drag a handle. Shift keeps the proportions, Alt resizes from the center, Escape cancels.</span>
        <span className="hidden pointer-coarse:inline">Drag a handle to resize the chart.</span>
      </p>
    </div>
  );
}
