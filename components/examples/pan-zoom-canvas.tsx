"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CanvasItem, PanZoomCanvas } from "@/components/ui/pan-zoom-canvas";

type Step = { id: string; n: string; title: string; meta: string; x: number; y: number; rows: number[] };

const steps: Step[] = [
  { id: "welcome", n: "01", title: "Welcome", meta: "1 screen · 4% drop-off", x: 0, y: 40, rows: [70, 90, 40] },
  { id: "workspace", n: "02", title: "Create workspace", meta: "2 fields · 11% drop-off", x: 280, y: 0, rows: [55, 100, 100] },
  { id: "invite", n: "03", title: "Invite your team", meta: "Optional · 23% skip", x: 560, y: -90, rows: [80, 100, 60] },
  { id: "connect", n: "04", title: "Connect a data source", meta: "6 integrations", x: 560, y: 130, rows: [45, 45, 100] },
  { id: "done", n: "05", title: "You're all set", meta: "Lands on the dashboard", x: 840, y: 20, rows: [60, 35] },
];
const W = 200;
const H = 118;
const edges: [string, string][] = [["welcome", "workspace"], ["workspace", "invite"], ["workspace", "connect"], ["invite", "done"], ["connect", "done"]];
const byId = Object.fromEntries(steps.map((s) => [s.id, s]));

function Edges() {
  // One SVG in world units behind the cards; it scales with them, so strokes stay crisp at any zoom.
  const minY = Math.min(...steps.map((s) => s.y));
  const maxY = Math.max(...steps.map((s) => s.y + H));
  return (
    <CanvasItem x={0} y={minY} className="pointer-events-none" aria-hidden>
      <svg width={840 + W} height={maxY - minY} className="overflow-visible">
        {edges.map(([a, b]) => {
          const s = byId[a];
          const t = byId[b];
          const x1 = s.x + W;
          const y1 = s.y + H / 2 - minY;
          const x2 = t.x;
          const y2 = t.y + H / 2 - minY;
          const mx = (x1 + x2) / 2;
          return (
            <g key={a + b} className="text-fg-4">
              <path d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              <circle cx={x1} cy={y1} r={3} className="fill-frame" stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              <circle cx={x2} cy={y2} r={3} className="fill-frame" stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
    </CanvasItem>
  );
}

// An onboarding flow on a canvas: pan around it, zoom into a step, fit it all back in.
export default function Demo() {
  const [selected, setSelected] = useState("workspace");
  return (
    <div className="flex w-full max-w-[600px] flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Onboarding flow</h3>
        <span className="text-[12px] text-fg-3">
          <span className="pointer-coarse:hidden">Drag, scroll or hold Space to pan</span>
          <span className="hidden pointer-coarse:inline">Drag to pan, pinch to zoom</span>
        </span>
      </div>
      <PanZoomCanvas aria-label="Onboarding flow canvas" defaultView="fit" height={380} className="w-full">
        <Edges />
        {steps.map((s) => (
          <CanvasItem key={s.id} x={s.x} y={s.y}>
            <button
              type="button"
              aria-pressed={selected === s.id}
              onClick={() => setSelected(s.id)}
              style={{ width: W, height: H }}
              className={cn(
                "flex flex-col rounded-xl border bg-raised p-3 text-left shadow-[var(--shadow)] outline-none",
                "transition-[border-color,box-shadow,scale] duration-150 active:scale-[0.98]",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                selected === s.id ? "border-fg-3 ring-3 ring-fg/10" : "border-line-2 hover:border-fg-4",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-2xs text-fg-4">{s.n}</span>
                <span className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">{s.title}</span>
              </span>
              <span aria-hidden className="mt-2.5 flex flex-1 flex-col gap-1.5">
                {s.rows.map((w, i) => (
                  <span key={i} className="h-1.5 rounded-full bg-line-2" style={{ width: `${w}%` }} />
                ))}
              </span>
              <span className="tabular mt-2 truncate text-[11.5px] text-fg-3">{s.meta}</span>
            </button>
          </CanvasItem>
        ))}
      </PanZoomCanvas>
    </div>
  );
}
