"use client";
import { useState } from "react";
import { TagInput } from "@/components/ui/tag-input";

// Repository topics: lowercase with hyphens, eight at most. Try pasting
// "animation, forms, a11y", adding one that's already there, or going past eight.
export default function Demo() {
  const [topics, setTopics] = useState(["react", "design-system", "motion", "accessibility"]);

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">stealth-ui</h3>
        <p className="text-[12px] leading-4 text-fg-3">Topics help people find this repository in search.</p>
      </div>
      <TagInput
        label="Topics"
        value={topics}
        onValueChange={setTopics}
        max={8}
        placeholder="Add a topic"
        normalize={(s) => s.trim().toLowerCase().replace(/\s+/g, "-")}
        validate={(t) =>
          t.length > 35 ? "Keep topics under 35 characters" : /^[a-z0-9][a-z0-9-]*$/.test(t) ? null : "Use letters, numbers and hyphens"
        }
        description="Enter or comma adds a topic. Up to 8."
      />
    </div>
  );
}
