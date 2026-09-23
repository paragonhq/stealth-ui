"use client";
import { Download, Mail } from "@/lib/icons";
import { ExpandableCard, ExpandableCardContent, ExpandableCardGroup, ExpandableCardTrigger } from "@/components/ui/expandable-card";

type Invoice = {
  id: string;
  customer: string;
  due: string;
  total: string;
  status: "Paid" | "Overdue" | "Draft";
  lines: [string, string][];
};

const invoices: Invoice[] = [
  { id: "INV-2041", customer: "Northwind Studio", due: "Paid Sep 12", total: "$4,280.00", status: "Paid", lines: [["Team plan · 12 seats", "$3,600.00"], ["Usage · 1.2M events", "$480.00"], ["Tax", "$200.00"]] },
  { id: "INV-2042", customer: "Halcyon Health", due: "Due Sep 18 · 4 days late", total: "$12,960.00", status: "Overdue", lines: [["Enterprise plan · 40 seats", "$12,000.00"], ["Priority support", "$360.00"], ["Tax", "$600.00"]] },
  { id: "INV-2043", customer: "Fern & Finch", due: "Not sent yet", total: "$890.00", status: "Draft", lines: [["Starter plan · 3 seats", "$840.00"], ["Tax", "$50.00"]] },
];

const statusClass = {
  Paid: "bg-success-soft text-success",
  Overdue: "bg-danger-soft text-danger",
  Draft: "bg-hover text-fg-3 ring-1 ring-inset ring-line-2",
};

export default function Demo() {
  return (
    // Reserve the tallest open state so the list grows downward instead of re-centring.
    <div className="flex min-h-[400px] w-full max-w-[440px] flex-col">
      <ExpandableCardGroup defaultValue="INV-2042">
        {invoices.map((inv) => (
          <ExpandableCard key={inv.id} value={inv.id}>
            <ExpandableCardTrigger>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">{inv.customer}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-medium ${statusClass[inv.status]}`}>{inv.status}</span>
                </span>
                <span className="truncate text-[12px] text-fg-3">
                  <span className="font-mono text-[11px]">{inv.id}</span> · {inv.due}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-medium tabular text-fg">{inv.total}</span>
            </ExpandableCardTrigger>

            <ExpandableCardContent>
              <dl className="flex flex-col border-t border-line pt-3 text-[12.5px]">
                {inv.lines.map(([label, amount]) => (
                  <div key={label} className="flex h-7 items-center justify-between gap-3">
                    <dt className="truncate text-fg-2">{label}</dt>
                    <dd className="shrink-0 tabular text-fg-2">{amount}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <DemoButton icon={<Download size={14} />}>Download PDF</DemoButton>
                {inv.status === "Overdue" && (
                  <DemoButton icon={<Mail size={14} />} primary>
                    Send reminder
                  </DemoButton>
                )}
                {inv.status === "Draft" && <DemoButton primary>Send invoice</DemoButton>}
              </div>
            </ExpandableCardContent>
          </ExpandableCard>
        ))}
      </ExpandableCardGroup>
    </div>
  );
}

function DemoButton({ icon, primary, children }: { icon?: React.ReactNode; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium outline-none transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 " +
        (primary ? "bg-fg text-frame hover:bg-fg/90" : "border border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover")
      }
    >
      {icon}
      {children}
    </button>
  );
}
