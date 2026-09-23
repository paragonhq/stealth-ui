"use client";
import { useState } from "react";
import { Calendar, Menu } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const stroke = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const Board = () => (<svg {...stroke}><rect x="2.5" y="3" width="3.25" height="10" rx="1" /><rect x="7.25" y="3" width="3.25" height="7" rx="1" /><rect x="12" y="3" width="1.5" height="4.5" rx=".75" /></svg>);
const Align = ({ lines }: { lines: [number, number][] }) => (<svg {...stroke}>{lines.map(([a, b], i) => <path key={i} d={`M${a} ${4 + i * 2.75}H${b}`} />)}</svg>);
const alignLeft: [number, number][] = [[3, 13], [3, 9.5], [3, 12], [3, 8]];
const alignCenter: [number, number][] = [[3, 13], [4.75, 11.25], [3.75, 12.25], [5.5, 10.5]];
const alignRight: [number, number][] = [[3, 13], [6.5, 13], [4, 13], [8, 13]];
const Bold = () => (<svg {...stroke} strokeWidth={1.6}><path d="M4.75 3h4a2.5 2.5 0 0 1 0 5h-4zM4.75 8h4.75a2.5 2.5 0 0 1 0 5H4.75z" /></svg>);
const Italic = () => (<svg {...stroke}><path d="M7 3h5M4 13h5M9.5 3l-3 10" /></svg>);
const Underline = () => (<svg {...stroke}><path d="M4.5 3v4.5a3.5 3.5 0 0 0 7 0V3M3.5 13.5h9" /></svg>);
const Strike = () => (<svg {...stroke}><path d="M3 8h10M11 4.75C10.5 3.6 9.4 3 8 3 6.3 3 5 3.9 5 5.25c0 .9.5 1.5 1.4 1.95M5 11.25C5.5 12.4 6.6 13 8 13c1.7 0 3-.9 3-2.25 0-.4-.1-.75-.3-1.05" /></svg>);

// An issues view switcher that keeps one view on, and a text toolbar with a
// single-choice alignment set and multi-choice formatting.
export default function Demo() {
  const [view, setView] = useState(["board"]);
  const [align, setAlign] = useState(["left"]);
  const [marks, setMarks] = useState(["bold", "italic"]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line py-2.5 pl-4 pr-2.5">
          <div className="min-w-0 flex-1 basis-28">
            <p className="text-[13px] font-medium text-fg">Issues</p>
            <p className="truncate text-[12px] text-fg-3">24 open · Cycle 18</p>
          </div>
          <ToggleGroup aria-label="View" value={view} onValueChange={setView} required>
            <ToggleGroupItem value="list"><Menu />List</ToggleGroupItem>
            <ToggleGroupItem value="board"><Board />Board</ToggleGroupItem>
            <ToggleGroupItem value="calendar"><Calendar />Calendar</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Preview view={view[0]} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2.5">
        <ToggleGroup aria-label="Text formatting" size="sm" multiple value={marks} onValueChange={setMarks}>
          <ToggleGroupItem value="bold" label="Bold" shortcut="⌘ B"><Bold /></ToggleGroupItem>
          <ToggleGroupItem value="italic" label="Italic" shortcut="⌘ I"><Italic /></ToggleGroupItem>
          <ToggleGroupItem value="underline" label="Underline" shortcut="⌘ U"><Underline /></ToggleGroupItem>
          <ToggleGroupItem value="strike" label="Strikethrough" shortcut="⌘ ⇧ X"><Strike /></ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup aria-label="Text alignment" size="sm" value={align} onValueChange={setAlign} required>
          <ToggleGroupItem value="left" label="Align left"><Align lines={alignLeft} /></ToggleGroupItem>
          <ToggleGroupItem value="center" label="Align center"><Align lines={alignCenter} /></ToggleGroupItem>
          <ToggleGroupItem value="right" label="Align right"><Align lines={alignRight} /></ToggleGroupItem>
        </ToggleGroup>
        <p
          className={cn(
            "min-w-0 flex-1 basis-40 truncate text-[12.5px] text-fg-2",
            align[0] === "center" && "text-center",
            align[0] === "right" && "text-right",
            marks.includes("bold") && "font-semibold text-fg",
            marks.includes("italic") && "italic",
            marks.includes("underline") && "underline underline-offset-2",
            marks.includes("strike") && "line-through",
          )}
        >
          Ship the pricing page
        </p>
      </div>
    </div>
  );
}

// A skeleton of each view, so switching shows what changed without real data.
function Preview({ view }: { view: string }) {
  return (
    <div className="h-[154px] p-3" aria-hidden>
      {view === "list" && (
        <div className="flex flex-col gap-1.5">
          {[72, 58, 80, 46].map((w, i) => (
            <div key={i} className="flex h-7 items-center gap-2 rounded-md bg-fg/[0.03] px-2">
              <span className="size-2.5 rounded-full border border-fg-4" />
              <span className="h-1.5 rounded-full bg-fg-4/70" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )}
      {view === "board" && (
        <div className="grid h-full grid-cols-3 gap-2">
          {[3, 2, 1].map((n, c) => (
            <div key={c} className="flex flex-col gap-1.5 rounded-md bg-fg/[0.03] p-1.5">
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className="h-7 rounded bg-raised shadow-[var(--shadow)] ring-1 ring-line" />
              ))}
            </div>
          ))}
        </div>
      )}
      {view === "calendar" && (
        <div className="grid h-full grid-cols-7 grid-rows-4 gap-1">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className={cn("rounded-[4px] bg-fg/[0.03]", [3, 9, 10, 17, 23].includes(i) && "bg-fg/10")} />
          ))}
        </div>
      )}
    </div>
  );
}
