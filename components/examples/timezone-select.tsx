"use client";
import { useState } from "react";
import { formatOffset, TimezoneSelect, useDetectedTimeZone, useMinute, zoneOffset } from "@/components/ui/timezone-select";

// Profile settings, where a time zone actually gets picked, with the one line people want next to it:
// how far that is from where they are now.
export default function Demo() {
  const [zone, setZone] = useState<string | null>(null);
  const detected = useDetectedTimeZone();
  const minute = useMinute();
  const current = zone ?? detected;
  const diff = current && detected && minute !== null ? zoneOffset(current) - zoneOffset(detected) : null;
  const gap = diff === null ? "" : `${Math.floor(Math.abs(diff) / 60)}h${Math.abs(diff) % 60 ? ` ${Math.abs(diff) % 60}m` : ""}`;

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-5 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-0.5">
        <p className="text-[14px] font-medium tracking-[-0.015em]">Time and region</p>
        <p className="text-[12.5px] text-fg-3">Used for your working hours, reminders and when digests arrive.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <TimezoneSelect label="Time zone" value={current} onValueChange={setZone} />
        <p className="min-h-4 text-[12px] leading-4 text-fg-3 tabular" aria-live="polite">
          {diff === null
            ? " "
            : diff === 0
              ? "Same time as your device."
              : `${gap} ${diff > 0 ? "ahead of" : "behind"} your device (${formatOffset(zoneOffset(detected!))}).`}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[12.5px] font-medium text-fg-2">Team default</p>
        <TimezoneSelect aria-label="Team default time zone" defaultValue="America/New_York" size="sm" showDetected={false} />
      </div>
    </div>
  );
}
