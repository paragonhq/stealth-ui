"use client";
import { useState } from "react";
import {
  TableToolbar,
  TableToolbarDensity,
  TableToolbarExport,
  TableToolbarFilter,
  TableToolbarSearch,
  TableToolbarSeparator,
  TableToolbarToggle,
  tableDensity,
  type TableDensity,
} from "@/components/ui/table-toolbar";

type Invoice = { id: string; customer: string; status: "Paid" | "Open" | "Overdue"; amount: number; due: string };

const invoices: Invoice[] = [
  { id: "INV-2041", customer: "Northwind Logistics", status: "Paid", amount: 12400, due: "12 Sep" },
  { id: "INV-2042", customer: "Harbor & Pine Studio", status: "Overdue", amount: 3180, due: "4 Sep" },
  { id: "INV-2043", customer: "Kestrel Analytics", status: "Open", amount: 8900, due: "30 Sep" },
  { id: "INV-2044", customer: "Juniper Health", status: "Paid", amount: 21650, due: "9 Sep" },
  { id: "INV-2045", customer: "Oakline Freight Co-operative", status: "Open", amount: 4725, due: "2 Oct" },
];

const tone = { Paid: "bg-success", Open: "bg-info", Overdue: "bg-danger" } as const;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Demo() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [density, setDensity] = useState<TableDensity>("comfortable");
  const [view, setView] = useState("table");

  const q = query.trim().toLowerCase();
  const rows = invoices.filter(
    (i) => (!status.length || status.includes(i.status)) && (!q || i.customer.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)),
  );
  const count = (s: Invoice["status"]) => invoices.filter((i) => i.status === s).length;

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2.5">
      <TableToolbar aria-label="Invoice tools">
        <TableToolbarSearch value={query} onValueChange={setQuery} placeholder="Search invoices" />
        <TableToolbarFilter
          value={status}
          onValueChange={setStatus}
          options={(["Paid", "Open", "Overdue"] as const).map((s) => ({ value: s, label: s, group: "Status", count: count(s) }))}
        />
        <TableToolbarSeparator />
        <TableToolbarDensity value={density} onValueChange={setDensity} />
        <TableToolbarToggle
          aria-label="View"
          value={view}
          onValueChange={setView}
          options={[
            { value: "table", label: "Table view", icon: <TableGlyph /> },
            { value: "cards", label: "Card view", icon: <CardsGlyph /> },
          ]}
        />
        <TableToolbarSeparator />
        <TableToolbarExport onExport={() => new Promise((r) => setTimeout(r, 1100))} />
      </TableToolbar>

      <div className="min-h-[258px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        {rows.length === 0 ? (
          <div className="flex h-[256px] flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-[13px] text-fg-2">No invoices match these filters</p>
            <button
              type="button"
              onClick={() => (setQuery(""), setStatus([]))}
              className="h-7 rounded-md border border-line-2 px-2 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Clear filters
            </button>
          </div>
        ) : view === "table" ? (
          <table className="w-full table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="h-9 border-b border-line text-left text-[12px] text-fg-3">
                <th className="w-[92px] pl-4 font-normal">Invoice</th>
                <th className="px-3 font-normal">Customer</th>
                <th className="w-[92px] px-3 font-normal max-sm:hidden">Status</th>
                <th className="w-[96px] pr-4 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i.id}
                  // Height is the one layout property worth animating here: the rows are few and
                  // the change is what the person just asked for.
                  style={{ height: tableDensity[density] }}
                  className="border-b border-line transition-[height,background-color] duration-200 ease-in-out-quart last:border-b-0 hover:bg-hover"
                >
                  <td className="pl-4 font-mono text-[12px] text-fg-2">{i.id}</td>
                  <td className="truncate px-3 text-fg">{i.customer}</td>
                  <td className="px-3 max-sm:hidden">
                    <span className="inline-flex items-center gap-1.5 text-fg-2">
                      <span aria-hidden className={`size-1.5 rounded-full ${tone[i.status]}`} />
                      {i.status}
                    </span>
                  </td>
                  <td className="pr-4 text-right text-fg tabular">{money.format(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="grid grid-cols-2 gap-px bg-line max-sm:grid-cols-1">
            {rows.map((i) => (
              <li key={i.id} className={`flex flex-col justify-between last:odd:col-span-2 max-sm:last:odd:col-span-1 gap-2 bg-raised px-4 transition-[padding] duration-200 ease-in-out-quart ${density === "compact" ? "py-2.5" : "py-4"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-fg-3">{i.id}</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-2">
                    <span aria-hidden className={`size-1.5 rounded-full ${tone[i.status]}`} />
                    {i.status}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-fg">{i.customer}</span>
                  <span className="text-[13px] text-fg tabular">{money.format(i.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="px-1 text-[12px] text-fg-3 tabular" aria-live="polite">
        {rows.length === invoices.length ? `${invoices.length} invoices` : `${rows.length} of ${invoices.length} invoices`}
      </p>
    </div>
  );
}

function TableGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.75" />
      <path d="M2.25 6.25h11.5M2.25 9.75h11.5M6.25 6.25v7" />
    </svg>
  );
}

function CardsGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.25" y="2.75" width="4.75" height="4.5" rx="1.25" />
      <rect x="9" y="2.75" width="4.75" height="4.5" rx="1.25" />
      <rect x="2.25" y="8.75" width="4.75" height="4.5" rx="1.25" />
      <rect x="9" y="8.75" width="4.75" height="4.5" rx="1.25" />
    </svg>
  );
}
