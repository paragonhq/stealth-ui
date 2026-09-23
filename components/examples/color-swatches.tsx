"use client";
import { useState } from "react";
import { ColorSwatches, type Swatch } from "@/components/ui/color-swatches";

// Swatch colors are content, not theme: the label colors a team would pick from.
const LABEL_COLORS: Swatch[] = [
  { value: "#6e6e73", label: "Graphite" },
  { value: "#e5484d", label: "Red" },
  { value: "#f2a33a", label: "Amber" },
  { value: "#30a46c", label: "Green" },
  { value: "#3e63dd", label: "Blue" },
  { value: "#8e4ec6", label: "Violet" },
  { value: "#e8e6e1", label: "Chalk" },
];

const FINISHES: Swatch[] = [
  { value: "#1d1d1f", label: "Midnight" },
  { value: "#f0e9df", label: "Starlight" },
  { value: "#9aa7b4", label: "Sierra blue", disabled: true },
  { value: "#4a5a48", label: "Alpine green" },
];

export default function Demo() {
  const [color, setColor] = useState("#3e63dd");
  const [finish, setFinish] = useState("#1d1d1f");
  const name = LABEL_COLORS.find((c) => c.value === color)?.label ?? "Custom";
  const finishName = FINISHES.find((c) => c.value === finish)?.label;

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Edit label</h3>
          <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full border border-line-2 bg-raised px-2.5 text-[12px] text-fg-2">
            <span className="size-2 shrink-0 rounded-full transition-colors duration-200" style={{ background: color }} />
            <span className="truncate">Design review</span>
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span id="label-color" className="text-[12.5px] text-fg-2">
              Color
            </span>
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
              {name} {name === "Custom" ? color : ""}
            </span>
          </div>
          <ColorSwatches aria-labelledby="label-color" colors={LABEL_COLORS} value={color} onValueChange={setColor} allowCustom />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="min-w-0 truncate text-[12px] text-fg-3">
          Finish <span className="text-fg-2">· {finishName}</span>
        </span>
        <ColorSwatches aria-label="Finish" size="sm" colors={FINISHES} value={finish} onValueChange={setFinish} />
      </div>
    </div>
  );
}
