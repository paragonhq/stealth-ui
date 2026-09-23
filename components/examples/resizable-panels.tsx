"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { File, Folder, Sidebar, Terminal } from "@/lib/icons";
import { Panel, PanelGroup, PanelHandle } from "@/components/ui/resizable-panels";

const files = ["forecast.ts", "revenue.ts", "churn.ts", "q3-forecast.xlsx", "README.md"];
const code = [
  ["import", " { sum } ", "from", " \"./math\";"],
  ["", "", "", ""],
  ["export function", " forecast(", "months", ": number[]) {"],
  ["  const", " base = sum(months) / months.length;", "", ""],
  ["  return", " months.map((m, i) => base * (1 + i * 0.04));", "", ""],
  ["}", "", "", ""],
];

// An editor: files on the left, code over a terminal on the right. Drag any line, double-click
// one to fold the panel beside it, or use the buttons, which drive the same collapse.
export default function Demo() {
  const [filesOpen, setFilesOpen] = useState(true);
  const [termOpen, setTermOpen] = useState(true);
  const [layout, setLayout] = useState<number[]>([28, 72]);

  const toggleClass =
    "grid size-7 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.92] aria-pressed:text-fg";

  return (
    <div className="flex h-[380px] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
        <button type="button" aria-pressed={filesOpen} aria-label="Show files" className={toggleClass} onClick={() => setFilesOpen((o) => !o)}>
          <Sidebar size={15} />
        </button>
        <span className="min-w-0 flex-1 truncate px-1 text-[12.5px] text-fg-2">forecast.ts</span>
        <span className="hidden font-mono text-2xs text-fg-4 tabular sm:block">{layout[0] > 0.5 ? `Files ${Math.round(layout[0])}%` : "Files hidden"}</span>
        <button type="button" aria-pressed={termOpen} aria-label="Show terminal" className={toggleClass} onClick={() => setTermOpen((o) => !o)}>
          <Terminal size={15} />
        </button>
      </div>

      <PanelGroup direction="horizontal" className="flex-1" onLayout={setLayout}>
        <Panel id="files" defaultSize={28} minSize={20} maxSize={45} collapsible collapsed={!filesOpen} onCollapsedChange={(c) => setFilesOpen(!c)}>
          <div className="flex h-full flex-col gap-px p-1.5">
            <p className="flex h-7 items-center gap-1.5 px-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">
              <Folder size={12} /> src
            </p>
            {files.map((f, i) => (
              <p key={f} className={cn("flex h-7 items-center gap-2 truncate rounded-md px-2 text-[12.5px]", i === 0 ? "bg-hover text-fg" : "text-fg-2")}>
                <File size={13} className="shrink-0 text-fg-4" />
                <span className="truncate">{f}</span>
              </p>
            ))}
          </div>
        </Panel>
        <PanelHandle aria-label="Resize files" />
        <Panel id="work" minSize={40}>
          <PanelGroup direction="vertical">
            <Panel id="editor" minSize={25}>
              <pre className="h-full overflow-auto p-3 font-mono text-[11.5px] leading-[20px] text-fg-2">
                {code.map((l, i) => (
                  <div key={i} className="flex gap-3 whitespace-pre">
                    <span className="w-4 shrink-0 select-none text-right text-fg-4 tabular">{i + 1}</span>
                    <span>
                      <span className="text-fg">{l[0]}</span>
                      {l[1]}
                      <span className="text-fg">{l[2]}</span>
                      {l[3]}
                    </span>
                  </div>
                ))}
              </pre>
            </Panel>
            <PanelHandle aria-label="Resize terminal" />
            <Panel id="terminal" defaultSize={36} minSize={22} maxSize={70} collapsible collapsed={!termOpen} onCollapsedChange={(c) => setTermOpen(!c)}>
              <div className="h-full overflow-auto whitespace-pre bg-page/60 p-3 font-mono text-[11.5px] leading-[19px]">
                <p className="text-fg-2"><span className="text-fg-4">$</span> npm test forecast</p>
                <p className="text-success">✓ projects 12 months (4 ms)</p>
                <p className="text-success">✓ handles an empty year (1 ms)</p>
                <p className="text-fg-3">Tests: 2 passed, 2 total</p>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
