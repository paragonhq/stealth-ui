"use client";
import { useId, useState } from "react";
import { Alert } from "@/lib/icons";
import { TimePicker } from "@/components/ui/time-picker";

const toMin = (v: string | null) => (v ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5)) : null);
const toValue = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const length = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);
const clock = (v: string) => {
  const m = toMin(v)!;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Booking a meeting: the end field lists durations from the start, and moving the
// start carries the end with it. Below, a 24-hour field from an en-GB workspace.
export default function Demo() {
  const id = useId();
  const [start, setStart] = useState<string | null>("09:30");
  const [end, setEnd] = useState<string | null>("10:15");
  const s = toMin(start);
  const e = toMin(end);
  const backwards = s != null && e != null && e <= s;

  function moveStart(next: string | null) {
    const n = toMin(next);
    if (n != null && s != null && e != null && !backwards && n + (e - s) < 1440) setEnd(toValue(n + (e - s)));
    setStart(next);
  }

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-5">
      <section className="rounded-xl border border-line p-4">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Design review</h3>
          <span className="text-[12px] text-fg-3">Thu, 24 Sep</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span id={`${id}-start`} className="text-[12px] text-fg-2">
              Starts
            </span>
            <TimePicker aria-labelledby={`${id}-start`} value={start} onValueChange={moveStart} interval={15} step={5} className="w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span id={`${id}-end`} className="text-[12px] text-fg-2">
              Ends
            </span>
            <TimePicker
              aria-labelledby={`${id}-end`}
              aria-describedby={`${id}-note`}
              value={end}
              onValueChange={setEnd}
              durationFrom={start}
              interval={15}
              step={5}
              invalid={backwards}
              className="w-full"
            />
          </div>
        </div>
        <p id={`${id}-note`} className="mt-2.5 flex min-h-4 items-center gap-1.5 text-[12px] leading-4 tabular" aria-live="polite">
          {backwards ? (
            <span className="flex items-center gap-1.5 text-danger">
              <Alert size={14} className="shrink-0" />
              Ends before it starts. Pick a time after {clock(start!)}.
            </span>
          ) : s != null && e != null ? (
            <span className="text-fg-3">{length(e - s)} · Room 4B</span>
          ) : (
            <span className="text-fg-3">Enter both times to book the room</span>
          )}
        </p>
      </section>

      <div className="flex items-center justify-between gap-4 px-1">
        <div className="min-w-0">
          <p id={`${id}-digest`} className="text-[13px] text-fg">
            Daily digest
          </p>
          <p className="truncate text-[12px] text-fg-3">Sent in London time</p>
        </div>
        <TimePicker aria-labelledby={`${id}-digest`} defaultValue="08:00" locale="en-GB" interval={60} size="sm" />
      </div>
    </div>
  );
}
