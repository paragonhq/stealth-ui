"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, File, Paperclip } from "@/lib/icons";
import { ContextMeter, type ContextSegment } from "@/components/ui/context-meter";

const LIMIT = 200_000;
const start = { system: 6_200, messages: 58_400, files: 0 };

// A conversation filling its window. Attach the spreadsheet and send a couple of messages to cross 80%.
export default function Demo() {
  const [t, setT] = useState(start);
  const [compacting, setCompacting] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const segments: ContextSegment[] = [
    { id: "system", label: "System and tools", tokens: t.system },
    { id: "messages", label: "Messages", tokens: t.messages },
    { id: "files", label: "Files", tokens: t.files },
  ];

  const button =
    "inline-flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium text-fg-2 shadow-[var(--shadow)] outline-none transition-[background-color,border-color,color,scale] duration-150 hover:border-fg-4 hover:bg-hover hover:text-fg active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-4">
      <div className="flex h-9 items-center justify-between gap-3 border-b border-line px-1">
        <span className="min-w-0 truncate text-[13px] font-medium text-fg">Q3 planning with finance</span>
        <ContextMeter variant="bar" segments={segments} limit={LIMIT} side="bottom" />
      </div>

      <div className="rounded-2xl border border-line-2 bg-raised p-2 shadow-[var(--shadow)]">
        {t.files > 0 && (
          <div className="mb-1 flex w-fit items-center gap-2 rounded-lg border border-line bg-frame px-2 py-1.5 text-[12px]">
            <File size={14} className="text-fg-3" />
            <span className="text-fg">q3-forecast.xlsx</span>
            <span className="tabular text-fg-4">41K tokens</span>
          </div>
        )}
        <p className="px-1.5 pb-3 pt-1 text-[13.5px] text-fg-4">Reply to Dana…</p>
        <div className="flex items-center gap-1">
          <span className="grid size-7 place-items-center text-fg-3">
            <Paperclip />
          </span>
          <ContextMeter
            segments={segments}
            limit={LIMIT}
            className="ms-auto"
            compacting={compacting}
            onCompact={() => {
              setCompacting(true);
              timer.current = window.setTimeout(() => {
                setT((x) => ({ ...x, messages: Math.round(x.messages * 0.3) }));
                setCompacting(false);
              }, 1400);
            }}
          />
          <span className="grid size-7 place-items-center rounded-full bg-fg text-frame">
            <ArrowUp size={14} />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={t.files > 0} onClick={() => setT((x) => ({ ...x, files: 41_300 }))}>
          <Paperclip size={14} /> Attach q3-forecast.xlsx
        </button>
        <button type="button" className={button} disabled={t.messages > 150_000} onClick={() => setT((x) => ({ ...x, messages: x.messages + 32_000 }))}>
          Send a long message
        </button>
        <button type="button" className={`${button} border-transparent bg-transparent shadow-none`} onClick={() => setT(start)}>
          Reset
        </button>
      </div>
    </div>
  );
}
