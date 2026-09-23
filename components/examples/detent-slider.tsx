"use client";
import { useState } from "react";
import { DetentSlider } from "@/components/ui/detent-slider";

const effort = [
  { value: "low", label: "Low", description: "Fastest replies. Good for lookups, renames and small edits." },
  { value: "medium", label: "Medium", description: "Balanced. Plans before multi-file changes." },
  { value: "high", label: "High", description: "Thinks longest. For migrations, debugging and design work." },
];

const autonomy = [
  { value: "ask", label: "Ask first" },
  { value: "suggest", label: "Suggest" },
  { value: "edit", label: "Edit files" },
  { value: "full", label: "Full access" },
];

// Agent settings: named levels with a line that explains the current one.
export default function Demo() {
  const [level, setLevel] = useState("medium");

  return (
    <div className="w-full max-w-[380px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Agent</h3>
        <span className="truncate font-mono text-[11px] text-fg-3">review-bot</span>
      </div>
      <div className="flex flex-col gap-7">
        <DetentSlider label="Reasoning effort" stops={effort} value={level} onValueChange={setLevel} />
        <DetentSlider label="Autonomy" stops={autonomy} defaultValue="suggest" ticksBetween={2} />
      </div>
    </div>
  );
}
