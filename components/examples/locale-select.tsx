"use client";
import { useId, useState } from "react";
import { LocalePreview, LocaleSelect } from "@/components/ui/locale-select";

// A profile setting: pick a language and region, and see what changes before leaving the page.
export default function Demo() {
  const [locale, setLocale] = useState("en-GB");
  const id = useId();

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 id={id} className="text-[13px] font-medium leading-5 text-fg">
            Language and region
          </h3>
          <p className="text-[12.5px] leading-[18px] text-fg-3">Used for the interface, dates and numbers across Acme Web.</p>
        </div>
        <LocaleSelect aria-labelledby={id} value={locale} onValueChange={setLocale} />
      </div>
      <div className="border-t border-line bg-frame px-4 py-3.5">
        <p className="mb-2.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Preview</p>
        <LocalePreview locale={locale} />
      </div>
    </div>
  );
}
