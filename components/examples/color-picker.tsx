"use client";
import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";

const brand = ["#6E56CF", "#3E63DD", "#0D9488", "#30A46C", "#F5A524", "#E5484D", "#D6409F", "#1C2024"];

const initialLabels = [
  { name: "Bug", color: "#E5484D" },
  { name: "Needs design review", color: "#D6409F" },
  { name: "Performance", color: "#F5A524" },
];

// A workspace's appearance settings: the accent color, then the labels teams tag issues with.
export default function Demo() {
  const [accent, setAccent] = useState("#6E56CF");
  const [labels, setLabels] = useState(initialLabels);
  const [recent, setRecent] = useState<string[]>(["#0D9488", "#3E63DD"]);

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-fg">Accent color</span>
        <div className="flex items-center gap-2">
          <ColorPicker variant="field" label="Accent color" value={accent} onValueChange={setAccent} swatches={brand} recent={recent} onRecentChange={setRecent} className="w-[168px]" />
          <span className="inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-medium" style={{ background: accent, color: contrastText(accent) }}>
            Publish
          </span>
        </div>
        <p className="text-[12px] text-fg-3">Used for primary buttons and links in your help center.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-fg">Labels</span>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-raised">
          {labels.map((l, i) => (
            <li key={l.name} className="flex h-11 items-center gap-3 pl-2 pr-3">
              <ColorPicker
                size="sm"
                label={`${l.name} label color`}
                value={l.color}
                onValueChange={(c) => setLabels((all) => all.map((x, j) => (j === i ? { ...x, color: c } : x)))}
                alpha={false}
                recent={recent}
                onRecentChange={setRecent}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{l.name}</span>
              <span className="shrink-0 font-mono text-[11px] uppercase tabular text-fg-3">{l.color.slice(0, 7)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Picks near-black or near-white text for a preview chip, from the color's luminance.
function contrastText(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "hsl(0 0% 8%)" : "hsl(0 0% 98%)";
}
