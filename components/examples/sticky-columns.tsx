"use client";
import { StickyColumns, type StickyColumn } from "@/components/ui/sticky-columns";

type Account = { id: string; name: string; plan: string; months: number[] };

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Deterministic figures, so server and client render the same table.
const series = (base: number, growth: number, seed: number) =>
  months.map((_, i) => Math.round(base * (1 + growth) ** i * (1 + (((seed * (i + 3)) % 7) - 3) / 100)));

const accounts: Account[] = [
  { id: "a1", name: "Northwind Analytics", plan: "Enterprise", months: series(18400, 0.03, 5) },
  { id: "a2", name: "Halcyon Labs", plan: "Growth", months: series(6200, 0.05, 3) },
  { id: "a3", name: "Arcadia Freight", plan: "Growth", months: series(4800, 0.02, 11) },
  { id: "a4", name: "Sable Health", plan: "Enterprise", months: series(22100, 0.01, 7) },
  { id: "a5", name: "Oakline Studio", plan: "Starter", months: series(890, 0.06, 2) },
  { id: "a6", name: "Meridian Robotics International", plan: "Enterprise", months: series(15300, 0.04, 9) },
  { id: "a7", name: "Cobalt Mutual", plan: "Growth", months: series(7350, -0.01, 4) },
  { id: "a8", name: "Juniper & Vale", plan: "Starter", months: series(1240, 0.08, 6) },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const columns: StickyColumn<Account>[] = [
  {
    key: "name",
    header: "Account",
    pin: "start",
    width: 184,
    cell: (a) => (
      <span className="flex min-w-0 flex-col leading-tight">
        <span title={a.name} className="truncate">
          {a.name}
        </span>
        <span className="text-[11.5px] text-fg-3">{a.plan}</span>
      </span>
    ),
    footer: () => "Total",
  },
  ...months.map(
    (m, i): StickyColumn<Account> => ({
      key: m,
      header: m,
      numeric: true,
      width: 88,
      cell: (a) => <span className="text-fg-2">{usd.format(a.months[i])}</span>,
      footer: (rows) => usd.format(sum(rows.map((r) => r.months[i]))),
    }),
  ),
  {
    key: "total",
    header: "Year",
    numeric: true,
    pin: "end",
    width: 104,
    cell: (a) => <span className="font-medium">{usd.format(sum(a.months))}</span>,
    footer: (rows) => usd.format(sum(rows.map((r) => sum(r.months)))),
  },
];

export default function Demo() {
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Revenue by account, 2026</h3>
        <span className="shrink-0 text-[12px] text-fg-3">Scroll sideways</span>
      </div>
      <StickyColumns caption="Revenue by account, 2026" columns={columns} rows={accounts} getRowId={(a) => a.id} className="max-h-[372px]" />
    </div>
  );
}
