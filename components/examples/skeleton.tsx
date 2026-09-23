"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Skeleton, SkeletonCard, SkeletonRow, SkeletonTable } from "@/components/ui/skeleton";

type View = "list" | "card" | "table";
type Anim = "shimmer" | "pulse" | "static";

const members = [
  { initials: "MO", name: "Maya Okafor", email: "maya@northwind.dev", role: "Owner" },
  { initials: "JR", name: "Jonas Richter", email: "jonas.richter@northwind.dev", role: "Admin" },
  { initials: "AP", name: "Aiko Park", email: "aiko@northwind.dev", role: "Member" },
];
const invoices = [
  { id: "INV-2041", customer: "Lumen Health", amount: "$4,820" },
  { id: "INV-2040", customer: "Parcel & Co", amount: "$1,200" },
  { id: "INV-2039", customer: "Harbor Analytics", amount: "$12,450" },
  { id: "INV-2038", customer: "Odd Fellows Studio", amount: "$760" },
];
const cols = { gridTemplateColumns: "minmax(0,1.6fr) repeat(2, minmax(0,1fr))" };

// Each skeleton is the exact shape of what replaces it. Switch views or reload
// to watch the swap: nothing on the page moves when the data lands.
export default function Demo() {
  const [view, setView] = useState<View>("list");
  const [anim, setAnim] = useState<Anim>("shimmer");
  const [loading, setLoading] = useState(true);
  const timer = useRef<number>(undefined);
  const reduce = useReducedMotion();

  const load = (ms: number) => {
    window.clearTimeout(timer.current);
    setLoading(true);
    timer.current = window.setTimeout(() => setLoading(false), ms);
  };
  useEffect(() => {
    timer.current = window.setTimeout(() => setLoading(false), 2400);
    return () => window.clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Segmented
          label="View"
          value={view}
          options={[["list", "Members"], ["card", "Project"], ["table", "Invoices"]]}
          onChange={(v) => { setView(v); load(1600); }}
        />
        <button
          type="button"
          onClick={() => load(1800)}
          className="h-7 shrink-0 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
        >
          Reload
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        {loading ? (
          view === "list" ? (
            <SkeletonRow key={anim} animation={anim} label="Loading members" count={3} className="px-4 py-1.5" />
          ) : view === "card" ? (
            <SkeletonCard key={anim} animation={anim} label="Loading project" media={2.4} className="rounded-none border-0" />
          ) : (
            <Skeleton key={anim} animation={anim} label="Loading invoices">
              <TableHead />
              <SkeletonTable header={false} rows={4} columns={3} />
            </Skeleton>
          )
        ) : (
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0.15 : 0.2 }}
          >
            {view === "list" && <MemberList />}
            {view === "card" && <ProjectCard />}
            {view === "table" && <InvoiceTable />}
          </motion.div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-fg-3">While loading</p>
        <Segmented label="Animation" value={anim} options={[["shimmer", "Shimmer"], ["pulse", "Pulse"], ["static", "Static"]]} onChange={setAnim} />
      </div>
    </div>
  );
}

function MemberList() {
  return (
    <ul className="flex flex-col px-4 py-1.5" aria-label="Members">
      {members.map((m) => (
        <li key={m.email} className="flex items-center gap-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2 text-[11px] font-medium text-fg-2">{m.initials}</span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] leading-[18px] text-fg">{m.name}</span>
            <span className="truncate text-[12px] leading-[18px] text-fg-3">{m.email}</span>
          </div>
          <span className="shrink-0 text-[12px] leading-[18px] text-fg-3">{m.role}</span>
        </li>
      ))}
    </ul>
  );
}

function ProjectCard() {
  return (
    <article className="flex flex-col">
      <div className="relative aspect-[2.4] bg-frame">
        <svg viewBox="0 0 320 180" preserveAspectRatio="none" className="absolute inset-0 size-full text-fg-3" aria-hidden>
          <path d="M0 140 C40 132 60 110 96 116 S150 84 186 90 250 48 320 40 V180 H0Z" fill="currentColor" opacity="0.1" />
          <path d="M0 140 C40 132 60 110 96 116 S150 84 186 90 250 48 320 40" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="text-[15px] font-medium leading-[20px] tracking-[-0.015em] text-fg">Q3 revenue forecast</h3>
        <p className="line-clamp-2 text-[13px] leading-[19px] text-fg-2">
          Bookings are tracking 12% ahead of plan. Enterprise renewals land in the last two weeks of September.
        </p>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-line-2 text-[9px] font-medium text-fg-2">MO</span>
        <span className="min-w-0 flex-1 truncate text-[12px] leading-[18px] text-fg-3">Maya Okafor · 2h ago</span>
        <button type="button" className="h-7 w-16 rounded-md border border-line-2 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]">
          Open
        </button>
      </div>
    </article>
  );
}

function TableHead() {
  return (
    <div className="grid h-9 items-center gap-4 border-b border-line px-3 font-mono text-[10.5px] uppercase leading-[14px] tracking-[0.08em] text-fg-3" style={cols}>
      <span>Customer</span>
      <span>Invoice</span>
      <span className="text-right">Amount</span>
    </div>
  );
}

function InvoiceTable() {
  return (
    <div role="table" aria-label="Invoices">
      <div role="rowgroup"><TableHead /></div>
      <div role="rowgroup">
        {invoices.map((inv) => (
          <div key={inv.id} role="row" className="grid h-9 items-center gap-4 border-b border-line px-3 text-[13px] leading-[18px] last:border-b-0" style={cols}>
            <span role="cell" className="truncate text-fg">{inv.customer}</span>
            <span role="cell" className="truncate font-mono text-[12px] text-fg-2">{inv.id}</span>
            <span role="cell" className="tabular text-right text-fg">{inv.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex h-7 items-center rounded-md border border-line bg-frame p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className="relative h-full rounded-[5px] px-2 text-[12px] text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg aria-pressed:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          {value === v && <motion.span layoutId={`seg-${label}`} transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.7 }} className="absolute inset-0 rounded-[5px] bg-raised shadow-[var(--shadow)] ring-1 ring-line-2" />}
          <span className="relative">{text}</span>
        </button>
      ))}
    </div>
  );
}
