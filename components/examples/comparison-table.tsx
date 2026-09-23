"use client";
import { ComparisonTable, type ComparisonPlan, type ComparisonSection } from "@/components/ui/comparison-table";

const plans: ComparisonPlan[] = [
  { id: "free", name: "Free", price: "$0", period: "forever", action: { label: "Start free" } },
  { id: "pro", name: "Pro", price: "$16", period: "per seat / mo", badge: "Popular", action: { label: "Start trial" } },
  { id: "business", name: "Business", price: "$32", period: "per seat / mo", action: { label: "Talk to sales" } },
];

const sections: ComparisonSection[] = [
  {
    title: "Usage",
    features: [
      { name: "Projects", values: { free: "3", pro: "Unlimited", business: "Unlimited" } },
      { name: "File storage", values: { free: "2 GB", pro: "100 GB", business: { value: "1 TB", note: "Then $4 per 100 GB" } } },
      { name: "Guests", description: "People outside your workspace who can view and comment on shared projects.", values: { free: false, pro: { value: true, note: "Up to 10" }, business: true } },
    ],
  },
  {
    title: "Collaboration",
    features: [
      { name: "Comments and mentions", values: { free: true, pro: true, business: true } },
      { name: "Version history", description: "Restore any earlier version of a file, or compare two side by side.", values: { free: "7 days", pro: "90 days", business: "Unlimited" } },
      { name: "Shared templates", values: { free: false, pro: true, business: true } },
    ],
  },
  {
    title: "Security",
    features: [
      { name: "Two-factor enforcement", values: { free: false, pro: true, business: true } },
      { name: "SAML single sign-on", description: "Sign in through Okta, Entra ID or Google Workspace, with SCIM provisioning.", values: { free: false, pro: false, business: true } },
      { name: "Audit log", values: { free: false, pro: false, business: { value: true, note: "Exportable" } } },
    ],
  },
  {
    title: "Support",
    features: [{ name: "Response time", values: { free: "Community", pro: "1 business day", business: "4 hours" } }],
  },
];

// A pricing page's plan comparison, in the scroll box a docs page gives it. Scroll to
// see the plan header stick; narrow the window to get one plan at a time.
export default function Demo() {
  return (
    <div className="h-[460px] w-full max-w-[640px] overflow-y-auto overscroll-contain rounded-xl border border-line bg-frame px-4 pb-4 sm:px-5">
      <ComparisonTable plans={plans} sections={sections} highlight="pro" caption="Compare Northwind plans" className="pt-4" />
    </div>
  );
}
