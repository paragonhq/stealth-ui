"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { Calendar, CreditCard, Globe, Refresh, Tag } from "@/lib/icons";
import { ActiveFilters, type ActiveFilter } from "@/components/ui/active-filters";

const initial: ActiveFilter[] = [
  { id: "status", field: "Status", value: ["Paid", "Partially refunded"], icon: <CreditCard /> },
  { id: "country", field: "Country", value: "Germany", icon: <Globe /> },
  { id: "date", field: "Created", operator: "in", value: "Last 30 days", icon: <Calendar /> },
  { id: "total", field: "Total", operator: "over", value: "€500" },
  { id: "channel", field: "Channel", operator: "is any of", value: ["Online store", "POS", "Marketplace"] },
  { id: "tag", field: "Tag", value: "wholesale", icon: <Tag /> },
];

// Stand-in for a real query: each filter narrows the orders by a fixed share.
const share: Record<string, number> = { status: 0.62, country: 0.34, date: 0.41, total: 0.28, channel: 0.8, tag: 0.55 };

export default function Demo() {
  const [filters, setFilters] = useState(initial);
  const [edited, setEdited] = useState<string | null>(null);
  const count = Math.round(filters.reduce((n, f) => n * (share[f.id] ?? 1), 12480));
  const changed = filters.length !== initial.length;

  return (
    <div className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-line px-3">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Orders</span>
        <span className="text-[12px] text-fg-3 tabular">
          <NumberFlow value={count} className="text-fg" /> {count === 1 ? "order" : "orders"}
        </span>
      </div>

      <div className="border-b border-line px-3 py-2.5">
        <ActiveFilters value={filters} onValueChange={setFilters} onEdit={(f) => setEdited(f.field)} />
      </div>

      <div className="flex h-9 items-center justify-between gap-3 px-3 text-[12px] text-fg-3">
        <span className="min-w-0 truncate">
          {edited ? (
            <>
              Would open the <span className="text-fg-2">{edited}</span> editor
            </>
          ) : (
            <>
              <kbd className="rounded border border-line-2 px-1 font-mono text-[10.5px] text-fg-2">⌫</kbd> removes the focused filter
            </>
          )}
        </span>
        <button
          type="button"
          disabled={!changed}
          onClick={() => {
            setFilters(initial);
            setEdited(null);
          }}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 font-medium text-fg-2 outline-none transition-[background-color,color,scale,opacity] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-0"
        >
          <Refresh size={12} />
          Reset demo
        </button>
      </div>
    </div>
  );
}
