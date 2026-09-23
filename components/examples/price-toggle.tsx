"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { PriceToggle, savingsPercent, type BillingPeriod } from "@/components/ui/price-toggle";

const pro = { monthly: 20, yearly: 192 };

// The toggle drives the price beside it: the value is the whole point.
export default function Demo() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const yearly = period === "yearly";
  const perMonth = yearly ? pro.yearly / 12 : pro.monthly;

  return (
    <div className="flex w-full max-w-[340px] flex-col items-center gap-5">
      <PriceToggle value={period} onValueChange={setPeriod} savings={`Save ${savingsPercent(pro.monthly, pro.yearly)}%`} />

      <div className="w-full rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium tracking-[-0.005em] text-fg">Pro</p>
          <p className="text-[12px] text-fg-3">For growing teams</p>
        </div>
        <p className="mt-3 flex items-baseline gap-1">
          <NumberFlow
            value={perMonth}
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
            className="text-[28px] font-medium leading-none tracking-[-0.03em] text-fg"
          />
          <span className="text-[12.5px] text-fg-3">per seat / month</span>
        </p>
        <p className="mt-2 text-[12px] text-fg-3 tabular">
          {yearly ? "$192 billed once a year" : "Billed monthly, cancel any time"}
        </p>
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-raised py-1.5 pl-3 pr-1.5">
        <span className="whitespace-nowrap text-[12.5px] text-fg-2">Renews</span>
        <PriceToggle size="sm" defaultValue="yearly" savings="2 months free" />
      </div>
    </div>
  );
}
