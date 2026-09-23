"use client";
import { useState } from "react";
import { useToday } from "@/components/ui/calendar";
import { DateField } from "@/components/ui/date-field";

const locales = [
  { tag: "en-US", label: "EN-US" },
  { tag: "en-GB", label: "EN-GB" },
  { tag: "de-DE", label: "DE" },
  { tag: "ja-JP", label: "JA" },
];

// Traveler details: the two dates every booking asks for, typed rather than scrolled to.
export default function Demo() {
  const [locale, setLocale] = useState("en-US");
  const [birth, setBirth] = useState<Date | null>(null);
  const [expiry, setExpiry] = useState<Date | null>(new Date(2031, 2, 14));
  const today = useToday() ?? undefined;

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-3 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium tracking-[-0.015em]">Traveler details</p>
        <div role="group" aria-label="Field language" className="flex items-center gap-0.5 rounded-lg border border-line bg-frame p-0.5">
          {locales.map((l) => (
            <button
              key={l.tag}
              type="button"
              aria-pressed={locale === l.tag}
              onClick={() => setLocale(l.tag)}
              className="h-6 rounded-md px-1.5 font-mono text-[10.5px] tracking-[0.04em] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:text-fg active:scale-[0.95] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 aria-pressed:bg-fg/[0.08] aria-pressed:text-fg"
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <DateField label="Date of birth" locale={locale} value={birth} onValueChange={setBirth} max={today} showWeekday={false} required name="dob" />
      <DateField
        label="Passport expiry"
        locale={locale}
        value={expiry}
        onValueChange={setExpiry}
        min={today}
        description="Arrow keys step each part"
        name="passport_expiry"
      />
    </div>
  );
}
