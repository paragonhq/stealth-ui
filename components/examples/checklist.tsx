"use client";
import { Checklist, type ChecklistItem } from "@/components/ui/checklist";

const TASKS: ChecklistItem[] = [
  { id: "notes", label: "Write the v2.4 release notes", done: false, meta: "Thu" },
  { id: "qa", label: "QA sign-off from Priya on the billing flow", done: false, meta: "Thu" },
  { id: "pricing", label: "Update the pricing page for the new Team plan and check the comparison table on mobile", done: false, meta: "Fri" },
  { id: "email", label: "Schedule the announcement email", done: false, meta: "Fri" },
  { id: "flags", label: "Remove the old checkout feature flag", done: true },
  { id: "tag", label: "Tag v2.4.0-rc.1", done: true },
];

export default function Demo() {
  return (
    <div className="w-full max-w-[420px] rounded-xl border border-line bg-frame p-2 pt-4 shadow-[var(--shadow)] sm:p-3 sm:pt-5">
      <Checklist title="Launch v2.4" defaultItems={TASKS} removable />
    </div>
  );
}
