"use client";
import { useState } from "react";
import { FloatingLabelField } from "@/components/ui/floating-label";

const emailError = (v: string) =>
  !v.trim() ? "Enter your email to get the receipt" : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? undefined : "Enter a full address, like maya@northwind.com";

// A checkout step: one field already filled (label up), one empty, and an email
// that explains itself when you try to continue without it.
export default function Demo() {
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const error = tried ? emailError(email) : undefined;

  return (
    <form
      noValidate
      className="flex w-full max-w-[360px] flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (emailError(email)) (e.currentTarget.elements.namedItem("email") as HTMLInputElement | null)?.focus();
      }}
    >
      <div className="mb-1 flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Billing details</h3>
        <p className="text-[12.5px] text-fg-3">Pro plan · $24 per month</p>
      </div>

      <FloatingLabelField label="Full name" name="name" defaultValue="Maya Chen" autoComplete="name" />
      <FloatingLabelField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="maya@northwind.com"
        description="Receipts and invoices go here"
        value={email}
        onValueChange={setEmail}
        error={error}
      />
      <FloatingLabelField label="Company (optional)" name="company" autoComplete="organization" enterKeyHint="done" />

      <button
        type="submit"
        className="relative mt-1 inline-flex h-9 items-center justify-center rounded-lg bg-fg px-3 text-[13px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid active:scale-[0.97]"
      >
        Continue to payment
      </button>
    </form>
  );
}
