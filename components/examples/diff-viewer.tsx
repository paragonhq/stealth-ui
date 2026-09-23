"use client";
import { DiffViewer } from "@/components/ui/diff-viewer";

const before = `import type { Plan } from "./types";

export const TRIAL_DAYS = 14;

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: { monthly: 12, yearly: 120 },
    seats: 3,
    features: ["Unlimited projects", "Email support"],
  },
  {
    id: "team",
    name: "Team",
    price: { monthly: 29, yearly: 290 },
    seats: 10,
    features: [
      "Everything in Starter",
      "Shared workspaces",
      "Audit log (30 days)",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: { monthly: 79, yearly: 790 },
    seats: 50,
    features: [
      "Everything in Team",
      "SAML single sign-on",
      "Audit log (1 year)",
      "Dedicated success manager",
    ],
  },
];

export function priceFor(plan: Plan, interval: "monthly" | "yearly") {
  return plan.price[interval];
}

export function seatsLeft(plan: Plan, used: number) {
  return Math.max(0, plan.seats - used);
}
`;

const after = before
  .replace("monthly: 12, yearly: 120", "monthly: 15, yearly: 144")
  .replace('      "SAML single sign-on",\n      "Audit log (1 year)",', '      "SAML single sign-on",\n      "SCIM provisioning",\n      "Audit log (unlimited)",');

// A pricing change in review: a price bump, a new feature, and everything untouched folded away.
export default function Demo() {
  return (
    <div className="w-full max-w-[680px]">
      <DiffViewer filename="lib/billing/plans.ts" before={before} after={after} context={2} />
    </div>
  );
}
