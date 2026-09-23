"use client";
import NumberFlow from "@number-flow/react";
import { useMemo, useState } from "react";
import { Globe, Hash, User } from "@/lib/icons";
import { FilterBuilder, isRuleComplete, matchesFilters, type FilterField, type FilterGroup } from "@/components/ui/filter-builder";

const Stage = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
    <path d="M2.75 4h10.5M4.5 8h7M6.5 12h3" />
  </svg>
);
const Building = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
    <path d="M3 13.25V3.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 .75.75v9.75M10 6.5h2.25a.75.75 0 0 1 .75.75v6M2 13.25h12M5.5 5.5h2M5.5 8h2M5.5 10.5h2" />
  </svg>
);

const fields: FilterField[] = [
  {
    key: "stage",
    label: "Stage",
    icon: <Stage />,
    type: "option",
    options: [
      { value: "lead", label: "Lead" },
      { value: "qualified", label: "Qualified" },
      { value: "proposal", label: "Proposal" },
      { value: "negotiation", label: "Negotiation" },
      { value: "won", label: "Closed won" },
      { value: "lost", label: "Closed lost" },
    ],
  },
  {
    key: "owner",
    label: "Owner",
    icon: <User />,
    type: "option",
    options: [
      { value: "maya", label: "Maya Chen" },
      { value: "jonas", label: "Jonas Weber" },
      { value: "priya", label: "Priya Raman" },
      { value: "tomas", label: "Tomás Ferreira" },
    ],
  },
  {
    key: "region",
    label: "Region",
    icon: <Globe />,
    type: "option",
    options: [
      { value: "emea", label: "EMEA" },
      { value: "na", label: "North America" },
      { value: "apac", label: "APAC" },
      { value: "latam", label: "LATAM" },
    ],
  },
  { key: "amount", label: "Amount", icon: <Hash />, type: "number", unit: "€", placeholder: "10,000" },
  { key: "company", label: "Company", icon: <Building />, type: "text", placeholder: "Acme" },
];

const companies = ["Northwind", "Halcyon Labs", "Brightline", "Kestrel Freight", "Oakridge Health", "Lumen & Co", "Fjord Studio", "Parallax Bank", "Tidewater", "Quarry Systems"];

// Deterministic, so the server and client agree on all 60 deals.
const deals = Array.from({ length: 60 }, (_, i) => {
  const r = (n: number, salt: number) => ((i + 7) * 2654435761 + salt * 97531) % 4294967296 % n;
  return {
    company: companies[i % companies.length],
    stage: fields[0].options![r(6, 1)].value,
    owner: fields[1].options![r(4, 2)].value,
    region: fields[2].options![r(4, 3)].value,
    amount: 2000 + r(46, 4) * 1000,
  };
});

export default function Demo() {
  const [group, setGroup] = useState<FilterGroup>({
    conjunction: "and",
    rules: [
      { id: "seed-1", field: "stage", operator: "any_of", value: ["proposal", "negotiation"] },
      { id: "seed-2", field: "amount", operator: "gt", value: "20000" },
    ],
  });
  const count = useMemo(() => deals.filter((d) => matchesFilters(d, group, fields)).length, [group]);
  const applied = group.rules.filter((r) => isRuleComplete(r, fields)).length;

  return (
    <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-line px-3">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Filter deals</span>
        <span className="text-[12px] text-fg-3 tabular">
          <NumberFlow value={count} className="text-fg" /> of {deals.length} deals
        </span>
      </div>
      <FilterBuilder fields={fields} value={group} onValueChange={setGroup} className="px-2 pt-2 pb-2" />
      <div className="flex h-8 items-center border-t border-line px-3 text-[12px] text-fg-3">
        {applied === 0 ? "Showing every deal" : `${applied} ${applied === 1 ? "filter" : "filters"} applied, matching ${group.conjunction === "and" ? "all" : "any"}`}
      </div>
    </div>
  );
}
