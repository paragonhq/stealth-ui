"use client";
import { useState } from "react";
import { addDays, useToday } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";

const terms = [
  { label: "Net 15", date: (t: Date) => addDays(t, 15) },
  { label: "Net 30", date: (t: Date) => addDays(t, 30) },
  { label: "Net 60", date: (t: Date) => addDays(t, 60) },
  { label: "End of month", date: (t: Date) => new Date(t.getFullYear(), t.getMonth() + 1, 0) },
];

// An invoice being drafted: the issue date is fixed, the due date is typed or picked.
export default function Demo() {
  const today = useToday();
  const [due, setDue] = useState<Date | null>(null);
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-medium tracking-[-0.015em]">Invoice INV-2041</p>
        <p className="font-mono text-[11px] text-fg-3">Northwind Traders</p>
      </div>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-[1fr_1.4fr] gap-3">
        <DatePicker label="Issued" value={today} readOnly clearable={false} />
        <DatePicker
          label="Due"
          value={due}
          onValueChange={setDue}
          shortcuts={terms}
          min={today ?? undefined}
          description="Type “in 30 days” or “next fri”"
          name="due"
        />
      </div>
    </div>
  );
}
