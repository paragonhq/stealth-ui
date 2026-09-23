"use client";
import { useState } from "react";
import { MaskedInput } from "@/components/ui/masked-input";

// An expense claim: an amount, the day it happened, the card it went on and a
// number to call. Each field formats as you type and keeps the caret where it was.
export default function Demo() {
  const [amount, setAmount] = useState("1284.5");

  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">New expense</h3>
        <p className="text-[12px] leading-4 text-fg-3">Offsite in Lisbon · Design team</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MaskedInput mask="currency" label="Amount" value={amount} onValueChange={setAmount} currency="EUR" locale="en-IE" />
        <MaskedInput mask="date" label="Purchase date" defaultValue="09182026" />
      </div>
      <MaskedInput mask="card" label="Card charged" description="Only the last four digits are stored." />
      <MaskedInput mask="phone" label="Phone for follow-up" defaultValue="415" />
    </form>
  );
}
