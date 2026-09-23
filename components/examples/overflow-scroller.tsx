"use client";
import { useState } from "react";
import { File, Image, Users } from "@/lib/icons";
import { OverflowScroller } from "@/components/ui/overflow-scroller";

type Kind = "doc" | "sheet" | "slides" | "image" | "pdf";

const filters: {
  id: string;
  label: string;
  match: (f: (typeof files)[number]) => boolean;
}[] = [
  { id: "all", label: "All files", match: () => true },
  { id: "doc", label: "Documents", match: (f) => f.kind === "doc" },
  { id: "sheet", label: "Spreadsheets", match: (f) => f.kind === "sheet" },
  { id: "slides", label: "Presentations", match: (f) => f.kind === "slides" },
  { id: "image", label: "Images", match: (f) => f.kind === "image" },
  { id: "pdf", label: "PDFs", match: (f) => f.kind === "pdf" },
  { id: "shared", label: "Shared with me", match: (f) => !!f.shared },
  { id: "starred", label: "Starred", match: (f) => !!f.starred },
];

const files: {
  name: string;
  kind: Kind;
  by: string;
  when: string;
  shared?: boolean;
  starred?: boolean;
}[] = [
  {
    name: "q3-forecast.xlsx",
    kind: "sheet",
    by: "Priya Raman",
    when: "12m ago",
    shared: true,
    starred: true,
  },
  {
    name: "Launch plan — Atlas",
    kind: "doc",
    by: "You",
    when: "1h ago",
    starred: true,
  },
  {
    name: "Board update Sept.key",
    kind: "slides",
    by: "Marcus Oyelaran",
    when: "3h ago",
    shared: true,
  },
  {
    name: "hero-v4@2x.png",
    kind: "image",
    by: "Lena Fischer",
    when: "Yesterday",
  },
  {
    name: "MSA-countersigned.pdf",
    kind: "pdf",
    by: "Legal",
    when: "Yesterday",
    shared: true,
  },
  { name: "Hiring scorecard", kind: "sheet", by: "You", when: "Mon" },
  {
    name: "Onboarding checklist",
    kind: "doc",
    by: "Sam Whitaker",
    when: "Mon",
    shared: true,
  },
  {
    name: "pricing-tiers-final-final.pdf",
    kind: "pdf",
    by: "You",
    when: "12 Sep",
  },
];

const kindLabel: Record<Kind, string> = {
  doc: "Doc",
  sheet: "Sheet",
  slides: "Slides",
  image: "Image",
  pdf: "PDF",
};

// A file browser header: filter chips on top, recent files underneath. Pick a
// filter that fits on screen and the card row's arrows fade away on their own.
export default function Demo() {
  const [filter, setFilter] = useState("all");
  const shown = files.filter(filters.find((f) => f.id === filter)!.match);

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <OverflowScroller label="Filter files" size="sm" fade={48}>
        {filters.map((f) => {
          const on = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.id)}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium outline-none transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 ${
                on
                  ? "border-fg bg-fg text-frame"
                  : "border-line-2 bg-raised text-fg-2 hover:border-fg-4 hover:text-fg"
              }`}
            >
              {f.id === "shared" && <Users size={13} className="-ml-0.5" />}
              {f.label}
            </button>
          );
        })}
      </OverflowScroller>

      <OverflowScroller
        label="Recent files"
        trackClassName="gap-2.5 items-stretch"
      >
        {shown.map((f) => (
          <a
            key={f.name}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="group/file flex h-[120px] w-[168px] shrink-0 flex-col justify-between gap-3 rounded-xl border border-line-2 bg-raised p-3 shadow-[var(--shadow)] outline-none transition-[border-color,scale] duration-150 ease-out hover:border-fg-4 active:scale-[0.98] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-7 place-items-center rounded-md border border-line bg-hover text-fg-2">
                {f.kind === "image" ? <Image size={14} /> : <File size={14} />}
              </span>
              <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
                {kindLabel[f.kind]}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="line-clamp-2 text-[13px] font-medium leading-snug text-fg [overflow-wrap:anywhere]">
                {f.name}
              </span>
              <span className="truncate text-[11.5px] text-fg-3">
                {f.by} · {f.when}
              </span>
            </div>
          </a>
        ))}
      </OverflowScroller>
    </div>
  );
}
