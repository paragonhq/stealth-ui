"use client";
import { ArrowUpRight, Refresh } from "@/lib/icons";
import { ExpandableRows, type ExpandableColumn } from "@/components/ui/expandable-rows";

type Step = { name: string; time: string; state: "done" | "failed" | "skipped" };
type Deploy = {
  id: string;
  message: string;
  sha: string;
  branch: string;
  author: string;
  status: "Ready" | "Failed" | "Building";
  duration: string;
  steps: Step[];
  error?: string;
};

const deploys: Deploy[] = [
  {
    id: "d1",
    message: "Cache invoice PDFs at the edge",
    sha: "8f3a2c1",
    branch: "main",
    author: "Priya Raman",
    status: "Ready",
    duration: "2m 14s",
    steps: [
      { name: "Install dependencies", time: "18s", state: "done" },
      { name: "Build", time: "1m 42s", state: "done" },
      { name: "Run checks", time: "11s", state: "done" },
      { name: "Upload to edge", time: "3s", state: "done" },
    ],
  },
  {
    id: "d2",
    message: "Move billing webhooks to the new queue and retry failed events with backoff",
    sha: "c41e9d0",
    branch: "billing-queue",
    author: "Marcus Lee",
    status: "Failed",
    duration: "58s",
    steps: [
      { name: "Install dependencies", time: "17s", state: "done" },
      { name: "Build", time: "41s", state: "failed" },
      { name: "Run checks", time: "—", state: "skipped" },
      { name: "Upload to edge", time: "—", state: "skipped" },
    ],
    error: "Type error in src/billing/queue.ts:42: Property 'retryAt' does not exist on type 'Job'.",
  },
  {
    id: "d3",
    message: "Tighten spacing on the settings page",
    sha: "5b07e44",
    branch: "main",
    author: "Ana Duarte",
    status: "Ready",
    duration: "2m 02s",
    steps: [
      { name: "Install dependencies", time: "16s", state: "done" },
      { name: "Build", time: "1m 33s", state: "done" },
      { name: "Run checks", time: "10s", state: "done" },
      { name: "Upload to edge", time: "3s", state: "done" },
    ],
  },
  {
    id: "d4",
    message: "Bump dependencies",
    sha: "e912ab3",
    branch: "renovate/all",
    author: "Tom Becker",
    status: "Ready",
    duration: "2m 21s",
    steps: [
      { name: "Install dependencies", time: "24s", state: "done" },
      { name: "Build", time: "1m 44s", state: "done" },
      { name: "Run checks", time: "10s", state: "done" },
      { name: "Upload to edge", time: "3s", state: "done" },
    ],
  },
];

const tone = { Ready: "text-success", Failed: "text-danger", Building: "text-warning" } as const;

const columns: ExpandableColumn<Deploy>[] = [
  {
    key: "message",
    header: "Deployment",
    className: "max-w-0",
    cell: (d) => (
      <span className="flex min-w-0 items-baseline gap-2">
        <span title={d.message} className="truncate">
          {d.message}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-fg-4">{d.sha}</span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: 92,
    cell: (d) => (
      <span className={`flex items-center gap-1.5 text-[12.5px] ${tone[d.status]}`}>
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {d.status}
      </span>
    ),
  },
  { key: "duration", header: "Duration", width: 84, numeric: true, cell: (d) => <span className="text-fg-2">{d.duration}</span> },
];

// Defined outside render so the table can reuse the panels it already built.
const renderDetail = (d: Deploy) => (
  <div className="flex flex-col gap-3">
    <p className="text-[12px] text-fg-3">
      <span className="text-fg-2">{d.author}</span> pushed to <span className="font-mono text-[11.5px] text-fg-2">{d.branch}</span>
    </p>
    <ol className="flex flex-col gap-1.5">
      {d.steps.map((s) => (
        <li key={s.name} className="flex items-center gap-2.5 text-[12.5px]">
          <StepMark state={s.state} />
          <span className={s.state === "skipped" ? "text-fg-4" : s.state === "failed" ? "text-danger" : "text-fg-2"}>{s.name}</span>
          <span aria-hidden className="mx-1 h-px min-w-4 flex-1 bg-line" />
          <span className="text-fg-3 tabular">{s.time}</span>
        </li>
      ))}
    </ol>
    {d.error && (
      <p className="rounded-md border border-line bg-danger-soft px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-danger">{d.error}</p>
    )}
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
      >
        <Refresh size={14} />
        Redeploy
      </button>
      <a
        href="#logs"
        onClick={(e) => e.preventDefault()}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-2 outline-none transition-[background-color,color] duration-150 hover:bg-fg/5 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
      >
        View logs
        <ArrowUpRight size={14} />
      </a>
    </div>
  </div>
);

function StepMark({ state }: { state: Step["state"] }) {
  if (state === "done")
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Done" className="shrink-0 text-success">
        <circle cx="8" cy="8" r="5.75" />
        <path d="m5.5 8.25 1.75 1.75 3.25-3.75" />
      </svg>
    );
  if (state === "failed")
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-label="Failed" className="shrink-0 text-danger">
        <circle cx="8" cy="8" r="5.75" />
        <path d="m6 6 4 4M10 6l-4 4" />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2.2" aria-label="Skipped" className="shrink-0 text-fg-4">
      <circle cx="8" cy="8" r="5.75" />
    </svg>
  );
}

export default function Demo() {
  return (
    <div className="flex w-full max-w-[540px] flex-col gap-2.5">
      <h3 className="px-1 text-[14px] font-medium tracking-[-0.015em] text-fg">Deployments</h3>
      <ExpandableRows
        caption="Deployments"
        columns={columns}
        rows={deploys}
        getRowId={(d) => d.id}
        getRowLabel={(d) => d.message}
        renderDetail={renderDetail}
        defaultExpanded={["d2"]}
        minWidth={420}
        className="max-h-[420px]"
      />
    </div>
  );
}
