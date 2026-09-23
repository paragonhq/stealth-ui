"use client";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";

const faq = [
  {
    value: "prorate",
    q: "What happens when I change plans mid-cycle?",
    a: "You’re charged the prorated difference today, and the next invoice reflects the new plan. Downgrades apply as a credit on your next invoice rather than a refund.",
  },
  {
    value: "seats",
    q: "Do I pay for guests and viewers?",
    a: "No. Only members who can edit count as seats. Guests and view-only links are free, up to 50 per workspace.",
  },
  {
    value: "invoice",
    q: "Can I add a VAT number to invoices?",
    a: "Yes. Add it under Settings → Billing → Tax details. It appears on every invoice issued after you save it; past invoices can be reissued from the invoice’s menu.",
  },
  {
    value: "cancel",
    q: "What happens to my data if I cancel?",
    a: "Your workspace becomes read-only at the end of the billing period. Everything stays exportable for 90 days, then it’s deleted for good.",
  },
];

export default function Demo() {
  return (
    // Reserve the tallest open height so the card stays put while answers open and close.
    <div className="flex min-h-[330px] w-full max-w-[460px] flex-col gap-3">
      <Accordion defaultValue={["prorate"]}>
        {faq.map((item) => (
          <AccordionItem key={item.value} value={item.value}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionPanel>{item.a}</AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="px-1 text-[12px] text-fg-3">
        Closed answers are still searchable: press <kbd className="font-mono text-[11px] text-fg-2">⌘F</kbd> and look for “read-only”.
      </p>
    </div>
  );
}
