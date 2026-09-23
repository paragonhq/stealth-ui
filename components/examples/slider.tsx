"use client";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";

const instances = (n: number) => `${n} ${n === 1 ? "instance" : "instances"}`;

// Autoscaling settings for a service: a stepped range with labeled marks,
// a compact percentage, and a control the current plan locks.
export default function Demo() {
  const [max, setMax] = useState(8);
  const [cpu, setCpu] = useState(70);

  return (
    <div className="w-full max-w-[380px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Autoscaling</h3>
        <span className="truncate font-mono text-[11px] text-fg-3">api-gateway</span>
      </div>

      <div className="flex flex-col gap-6">
        <Slider
          label="Max instances"
          showValue
          value={max}
          onValueChange={setMax}
          min={1}
          max={20}
          marks={[1, 5, 10, 15, 20].map((v) => ({ value: v, label: v }))}
          formatValue={instances}
        />

        <Slider label="Scale up above CPU" showValue size="sm" value={cpu} onValueChange={setCpu} min={40} max={95} step={5} formatValue={(v) => `${v}%`} />

        <div className="flex flex-col gap-1.5">
          <Slider label="Memory per instance" showValue size="sm" disabled defaultValue={512} min={256} max={4096} step={256} formatValue={(v) => `${v} MB`} />
          <p className="text-[12px] text-fg-3">Memory is fixed on the Hobby plan.</p>
        </div>
      </div>
    </div>
  );
}
