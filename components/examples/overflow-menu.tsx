"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CircleCheck, Download, Filter, Link, Plus, Settings, Sliders } from "@/lib/icons";
import { OverflowMenu, type OverflowItem } from "@/components/ui/overflow-menu";

const MIN = 200;
const MAX = 680;

// An issue tracker's view bar. Drag the handle (or focus it and use the arrow keys) to narrow
// the panel: the least important controls fold into More first, and come back as it widens.
export default function Demo() {
  const [width, setWidth] = useState(520);
  const [hideDone, setHideDone] = useState(true);
  const [sort, setSort] = useState<"Priority" | "Updated">("Priority");
  const [last, setLast] = useState("");
  const drag = useRef<{ x: number; w: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  // On a narrow screen the panel is already smaller than the state says; start from what's drawn.
  const drawn = (w: number) => Math.min(w, card.current?.offsetWidth ?? w);

  const items: OverflowItem[] = [
    { id: "filter", label: "Filter", icon: <Filter />, priority: 10, onSelect: () => setLast("Filter") },
    { id: "sort", label: `Sort: ${sort}`, icon: <Sliders />, priority: 8, onSelect: () => setSort((s) => (s === "Priority" ? "Updated" : "Priority")) },
    { id: "done", label: "Hide done", icon: <CircleCheck />, priority: 5, pressed: hideDone, onSelect: () => setHideDone((v) => !v) },
    { id: "display", label: "Display", icon: <Settings />, priority: 6, onSelect: () => setLast("Display") },
    { id: "export", label: "Export CSV", icon: <Download />, priority: 2, onSelect: () => setLast("Export CSV") },
    { id: "copy", label: "Copy view link", icon: <Link />, priority: 1, iconOnly: true, onSelect: () => setLast("Copy view link") },
  ];

  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-3">
      <div className="relative flex w-full justify-center">
        <div
          ref={card}
          style={{ width: `min(${width}px, 100%)` }}
          className="relative rounded-xl border border-line bg-raised shadow-[var(--shadow)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
            <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Checkout · Active issues</p>
            <p className="shrink-0 text-[12px] text-fg-3 tabular">{hideDone ? "14" : "23"}</p>
          </div>
          <OverflowMenu
            label="View options"
            items={items}
            className="px-1.5 py-1.5"
            end={
              <button
                type="button"
                onClick={() => setLast("New issue")}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-fg px-2.5 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
              >
                <Plus size={14} />
                New issue
              </button>
            }
          />
          <div className="flex flex-col gap-px border-t border-line px-3.5 py-2">
            {["Saved cards fail on Safari 17", "Address form loses focus on paste", "Tax line rounds twice"].map((t, i) => (
              <p key={t} className="flex items-center gap-2 py-1 text-[12.5px] text-fg-2">
                <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-fg-4">CHK-{212 - i * 7}</span>
                <span className="truncate">{t}</span>
              </p>
            ))}
          </div>

          {/* The resize handle: drag it, or focus it and press the arrow keys. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Panel width"
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            aria-valuenow={width}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, w: drawn(width) };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              // Both edges move because the panel is centered, so the pointer's travel counts twice.
              setWidth(Math.round(Math.min(MAX, Math.max(MIN, drag.current.w + (e.clientX - drag.current.x) * 2))));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 60 : 20;
              if (e.key === "ArrowLeft") setWidth((w) => Math.max(MIN, drawn(w) - step));
              else if (e.key === "ArrowRight") setWidth((w) => Math.min(MAX, w + step));
              else if (e.key === "Home") setWidth(MIN);
              else if (e.key === "End") setWidth(MAX);
              else return;
              e.preventDefault();
            }}
            className={cn(
              "group/handle absolute -right-5 top-1/2 max-sm:-right-3.5 flex h-16 w-6 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full outline-none",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
            )}
          >
            <span className="h-8 w-1 rounded-full bg-fg-4 transition-[background-color,height] duration-150 group-hover/handle:h-10 group-hover/handle:bg-fg-3 group-active/handle:bg-fg-2" />
          </div>
        </div>
      </div>
      <p className="h-4 text-[12px] text-fg-3 tabular">
        <span role="status" aria-live="polite">{last ? `${last} · ` : ""}</span>
        <span aria-hidden className="max-sm:hidden">{width}px</span>
      </p>
    </div>
  );
}
