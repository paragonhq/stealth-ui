"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { NumberField } from "@/components/ui/number-field";

const PRICE_PER_GB = 4.5;

// Sizing a database: steppers you can hold, labels you can drag, a budget in the
// locale's currency, and a running estimate that rolls with every change.
export default function Demo() {
  const [replicas, setReplicas] = useState<number | null>(3);
  const [memory, setMemory] = useState<number | null>(16);
  const monthly = (replicas ?? 0) * (memory ?? 0) * PRICE_PER_GB;

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4 rounded-xl border border-line bg-frame p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">orders-db</h3>
        <p className="text-[12.5px] text-fg-3">Postgres 16 · eu-west-2</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Replicas" value={replicas} onValueChange={setReplicas} min={1} max={8} locale="en-US" />
        <NumberField label="Memory" unit="GB" value={memory} onValueChange={setMemory} min={2} max={256} step={2} largeStep={16} locale="en-US" />
      </div>

      <NumberField
        label="Monthly spend cap"
        defaultValue={1200}
        min={0}
        max={50000}
        step={50}
        largeStep={500}
        locale="en-US"
        format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
        description="We pause scaling when the month's bill reaches this"
      />

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-[12.5px] text-fg-3">Estimated</span>
        <span className="text-[13px] font-medium tabular text-fg">
          <NumberFlow value={monthly} locales="en-US" format={{ style: "currency", currency: "USD" }} />
          <span className="font-normal text-fg-3"> / month</span>
        </span>
      </div>
    </div>
  );
}
