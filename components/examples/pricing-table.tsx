"use client";
import { useState } from "react";
import { PriceToggle, type BillingPeriod } from "@/components/ui/price-toggle";
import { PricingTable, type PricingPlan } from "@/components/ui/pricing-table";

const plans: PricingPlan[] = [
  {
    id: "hobby",
    name: "Hobby",
    description: "For side projects and trying things out.",
    price: { monthly: 0, yearly: 0 },
    cta: "Start for free",
    features: ["3 projects", "1 GB storage", { label: "Community support", hint: "Answers in the forum from the team and other builders, usually within a day." }],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For professionals shipping every week.",
    price: { monthly: 20, yearly: 192 },
    unit: "per seat / month",
    cta: "Upgrade to Pro",
    recommended: true,
    featuresIntro: "Everything in Hobby, plus",
    features: [
      "Unlimited projects",
      "100 GB storage",
      { label: "Preview deployments", hint: "Every pull request gets its own live URL to review before it merges." },
      "Email support",
    ],
  },
  {
    id: "team",
    name: "Team",
    description: "For companies with reviews, roles and audits.",
    price: { monthly: 45, yearly: 432 },
    unit: "per seat / month",
    cta: "Upgrade to Team",
    featuresIntro: "Everything in Pro, plus",
    features: [
      { label: "SSO with SAML", hint: "Sign in through Okta, Entra ID or Google Workspace, and remove access in one place." },
      "Roles and permissions",
      { label: "Audit log, 1 year", hint: "Every change to projects, members and billing, searchable and exportable as CSV." },
      "Priority support",
    ],
  },
];

// An in-app upgrade page: the viewer is on Hobby and can move up.
export default function Demo() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [current, setCurrent] = useState("hobby");
  const [declined, setDeclined] = useState(false);

  return (
    <div className="flex w-full max-w-[760px] flex-col items-center gap-5">
      <PriceToggle value={period} onValueChange={setPeriod} savings="Save 20%" />
      <PricingTable
        plans={plans}
        period={period}
        currentPlan={current}
        onSelectPlan={(id) =>
          new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              // Team checkout fails the first time so the error can be seen; the retry goes through.
              if (id === "team" && !declined) {
                setDeclined(true);
                return reject(new Error("Card declined"));
              }
              setCurrent(id);
              resolve();
            }, 1200),
          )
        }
      />
    </div>
  );
}
