"use client";
import { useState } from "react";
import { ChevronRight, Folder } from "@/lib/icons";
import { DragSelect, DragSelectArea, DragSelectCount, DragSelectItem, useDragSelect } from "@/components/ui/drag-select";

type Kind = "folder" | "pdf" | "xlsx" | "png" | "fig" | "docx" | "csv";
const files: { name: string; kind: Kind; meta: string }[] = [
  { name: "Research", kind: "folder", meta: "14 items" },
  { name: "Exports", kind: "folder", meta: "6 items" },
  { name: "q3-forecast.xlsx", kind: "xlsx", meta: "412 KB" },
  { name: "board-deck-v4.pdf", kind: "pdf", meta: "8.2 MB" },
  { name: "pricing-page.fig", kind: "fig", meta: "21 MB" },
  { name: "churn-by-cohort.csv", kind: "csv", meta: "96 KB" },
  { name: "launch-plan.docx", kind: "docx", meta: "188 KB" },
  { name: "hero-dark@2x.png", kind: "png", meta: "1.4 MB" },
  { name: "hero-light@2x.png", kind: "png", meta: "1.3 MB" },
  { name: "okrs-q3-final-final.docx", kind: "docx", meta: "64 KB" },
  { name: "invoice-0423.pdf", kind: "pdf", meta: "220 KB" },
  { name: "invoice-0424.pdf", kind: "pdf", meta: "218 KB" },
  { name: "headcount-plan.xlsx", kind: "xlsx", meta: "305 KB" },
  { name: "onboarding-flow.fig", kind: "fig", meta: "34 MB" },
  { name: "nps-responses.csv", kind: "csv", meta: "1.1 MB" },
  { name: "offsite-agenda.docx", kind: "docx", meta: "42 KB" },
  { name: "team-photo.png", kind: "png", meta: "4.8 MB" },
  { name: "security-review.pdf", kind: "pdf", meta: "2.6 MB" },
  { name: "roadmap-h2.fig", kind: "fig", meta: "12 MB" },
  { name: "vendor-costs.xlsx", kind: "xlsx", meta: "150 KB" },
  { name: "usage-export.csv", kind: "csv", meta: "3.9 MB" },
  { name: "brand-guidelines.pdf", kind: "pdf", meta: "18 MB" },
  { name: "interview-notes.docx", kind: "docx", meta: "77 KB" },
  { name: "logo-mark.png", kind: "png", meta: "88 KB" },
];

// A folder in a file browser. Drag across empty space or over files; Shift adds, ⌘ or Ctrl toggles.
export default function Demo() {
  const [selected, setSelected] = useState<string[]>(["board-deck-v4.pdf"]);
  return (
    <DragSelect
      value={selected}
      onValueChange={setSelected}
      className="h-[400px] w-full max-w-[540px] overflow-hidden rounded-xl border border-line bg-frame"
    >
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line ps-3 pe-2">
        <nav aria-label="Path" className="flex min-w-0 flex-1 items-center gap-1 text-[12.5px] text-fg-3">
          <span className="hidden truncate sm:inline">Shared</span>
          <ChevronRight size={12} className="hidden shrink-0 text-fg-4 sm:block" />
          <span className="truncate font-medium text-fg">Q3 planning</span>
        </nav>
        <DragSelectCount noun={["file", "files"]} />
        <SelectionButton />
      </div>
      <DragSelectArea label="Files in Q3 planning" gridClassName="grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
        {files.map((f) => (
          <DragSelectItem key={f.name} value={f.name} label={f.name}>
            <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
              <Glyph kind={f.kind} />
              <span className="line-clamp-2 w-full text-[12px] leading-4 text-fg [overflow-wrap:anywhere]">{breakable(f.name)}</span>
              <span className="text-[11px] leading-3 text-fg-4 tabular">{f.meta}</span>
            </div>
          </DragSelectItem>
        ))}
      </DragSelectArea>
    </DragSelect>
  );
}

// Long names wrap before the extension and after separators instead of mid-word.
const breakable = (name: string) => name.replace(/(\.[^.]+)$/, "\u200b$1").replace(/([_@])/g, "$1\u200b");

// One button whose verb follows the state: select everything, or let go of it.
function SelectionButton() {
  const { selected, total, clear, selectAll } = useDragSelect();
  const any = selected.length > 0;
  return (
    <button
      type="button"
      onClick={any ? clear : selectAll}
      className="grid h-7 shrink-0 justify-items-end rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
      disabled={!total}
    >
      {/* Both labels share one cell so the button never changes width. */}
      <span className={`col-start-1 row-start-1 self-center ${any ? "" : "invisible"}`}>Clear</span>
      <span className={`col-start-1 row-start-1 self-center ${any ? "invisible" : ""}`}>Select all</span>
    </button>
  );
}

function Glyph({ kind }: { kind: Kind }) {
  if (kind === "folder")
    return (
      <span className="grid h-12 w-12 place-items-center text-fg-3">
        <Folder size={40} strokeWidth={0.9} />
      </span>
    );
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden className="shrink-0">
      <path d="M12.5 5.5h16l9 9v27a2 2 0 0 1-2 2h-23a2 2 0 0 1-2-2v-34a2 2 0 0 1 2-2Z" className="fill-raised stroke-line-2" />
      <path d="M28.5 5.5v7a2 2 0 0 0 2 2h7" className="stroke-line-2" />
      <rect x="15" y="31" width="18" height="8" rx="2" className="fill-hover stroke-line-2" strokeWidth={0.75} />
      <text x="24" y="37" textAnchor="middle" className="fill-fg-2 font-mono text-[5.5px] uppercase tracking-[0.06em]">
        {kind}
      </text>
    </svg>
  );
}
