"use client";
import { useState } from "react";
import { PlanPicker, type PickerPlan } from "@/components/ui/plan-picker";

const plans: PickerPlan[] = [
  { id: "starter", name: "Starter", price: 8, description: "3 projects, community support" },
  { id: "pro", name: "Pro", price: 20, description: "Unlimited projects, preview deployments" },
  { id: "team", name: "Team", price: 45, description: "SSO, roles and a year of audit log" },
  { id: "business", name: "Business", price: 90, description: "Dedicated support and a 99.99% uptime SLA" },
];

// Billing settings, 18 days into a 30-day cycle. Business fails once so the error can be seen.
export default function Demo() {
  const [current, setCurrent] = useState("pro");
  const [declined, setDeclined] = useState(false);

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Change plan</h3>
        <p className="text-[12px] text-fg-3">Acme Studio · billed monthly</p>
      </div>
      <PlanPicker
        plans={plans}
        currentPlan={current}
        cycle={{ daysLeft: 12, days: 30, renewsOn: "Oct 14" }}
        onConfirm={(id) =>
          new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              if (id === "business" && !declined) {
                setDeclined(true);
                return reject(new Error("Card declined"));
              }
              setCurrent(id);
              resolve();
            }, 1100),
          )
        }
      />
    </div>
  );
}
