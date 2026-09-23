"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { FlipItem, FlipList } from "@/components/ui/flip-list";

type Priority = 0 | 1 | 2 | 3; // urgent → low
type Issue = { id: string; title: string; priority: Priority; who: string; initials: string; due: string; updated: number };

const ME = "Maya Chen";
const issues: Issue[] = [
  { id: "CHK-212", title: "Apple Pay button misaligned on Safari 17", priority: 0, who: ME, initials: "MC", due: "2026-09-30", updated: 190 },
  { id: "CHK-208", title: "Retry failed card charges once before emailing", priority: 1, who: "Tomás Ruiz", initials: "TR", due: "2026-10-06", updated: 2900 },
  { id: "CHK-199", title: "Show the VAT line on EU invoices", priority: 1, who: ME, initials: "MC", due: "2026-09-26", updated: 25 },
  { id: "CHK-215", title: "Coupon field accepts expired codes", priority: 0, who: "Priya Nair", initials: "PN", due: "2026-09-24", updated: 12 },
  { id: "CHK-187", title: "Keep the cart across devices for signed-in customers", priority: 2, who: ME, initials: "MC", due: "2026-10-02", updated: 300 },
  { id: "CHK-176", title: "Copy review for the order confirmation email", priority: 3, who: "Sam Okafor", initials: "SO", due: "2026-09-29", updated: 1480 },
  { id: "CHK-203", title: "Currency switcher forgets the choice on refresh", priority: 2, who: "Tomás Ruiz", initials: "TR", due: "2026-09-25", updated: 64 },
];

const sorts = {
  priority: { label: "Priority", fn: (a: Issue, b: Issue) => a.priority - b.priority || a.due.localeCompare(b.due) },
  due: { label: "Due", fn: (a: Issue, b: Issue) => a.due.localeCompare(b.due) || a.priority - b.priority },
  updated: { label: "Updated", fn: (a: Issue, b: Issue) => a.updated - b.updated },
};
type SortKey = keyof typeof sorts;

const priorityName = ["Urgent", "High", "Medium", "Low"];
// Fixed locale and zone so the server and the browser print the same date.
const dueFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const focus = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

// A sprint's checkout issues. Sort, narrow to your own, or mark one done: every row
// glides to its new place, and Undo puts a finished issue back where it belongs.
export default function Demo() {
  const [open, setOpen] = useState(issues);
  const [sort, setSort] = useState<SortKey>("priority");
  const [mine, setMine] = useState(false);
  const [lastDone, setLastDone] = useState<Issue | null>(null);
  const reduce = useReducedMotion();
  const list = useRef<HTMLUListElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lastDone) return;
    const t = window.setTimeout(() => setLastDone(null), 6000);
    return () => window.clearTimeout(t);
  }, [lastDone]);

  const shown = open.filter((i) => !mine || i.who === ME).sort(sorts[sort].fn);
  const done = (issue: Issue, e: React.MouseEvent<HTMLButtonElement>) => {
    // A keyboard user's focus would vanish with the row: hand it to the next row, or to Undo.
    const hadFocus = e.currentTarget === document.activeElement && e.detail === 0;
    const at = shown.findIndex((i) => i.id === issue.id);
    const next = shown[at + 1] ?? shown[at - 1];
    setOpen((all) => all.filter((i) => i.id !== issue.id));
    setLastDone(issue);
    if (!hadFocus) return;
    requestAnimationFrame(() => {
      const target = next && list.current?.querySelector<HTMLButtonElement>(`[data-issue="${next.id}"]`);
      (target ?? undoButton.current)?.focus();
    });
  };
  const undo = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!lastDone) return;
    const restored = lastDone.id;
    setOpen((all) => [...all, lastDone]);
    setLastDone(null);
    // Undo leaves with its message; a keyboard user lands on the row that came back.
    if (e.detail !== 0) return;
    requestAnimationFrame(() => {
      const rows = list.current;
      (rows?.querySelector<HTMLButtonElement>(`[data-issue="${restored}"]`) ?? rows?.querySelector<HTMLButtonElement>("[data-issue]"))?.focus();
    });
  };

  const fade = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: 0.12 } },
    transition: { duration: 0.2, ease: ease.out },
  };

  return (
    <div className="w-full max-w-[480px] overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5">
        <div className="mr-auto min-w-0">
          <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Checkout · Sprint 24</p>
        </div>
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => setMine((m) => !m)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
            mine ? "border-fg-3 bg-hover text-fg" : "border-line-2 text-fg-2 hover:border-fg-4 hover:text-fg",
            focus,
          )}
        >
          <span className={cn("grid size-3 place-items-center rounded-[3px] border transition-colors duration-150", mine ? "border-fg bg-fg text-frame" : "border-fg-4")}>
            {mine && <Check size={10} strokeWidth={2} />}
          </span>
          Assigned to me
        </button>
        <div role="group" aria-label="Sort issues by" className="flex h-7 rounded-md border border-line-2 p-0.5">
          {(Object.keys(sorts) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={sort === k}
              onClick={() => setSort(k)}
              className={cn(
                "rounded-[4px] px-2 text-[12px] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                sort === k ? "bg-hover text-fg" : "text-fg-3 hover:text-fg-2",
              )}
            >
              {sorts[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tall enough for every row, so the panel never jumps as rows leave and return. */}
      <div className="relative min-h-[296px] py-1 max-sm:min-h-[344px]">
        <FlipList ref={list} aria-label="Open issues">
          {shown.map((issue) => (
            <FlipItem key={issue.id} className="flex min-h-10 items-center gap-2.5 py-1.5 pl-2 pr-3 sm:h-10 sm:py-0">
              <button
                type="button"
                aria-label={`Mark ${issue.id} done`}
                data-issue={issue.id}
                onClick={(e) => done(issue, e)}
                className={cn(
                  "group/done relative grid size-6 shrink-0 place-items-center rounded-full text-fg-4 transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.9] active:duration-75",
                  "pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5",
                  focus,
                )}
              >
                <span className="grid size-3.5 place-items-center rounded-full border border-current">
                  <Check size={9} strokeWidth={2.2} className="opacity-0 transition-opacity duration-150 group-hover/done:opacity-100 group-focus-visible/done:opacity-100" />
                </span>
              </button>
              <PriorityIcon level={issue.priority} />
              <span className="w-[58px] shrink-0 max-sm:hidden font-mono text-[11px] text-fg-4">{issue.id}</span>
              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-[1.35] text-fg sm:truncate">{issue.title}</span>
              <span
                title={issue.who}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-medium",
                  issue.who === ME ? "border-fg-3 bg-hover text-fg" : "border-line-2 text-fg-3",
                )}
              >
                <span className="sr-only">Assigned to {issue.who}</span>
                <span aria-hidden>{issue.initials}</span>
              </span>
              <span className="tabular w-11 shrink-0 text-right text-[12px] text-fg-3">
                <span className="sr-only">Due </span>
                {dueFormat.format(new Date(issue.due))}
              </span>
            </FlipItem>
          ))}
        </FlipList>

        <AnimatePresence>
          {shown.length === 0 && (
            <motion.div key="empty" {...fade} className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-center">
              <p className="text-[13px] text-fg-2">{mine ? "Nothing left assigned to you" : "Every issue in this sprint is done"}</p>
              {mine && (
                <button
                  type="button"
                  onClick={() => setMine(false)}
                  className={cn("h-7 rounded-md border border-line-2 px-2.5 text-[12px] font-medium text-fg transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75", focus)}
                >
                  Show all issues
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex h-10 items-center gap-3 border-t border-line px-3 text-[12px] text-fg-3">
        <span className="tabular mr-auto">
          {shown.length ? `${shown.length} open` : "None open"}
          {mine ? " · yours" : ""}
        </span>
        <div className="relative flex min-w-0 items-center" role="status" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            {lastDone && (
              <motion.span key={lastDone.id} {...fade} className="flex min-w-0 items-center gap-2">
                <span className="truncate">{lastDone.id} marked done</span>
                <button
                  ref={undoButton}
                  type="button"
                  onClick={undo}
                  className={cn("-my-1 h-6 shrink-0 rounded-md px-1.5 font-medium text-fg transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.97] active:duration-75", focus)}
                >
                  Undo
                </button>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PriorityIcon({ level }: { level: Priority }) {
  return (
    <span className="shrink-0" title={priorityName[level]}>
      <span className="sr-only">{priorityName[level]} priority</span>
      {level === 0 ? (
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" className="text-danger">
          <rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor" opacity="0.16" />
          <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.9" fill="currentColor" />
        </svg>
      ) : (
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16">
          {[0, 1, 2].map((b) => (
            <rect
              key={b}
              x={3 + b * 4}
              y={11 - b * 3}
              width="2.5"
              height={3 + b * 3}
              rx="0.75"
              className={b < 4 - level ? "fill-fg-2" : "fill-fg-4/50"}
            />
          ))}
        </svg>
      )}
    </span>
  );
}
