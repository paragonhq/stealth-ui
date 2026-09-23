"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { type AppliedPromo, PromoCode } from "@/components/ui/promo-code";

const subtotal = 128;
const shipping = 6;
const money = { style: "currency", currency: "EUR", minimumFractionDigits: 2 } as const;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Checkout totals with a code field. SPRING20 works, WELCOME10 has expired,
// anything else is unknown; the total rolls when the discount lands.
export default function Demo() {
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const discount = promo ? Math.round(subtotal * 0.2 * 100) / 100 : 0;

  return (
    <div className="w-full max-w-[360px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <dl className="flex flex-col gap-2 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-fg-2">Subtotal</dt>
          <dd className="tabular text-fg">€128.00</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-2">Shipping</dt>
          <dd className="tabular text-fg">€6.00</dd>
        </div>
      </dl>
      <PromoCode
        className="mt-2"
        value={promo}
        onValueChange={setPromo}
        onApply={async (code) => {
          await wait(700);
          if (code === "SPRING20") return { code, label: "−€25.60" };
          if (code === "WELCOME10") throw new Error("WELCOME10 expired on 31 May. Try another code.");
          throw new Error(`${code} isn’t a code we recognise. Check the spelling.`);
        }}
      />
      <div className="mt-2 flex h-6 items-center justify-between border-t border-line pt-3 text-[14px] font-medium">
        <span className="text-fg">Total</span>
        <NumberFlow value={subtotal + shipping - discount} format={money} locales="en-IE" className="tabular leading-none text-fg" />
      </div>
      <p className="mt-3 text-[11.5px] text-fg-4">
        Try <span className="font-mono text-fg-3">SPRING20</span> or <span className="font-mono text-fg-3">WELCOME10</span>
      </p>
    </div>
  );
}
