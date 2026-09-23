"use client";
import { useEffect, useRef, useState } from "react";
import { Refresh } from "@/lib/icons";
import { SortableTable, type SortableColumn } from "@/components/ui/sortable-table";

type Invoice = { id: string; customer: string; status: "Paid" | "Due" | "Overdue" | "Draft"; issued: string; amount: number | null };

const invoices: Invoice[] = [
  { id: "INV-2041", customer: "Northwind Analytics", status: "Paid", issued: "2026-09-02", amount: 12400 },
  { id: "INV-2042", customer: "Halcyon Labs", status: "Overdue", issued: "2026-08-14", amount: 3180.5 },
  { id: "INV-2043", customer: "Arcadia Freight", status: "Due", issued: "2026-09-11", amount: 860 },
  { id: "INV-2044", customer: "Juniper & Vale", status: "Draft", issued: "2026-09-19", amount: null },
  { id: "INV-2045", customer: "Sable Health", status: "Paid", issued: "2026-07-30", amount: 48250 },
  { id: "INV-2046", customer: "Oakline Studio", status: "Due", issued: "2026-09-08", amount: 2295 },
  { id: "INV-2047", customer: "Meridian Robotics International", status: "Paid", issued: "2026-08-27", amount: 19900 },
  { id: "INV-2048", customer: "Cobalt Mutual", status: "Overdue", issued: "2026-08-01", amount: 7420 },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const statusOrder = { Overdue: 0, Due: 1, Draft: 2, Paid: 3 } as const;
const tone = { Paid: "text-success", Due: "text-fg-2", Overdue: "text-danger", Draft: "text-fg-3" } as const;

const columns: SortableColumn<Invoice>[] = [
  { key: "id", header: "Invoice", width: 92, cell: (r) => <span className="font-mono text-[12px] text-fg-3">{r.id}</span> },
  {
    key: "customer",
    header: "Customer",
    cell: (r) => (
      <span title={r.customer} className="block truncate">
        {r.customer}
      </span>
    ),
    className: "max-w-0",
  },
  {
    key: "status",
    header: "Status",
    width: 100,
    // Sorts by urgency, not alphabetically, so Overdue rises to the top.
    sortValue: (r) => statusOrder[r.status],
    cell: (r) => (
      <span className={`flex items-center gap-1.5 text-[12.5px] ${tone[r.status]}`}>
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {r.status}
      </span>
    ),
  },
  { key: "issued", header: "Issued", width: 80, firstDirection: "desc", sortValue: (r) => r.issued, cell: (r) => <span className="text-fg-2 tabular">{date.format(new Date(r.issued))}</span> },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    width: 108,
    cell: (r) => (r.amount == null ? <span className="text-fg-4">—</span> : money.format(r.amount)),
  },
];

export default function Demo() {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A refresh keeps the rows and the sort where they are; only the hairline under the header moves.
  const refresh = () => {
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), 1400);
  };

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">
          Invoices <span className="ml-1 font-normal text-fg-3 tabular">{invoices.length}</span>
        </h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:text-fg-3"
        >
          <Refresh size={14} className={loading ? "motion-safe:animate-spin-slow" : undefined} />
          Refresh
        </button>
      </div>
      <SortableTable
        caption="Invoices"
        columns={columns}
        rows={invoices}
        getRowId={(r) => r.id}
        defaultSort={{ column: "amount", direction: "desc" }}
        loading={loading}
        minWidth={500}
        className="max-h-[344px]"
      />
    </div>
  );
}
