"use client";
import { useState } from "react";
import { Calendar, addDays, useToday } from "@/components/ui/calendar";

const locales = [
  { tag: "en-US", label: "EN-US" },
  { tag: "en-GB", label: "EN-GB" },
  { tag: "de-DE", label: "DE" },
  { tag: "ja-JP", label: "JA" },
];

// Picking a delivery day: weekends and a fully booked day are off, the past is off,
// and the locale switch shows the week start, names and digits following Intl.
export default function Demo() {
  const today = useToday();
  const [locale, setLocale] = useState("en-US");
  const [day, setDay] = useState<Date | null>(null);
  const booked = today ? addDays(today, ((5 - today.getDay() + 7) % 7) + 7) : null; // Friday next week

  const summary = day
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(day)
    : null;

  return (
    <div className="flex w-fit max-w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium tracking-[-0.01em]">Delivery day</p>
        <div role="group" aria-label="Calendar language" className="flex items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5">
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

      <Calendar
        aria-label="Delivery day"
        locale={locale}
        value={day}
        onValueChange={setDay}
        min={today ?? undefined}
        max={today ? addDays(today, 90) : undefined}
        isDateDisabled={(d) => d.getDay() === 0 || d.getDay() === 6 || (!!booked && d.getTime() === booked.getTime())}
      />

      <p className="h-5 truncate text-[12.5px] leading-5 text-fg-3" aria-live="polite">
        {summary ? (
          <>
            Arrives <span className="text-fg">{summary}</span>, 9–12
          </>
        ) : (
          "Pick a weekday to see the window."
        )}
      </p>
    </div>
  );
}
