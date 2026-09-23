"use client";
import { AnimatedLink } from "@/components/ui/animated-link";

// Where links live in a product: running text, a “view all”, and a quiet footer.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      <article className="flex flex-col gap-2 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <span className="font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase">Billing · 12 Sep 2026</span>
        <p className="text-[13.5px] leading-[1.6] text-fg-2 text-pretty">
          Annual plans are now prorated to the day. If you upgraded mid-cycle, your next invoice shows the credit as its own line.{" "}
          <AnimatedLink href="#proration">Read how proration is calculated for teams that change seats often</AnimatedLink>, or check the{" "}
          <AnimatedLink href="https://status.example.com">status page</AnimatedLink> if an invoice looks wrong.
        </p>
        <div className="pt-1 text-[13px]">
          <AnimatedLink href="#invoices" tone="muted" icon="arrow">
            View all invoices
          </AnimatedLink>
        </div>
      </article>

      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[12.5px]">
        <AnimatedLink href="#privacy" tone="plain">Privacy</AnimatedLink>
        <AnimatedLink href="#terms" tone="plain">Terms</AnimatedLink>
        <AnimatedLink href="#security" tone="plain">Security</AnimatedLink>
        <AnimatedLink href="https://docs.example.com/changelog" tone="plain">Changelog</AnimatedLink>
      </nav>
    </div>
  );
}
