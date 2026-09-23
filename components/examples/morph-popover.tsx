"use client";
import { MorphPopover, MorphPopoverForm } from "@/components/ui/morph-popover";

const deploys = [
  { id: "dpl_8f2k", branch: "main", message: "Fix rate limit headers", age: "4m", status: "Ready" },
  { id: "dpl_7c1q", branch: "billing-usage", message: "Meter retries separately", age: "38m", status: "Ready" },
  { id: "dpl_6a9x", branch: "main", message: "Bump API client to 4.2", age: "2h", status: "Failed" },
  { id: "dpl_5d3m", branch: "docs-quotas", message: "Document the 429 back-off", age: "5h", status: "Ready" },
];

const send = () => new Promise<void>((r) => setTimeout(r, 900));

// The feedback button every product header has, growing into its own form and
// folding back into a tick when the note is sent.
export default function Demo() {
  return (
    <div className="flex min-h-[400px] w-full max-w-[520px] flex-col">
      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <header className="flex h-12 items-center gap-3 border-b border-line pl-4 pr-2.5">
          <p className="min-w-0 flex-1 truncate text-[13px] text-fg-3">
            Northwind <span className="px-1 text-fg-4">/</span> <span className="text-fg">Deployments</span>
          </p>
          <MorphPopover label="Feedback" successLabel="Thanks" title="Send feedback" align="end" side="bottom">
            <MorphPopoverForm placeholder="Ideas, bugs, or anything that got in your way" fieldLabel="Feedback" onSubmit={send} />
          </MorphPopover>
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-frame text-[10.5px] font-medium text-fg-2">
            RS
          </span>
        </header>
        <ul className="divide-y divide-line">
          {deploys.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={d.status === "Failed" ? "size-1.5 shrink-0 rounded-full bg-danger" : "size-1.5 shrink-0 rounded-full bg-success"} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{d.message}</p>
                <p className="truncate font-mono text-[11px] text-fg-4">
                  {d.branch} · {d.id}
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-fg-3">{d.status}</span>
              <span className="w-8 shrink-0 text-right text-[12px] tabular text-fg-4">{d.age}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
