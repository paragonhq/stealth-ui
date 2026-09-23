"use client";
import { useState } from "react";
import { AvailabilityEditor, validateWeeklyHours, type WeeklyHours } from "@/components/ui/availability-editor";

// A support lead's hours: a lunch break most days, a late Thursday, a short Friday.
const saved: WeeklyHours = {
  sun: { enabled: false, ranges: [{ start: "10:00", end: "14:00" }] },
  mon: { enabled: true, ranges: [{ start: "09:00", end: "12:30" }, { start: "13:30", end: "17:30" }] },
  tue: { enabled: true, ranges: [{ start: "09:00", end: "12:30" }, { start: "13:30", end: "17:30" }] },
  wed: { enabled: true, ranges: [{ start: "09:00", end: "17:30" }] },
  thu: { enabled: true, ranges: [{ start: "11:00", end: "19:00" }] },
  fri: { enabled: true, ranges: [{ start: "09:00", end: "15:00" }] },
  sat: { enabled: false, ranges: [{ start: "10:00", end: "14:00" }] },
};

export default function Demo() {
  const [hours, setHours] = useState(saved);
  const [base, setBase] = useState(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = JSON.stringify(hours) !== JSON.stringify(base);
  const problems = validateWeeklyHours(hours).length;

  const save = () => {
    setStatus("saving");
    window.setTimeout(() => {
      setBase(hours);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    }, 700);
  };

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <AvailabilityEditor
        value={hours}
        onValueChange={(v) => {
          setHours(v);
          setStatus("idle");
        }}
      />
      <div className="flex h-8 items-center justify-end gap-3 px-1">
        <p className="min-w-0 truncate text-[12px] text-fg-3" aria-live="polite">
          {problems ? (
            <span className="text-danger">{problems === 1 ? "1 range overlaps another" : `${problems} ranges overlap others`}</span>
          ) : status === "saved" ? (
            "Saved"
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "Times in Europe/London"
          )}
        </p>
        <button
          type="button"
          disabled={!dirty || problems > 0 || status === "saving"}
          onClick={save}
          className="grid h-8 shrink-0 place-items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="col-start-1 row-start-1 invisible">Save changes</span>
          <span className="col-start-1 row-start-1">{status === "saving" ? "Saving…" : "Save changes"}</span>
        </button>
      </div>
    </div>
  );
}
