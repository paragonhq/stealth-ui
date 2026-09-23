"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Truncate, TruncateGroup } from "@/components/ui/truncate";

const files = [
  { name: "q3-forecast-final-reviewed-v4.xlsx", path: "Shared drives/Finance/Planning/2026/Q3 forecast", size: "2.4 MB", kind: "sheet" },
  { name: "Brand guidelines — 2026 refresh (print-ready).pdf", path: "Shared drives/Design/Brand/Guidelines", size: "18.7 MB", kind: "doc" },
  { name: "IMG_20260914_183022_HDR.jpg", path: "Photos/Offsite Lisbon/Day 2", size: "4.1 MB", kind: "image" },
  { name: "notes.md", path: "Personal", size: "3 KB", kind: "doc" },
] as const;

const MIN = 208;
const MAX = 440;

function FileGlyph({ kind }: { kind: (typeof files)[number]["kind"] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
      {kind === "sheet" && <path d="M6 8.5h4.5M6 10.75h4.5M8.25 8.5v4.25" />}
      {kind === "doc" && <path d="M6 9h4.5M6 11h3" />}
      {kind === "image" && <path d="m5.5 12 1.75-1.75 1.25 1 1.5-1.5 1.5 1.75" />}
    </svg>
  );
}

// A shared folder you can narrow by dragging its edge: names cut in the middle so the
// version and extension survive, paths keep their last folder, and hovering or tabbing
// onto a row unfolds the full name in place.
export default function Demo() {
  const [width, setWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, w: 0 });
  const clamp = (w: number) => Math.round(Math.min(MAX, Math.max(MIN, w)));

  return (
    <div className="flex w-full max-w-[460px] justify-center">
      <div className="relative max-w-[calc(100%-12px)]" style={{ width }}>
        <section aria-labelledby="truncate-demo-title" className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
          <header className="flex min-w-0 flex-col gap-0.5 border-b border-line px-3.5 py-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <h3 id="truncate-demo-title" className="flex min-w-0 flex-1 text-[14px] font-medium tracking-[-0.015em] text-fg">
                <Truncate>Q3 planning — shared with Finance, Design and Leadership</Truncate>
              </h3>
              <span className="shrink-0 text-[12px] text-fg-3 tabular">{files.length} files</span>
            </div>
            <p className="flex min-w-0">
              <Truncate lines={2} className="text-[12px] leading-[18px] text-fg-3">
                Forecasts, brand assets and offsite photos for the planning cycle. Finance owns the spreadsheets, so ask Maya before moving anything.
              </Truncate>
            </p>
          </header>

          <TruncateGroup>
            <ul className="flex flex-col p-1.5">
              {files.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    className={cn(
                      "group/row flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-none",
                      "transition-[background-color,scale] duration-150 ease-out hover:bg-hover active:scale-[0.99] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                    )}
                  >
                    <span className="mt-px shrink-0 text-fg-3 transition-colors duration-150 group-hover/row:text-fg-2">
                      <FileGlyph kind={f.kind} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Truncate position="middle" className="text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg">
                        {f.name}
                      </Truncate>
                      <Truncate position="middle" className="text-[12px] leading-4 text-fg-3">
                        {f.path}
                      </Truncate>
                    </span>
                    <span className="mt-px shrink-0 text-[12px] leading-4 text-fg-3 tabular">{f.size}</span>
                  </button>
                </li>
              ))}
            </ul>
          </TruncateGroup>
        </section>

        {/* The panel's right edge, draggable and keyboard-resizable. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={width}
          tabIndex={0}
          data-dragging={dragging || undefined}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = { x: e.clientX, w: width };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            setWidth(clamp(start.current.w + (e.clientX - start.current.x)));
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 48 : 16;
            if (e.key === "ArrowLeft") setWidth((w) => clamp(w - step));
            else if (e.key === "ArrowRight") setWidth((w) => clamp(w + step));
            else if (e.key === "Home") setWidth(MIN);
            else if (e.key === "End") setWidth(MAX);
            else return;
            e.preventDefault();
          }}
          className={cn(
            "group/handle absolute -right-3 top-0 bottom-0 flex w-3 cursor-col-resize touch-none items-center justify-center outline-none",
            "before:absolute before:-inset-x-2 before:inset-y-0 before:content-['']",
          )}
        >
          <span
            className={cn(
              "h-8 w-1 rounded-full bg-line-2 transition-[background-color,scale] duration-150 ease-out",
              "group-hover/handle:scale-y-125 group-hover/handle:bg-fg-4",
              "group-data-dragging/handle:scale-y-150 group-data-dragging/handle:bg-fg-3",
              "group-focus-visible/handle:bg-fg-3 group-focus-visible/handle:outline-solid group-focus-visible/handle:outline-1 group-focus-visible/handle:outline-offset-2 group-focus-visible/handle:outline-fg-3",
            )}
          />
        </div>
      </div>
    </div>
  );
}
