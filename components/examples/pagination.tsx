"use client";
import { useState } from "react";
import { Pagination } from "@/components/ui/pagination";

const customers = ["Northwind Labs", "Halcyon Health", "Pioneer Freight", "Oakline Studio", "Ferro & Sons", "Brightwater Co.", "Marlow Analytics", "Quill Legal"];
const statuses = ["Paid", "Paid", "Open", "Paid", "Overdue", "Paid", "Draft"] as const;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// A real table footer: rows change with the page, the summary rolls, the size select keeps your place.
export default function Demo() {
  const [page, setPage] = useState(2);
  const [pageSize, setPageSize] = useState(20);
  const total = 312;
  const first = (page - 1) * pageSize;
  const rows = Array.from({ length: Math.min(pageSize, total - first) }, (_, i) => first + i);

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-line bg-frame">
        <div className="flex h-10 items-center justify-between border-b border-line px-3">
          <span className="text-[13px] font-medium tracking-[-0.01em]">Invoices</span>
          <span className="font-mono text-2xs text-fg-4 uppercase tracking-[0.08em]">Q3 2026</span>
        </div>
        <ul className="h-[168px] overflow-y-auto overscroll-contain" aria-label="Invoices on this page">
          {rows.map((i) => {
            const status = statuses[i % statuses.length];
            return (
              <li key={i} className="flex h-8 items-center gap-3 border-b border-line px-3 text-[12.5px] last:border-b-0">
                <span className="w-[4.5rem] shrink-0 font-mono text-[11.5px] text-fg-3">INV-{4001 + i}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{customers[(i * 5) % customers.length]}</span>
                <span className={status === "Overdue" ? "text-danger" : status === "Open" ? "text-fg-2" : "text-fg-3"}>{status}</span>
                <span className="w-20 text-right text-fg tabular">{money.format(180 + ((i * 7919) % 4200))}</span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-3 py-2.5">
          <Pagination
            total={total}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemName="invoices"
            size="sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-frame py-2 pr-2 pl-3">
        <span className="min-w-0 truncate text-[12.5px] text-fg-2">Audit log</span>
        <Pagination variant="compact" pageCount={48} defaultPage={3} size="sm" />
      </div>
    </div>
  );
}
