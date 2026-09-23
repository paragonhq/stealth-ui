"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion";
import { ColumnManager, useColumnManager, type ColumnItem } from "@/components/ui/column-manager";

type Deploy = { project: string; status: "Ready" | "Building" | "Failed"; branch: string; commit: string; duration: string; author: string; region: string; created: string };

const rows: Deploy[] = [
  { project: "checkout-web", status: "Ready", branch: "main", commit: "a41f9c2", duration: "1m 12s", author: "Maya Lin", region: "fra1", created: "4m ago" },
  { project: "billing-api", status: "Building", branch: "feat/tax-rules", commit: "7be03d1", duration: "0m 48s", author: "Theo Park", region: "iad1", created: "9m ago" },
  { project: "docs", status: "Ready", branch: "main", commit: "e19c77a", duration: "0m 39s", author: "Ana Souza", region: "sfo1", created: "22m ago" },
  { project: "marketing-site", status: "Failed", branch: "fix/hero-copy", commit: "03fa8b4", duration: "2m 03s", author: "Jonas Weber", region: "fra1", created: "1h ago" },
  { project: "admin-console", status: "Ready", branch: "release/2.14", commit: "c5d2e90", duration: "1m 31s", author: "Priya Raman", region: "hnd1", created: "3h ago" },
];

type Col = ColumnItem & { id: keyof Deploy; width: string; align?: "end"; mono?: boolean };

const initial: Col[] = [
  { id: "project", label: "Project", locked: true, width: "minmax(132px,1.5fr)" },
  { id: "status", label: "Status", width: "96px" },
  { id: "branch", label: "Branch", width: "minmax(112px,1fr)", mono: true },
  { id: "commit", label: "Commit", width: "76px", mono: true, visible: false },
  { id: "author", label: "Author", width: "minmax(104px,1fr)", visible: false },
  { id: "duration", label: "Duration", width: "76px", align: "end" },
  { id: "region", label: "Region", width: "64px", mono: true, visible: false },
  { id: "created", label: "Created", width: "84px", align: "end" },
];

const tone = { Ready: "bg-success", Building: "bg-warning", Failed: "bg-danger" } as const;

export default function Demo() {
  const { columns, setColumns, visible } = useColumnManager(initial);
  const reduce = useReducedMotion();
  const template = visible.map((c) => c.width).join(" ");

  // Cells glide to their new column on the soft spring; a column that arrives fades in
  // once the others have made room, and one that leaves lifts out of the grid at once.
  const cell = {
    layout: "position" as const,
    transition: reduce ? { duration: 0 } : spring.soft,
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2, delay: reduce ? 0 : 0.08 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  return (
    <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      {/* The trigger sits at the start so its popover opens over the pinned column and the changes stay in view. */}
      <div className="flex h-11 items-center justify-between gap-3 border-b border-line pl-2 pr-4">
        <ColumnManager value={columns} onValueChange={(next) => setColumns(next as Col[])} size="sm" align="start" searchThreshold={8} />
        <p className="truncate text-[12px] text-fg-3">
          <span className="text-fg-2">Deployments</span> · production, last 24 hours
        </p>
      </div>

      <motion.div layoutScroll className="overflow-x-auto overscroll-x-contain">
        <div role="table" aria-label="Deployments" aria-rowcount={rows.length + 1} className="min-w-max">
          <div role="row" className="relative grid h-9 items-center border-b border-line" style={{ gridTemplateColumns: template }}>
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((c) => (
                <motion.div
                  key={c.id}
                  role="columnheader"
                  {...cell}
                  className={`truncate px-3 text-[12px] text-fg-3 first:pl-4 ${c.align === "end" ? "text-right last:pr-4" : ""}`}
                >
                  {c.label}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {rows.map((r) => (
            <div key={r.project} role="row" className="relative grid h-10 items-center border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-hover" style={{ gridTemplateColumns: template }}>
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((c) => (
                  <motion.div
                    key={c.id}
                    role="cell"
                    {...cell}
                    className={`min-w-0 truncate px-3 first:pl-4 ${c.align === "end" ? "text-right tabular last:pr-4" : ""} ${c.mono ? "font-mono text-[12px] text-fg-2" : "text-[13px]"} ${c.id === "project" ? "font-medium text-fg" : c.mono ? "" : "text-fg-2"}`}
                  >
                    {c.id === "status" ? (
                      <span className="inline-flex items-center gap-1.5 text-fg">
                        <span aria-hidden className={`size-1.5 rounded-full ${tone[r.status]}`} />
                        {r.status}
                      </span>
                    ) : (
                      r[c.id]
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
