"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { X } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { FacetedFilter, type FacetOption } from "@/components/ui/faceted-filter";

type Issue = { id: string; title: string; status: string; priority: string; assignee: string };
type Facet = "status" | "priority" | "assignee";

const statuses = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "progress", label: "In progress" },
  { value: "review", label: "In review" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
];
const priorities = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No priority" },
];
const people = [
  { value: "maya", label: "Maya Chen" },
  { value: "jonas", label: "Jonas Weber" },
  { value: "priya", label: "Priya Raman" },
  { value: "tomas", label: "Tomás Ferreira" },
  { value: "aiko", label: "Aiko Tanaka" },
  { value: "sam", label: "Sam Okafor" },
  { value: "none", label: "Unassigned" },
];
const titles = [
  "Retry webhook deliveries with backoff",
  "Invoice PDF misaligns totals in Safari",
  "Add SSO enforcement to workspace settings",
  "Migrate billing events to the new queue",
  "Empty state for the audit log",
  "Rate limit the export endpoint",
  "Keyboard shortcut to archive a thread",
  "Flaky test in checkout.spec.ts",
  "Timezone drift in scheduled reports",
  "Dark mode contrast on status badges",
  "Paginate the members API",
  "Deprecate v1 upload URLs",
];

// Deterministic, so server and client render the same 48 issues.
const issues: Issue[] = Array.from({ length: 48 }, (_, i) => {
  const r = (n: number, salt: number) => ((i + 3) * 2654435761 + salt * 40503) % 4294967296 % n;
  return {
    id: `ENG-${1180 + i}`,
    title: titles[i % titles.length],
    status: statuses[[0, 1, 1, 2, 2, 3, 4, 4, 4, 5][r(10, 1)]].value,
    priority: priorities[[0, 1, 1, 2, 2, 2, 3, 3, 4][r(9, 2)]].value,
    assignee: people[r(7, 3)].value,
  };
});

const matches = (issue: Issue, filters: Record<Facet, string[]>, skip?: Facet) =>
  (Object.keys(filters) as Facet[]).every((f) => f === skip || !filters[f].length || filters[f].includes(issue[f]));

export default function Demo() {
  const reduce = useReducedMotion();
  const [filters, setFilters] = useState<Record<Facet, string[]>>({ status: ["progress", "review"], priority: [], assignee: [] });
  const set = (facet: Facet) => (next: string[]) => setFilters((f) => ({ ...f, [facet]: next }));
  const results = useMemo(() => issues.filter((i) => matches(i, filters)), [filters]);
  const any = Object.values(filters).some((v) => v.length);

  // Each facet counts against the *other* active filters, so its numbers say what ticking it would give you.
  const withCounts = (facet: Facet, list: { value: string; label: string }[], icon: (v: string) => React.ReactNode): FacetOption[] =>
    list.map((o) => ({ ...o, icon: icon(o.value), count: issues.filter((i) => i[facet] === o.value && matches(i, filters, facet)).length }));

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FacetedFilter title="Status" noun="statuses" options={withCounts("status", statuses, (v) => <StatusIcon status={v} />)} value={filters.status} onValueChange={set("status")} />
        <FacetedFilter title="Priority" noun="priorities" options={withCounts("priority", priorities, (v) => <PriorityIcon priority={v} />)} value={filters.priority} onValueChange={set("priority")} />
        <FacetedFilter title="Assignee" noun="people" maxChips={1} options={withCounts("assignee", people, (v) => <Initials id={v} />)} value={filters.assignee} onValueChange={set("assignee")} />
        <AnimatePresence initial={false}>
          {any && (
            <motion.button
              type="button"
              onClick={() => setFilters({ status: [], priority: [], assignee: [] })}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduce ? { duration: 0.12 } : spring.snappy}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Reset
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* When the toolbar wraps to a second line, the list glides down instead of jumping. */}
      <motion.div layout={!reduce} transition={spring.soft} className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-9 items-center justify-between border-b border-line px-3 text-[12px] text-fg-3">
          <span className="font-medium text-fg-2">Issues</span>
          <span role="status" className="tabular">
            <NumberFlow value={results.length} className="text-fg" /> of {issues.length}
          </span>
        </div>
        <ul className="h-[184px] overflow-y-auto overscroll-contain py-1">
          {results.map((issue) => (
            <li key={issue.id} className="flex h-9 items-center gap-2.5 px-3 text-[13px]">
              <StatusIcon status={issue.status} />
              <span className="w-[3.75rem] shrink-0 font-mono text-[11.5px] text-fg-3">{issue.id}</span>
              <span className="min-w-0 flex-1 truncate text-fg">{issue.title}</span>
              <PriorityIcon priority={issue.priority} />
              <Initials id={issue.assignee} />
            </li>
          ))}
          {results.length === 0 && (
            <li className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] text-fg-2">No issues match these filters</p>
              <button
                type="button"
                onClick={() => setFilters({ status: [], priority: [], assignee: [] })}
                className="h-7 rounded-md border border-line-2 px-2.5 text-[12.5px] font-medium text-fg outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
              >
                Clear filters
              </button>
            </li>
          )}
        </ul>
      </motion.div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const common = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, "aria-hidden": true, className: "shrink-0" } as const;
  if (status === "backlog") return <svg {...common} className="shrink-0 text-fg-3"><circle cx="8" cy="8" r="5.75" strokeDasharray="2 2.2" /></svg>;
  if (status === "todo") return <svg {...common} className="shrink-0 text-fg-2"><circle cx="8" cy="8" r="5.75" /></svg>;
  if (status === "progress" || status === "review") {
    const d = status === "progress" ? "M8 5v6a3 3 0 0 0 0-6z" : "M8 5a3 3 0 1 1-3 3h3z";
    return <svg {...common} className="shrink-0 text-warning"><circle cx="8" cy="8" r="5.75" /><path d={d} fill="currentColor" stroke="none" /></svg>;
  }
  if (status === "done") return <svg {...common} className="shrink-0 text-success"><circle cx="8" cy="8" r="6.25" fill="currentColor" stroke="none" /><path d="m5.5 8.25 1.75 1.75 3.25-3.75" stroke="var(--raised)" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg {...common} className="shrink-0 text-fg-3"><circle cx="8" cy="8" r="5.75" /><path d="m6 6 4 4M10 6l-4 4" strokeLinecap="round" /></svg>;
}

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "urgent")
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-danger">
        <rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor" />
        <path d="M8 5v3.5" stroke="var(--raised)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.9" fill="var(--raised)" />
      </svg>
    );
  if (priority === "none")
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-fg-4">
        <path d="M3 8h2M7 8h2M11 8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  const level = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      {[0, 1, 2].map((b) => (
        <rect key={b} x={3 + b * 4} y={10 - b * 3} width="2.25" height={3.5 + b * 3} rx="0.75" fill="currentColor" className={b < level ? "text-fg-2" : "text-line-2"} />
      ))}
    </svg>
  );
}

function Initials({ id }: { id: string }) {
  const person = people.find((p) => p.value === id);
  if (!person || id === "none")
    return <span aria-hidden className="size-4 shrink-0 rounded-full border border-dashed border-fg-4" />;
  const letters = person.label.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-full bg-line-2 text-[7.5px] font-medium tracking-[0.02em] text-fg-2">
      {letters}
    </span>
  );
}
