"use client";
import { CircleCheck, Warning } from "@/lib/icons";
import { Collapsible, CollapsibleList, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";

const checks = [
  { name: "Build", detail: "next build", time: "1m 12s" },
  { name: "Type check", detail: "tsc --noEmit", time: "34s" },
  { name: "Unit tests", detail: "412 passed", time: "48s" },
  { name: "Bundle size", detail: "+1.2 kB on /checkout", time: "9s", warn: true },
  { name: "End-to-end", detail: "chromium, webkit", time: "3m 05s" },
  { name: "Lighthouse", detail: "Performance 98", time: "41s" },
  { name: "Preview deploy", detail: "pr-1482.stealth.app", time: "22s" },
];

export default function Demo() {
  return (
    // Reserve the fully expanded height so the card grows downward instead of re-centring.
    <div className="flex min-h-[350px] w-full max-w-[420px] flex-col">
      <div className="rounded-xl border border-line-2 bg-raised px-4 py-2 shadow-[var(--shadow)]">
        <Collapsible defaultOpen>
          <CollapsibleTrigger hint="1 warning">
            <span className="flex min-w-0 items-center gap-2">
              <CircleCheck className="shrink-0 text-success" />
              <span className="truncate">7 checks passed</span>
            </span>
          </CollapsibleTrigger>
          <CollapsiblePanel contentClassName="pb-1 pl-5">
            <CollapsibleList limit={3}>
              {checks.map((c) => (
                <div key={c.name} className="flex h-9 min-w-0 items-center gap-2.5 border-t border-line text-[13px]">
                  {c.warn ? <Warning size={14} className="ml-px shrink-0 text-warning" /> : <CircleCheck size={14} className="ml-px shrink-0 text-fg-3" />}
                  <span className="shrink-0 text-fg">{c.name}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-fg-3">
                    {c.warn && <span className="sr-only">Warning: </span>}
                    {c.detail}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular text-fg-3">{c.time}</span>
                </div>
              ))}
            </CollapsibleList>
          </CollapsiblePanel>
        </Collapsible>
      </div>
    </div>
  );
}
