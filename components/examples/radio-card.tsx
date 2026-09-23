"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";

type Interval = "monthly" | "yearly";
const plans = [
  { value: "hobby", name: "Hobby", description: "Side projects and prototypes", price: { monthly: 0, yearly: 0 } },
  { value: "pro", name: "Pro", description: "Teams shipping to production every day", price: { monthly: 20, yearly: 16 }, badge: "Most popular" },
  { value: "scale", name: "Scale", description: "SSO, audit logs and a 99.99% uptime SLA", price: { monthly: 48, yearly: 40 } },
];

// A plan picker: the ring travels to the chosen plan, prices roll when the
// billing interval changes, and the button always names what you're buying.
export default function Demo() {
  const [plan, setPlan] = useState("pro");
  const [interval, setInterval] = useState<Interval>("monthly");
  const chosen = plans.find((p) => p.value === plan)!;

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3.5 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="plan" className="text-[14px] font-medium tracking-[-0.015em] text-fg">Choose a plan</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Change or cancel any time</p>
        </div>
        <SegmentedControl aria-label="Billing interval" size="sm" value={interval} onValueChange={(v) => setInterval(v as Interval)}>
          <SegmentedControlItem value="monthly">Monthly</SegmentedControlItem>
          <SegmentedControlItem value="yearly">Yearly −20%</SegmentedControlItem>
        </SegmentedControl>
      </div>

      <RadioCardGroup aria-labelledby="plan" name="plan" value={plan} onValueChange={setPlan}>
        {plans.map((p) => (
          <RadioCard
            key={p.value}
            value={p.value}
            title={p.name}
            badge={p.badge}
            description={p.description}
            aside={
              <span className="flex flex-col items-end">
                <span className="flex items-baseline gap-0.5">
                  <NumberFlow
                    value={p.price[interval]}
                    locales="en-US"
                    format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
                    className="text-[14px] font-medium leading-5 tracking-[-0.01em] text-fg"
                  />
                  <span className="text-[11.5px] text-fg-3">/mo</span>
                </span>
                <span className="text-[11.5px] leading-4 text-fg-3">{p.price.monthly === 0 ? "free forever" : "per seat"}</span>
              </span>
            }
          />
        ))}
      </RadioCardGroup>

      <button
        type="button"
        className="relative inline-grid h-8 w-full select-none place-items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.98] active:duration-75"
      >
        Continue with {chosen.name}
      </button>
    </div>
  );
}
