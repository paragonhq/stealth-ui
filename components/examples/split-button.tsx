"use client";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, Clock, File, Trash } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { SplitButton, type SplitButtonAction } from "@/components/ui/split-button";

const strategies: SplitButtonAction[] = [
  { value: "merge", label: "Merge pull request", description: "Keeps all 6 commits and adds a merge commit." },
  { value: "squash", label: "Squash and merge", description: "Combines the 6 commits into one." },
  { value: "rebase", label: "Rebase and merge", description: "Replays the 6 commits onto main." },
];
const past: Record<string, string> = { merge: "Merged", squash: "Squashed and merged", rebase: "Rebased and merged" };

// A merge box that remembers the strategy you pick, and a composer whose
// secondary actions sit behind the chevron.
export default function Demo() {
  const [strategy, setStrategy] = useState("squash");
  const [phase, setPhase] = useState<"open" | "merging" | "merged">("open");
  const [note, setNote] = useState("Draft saved 2m ago");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const merge = () => {
    setPhase("merging");
    timer.current = window.setTimeout(() => setPhase("merged"), 1600);
  };

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex items-start gap-3 p-4">
          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-300", phase === "merged" ? "text-success" : "text-fg-3")}>
            <CircleCheck />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg">{phase === "merged" ? `${past[strategy]} into main` : "Ready to merge"}</p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {phase === "merged" ? "#482 · Add usage-based billing · by Ana Ruiz" : "All 14 checks passed · 2 approvals"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="truncate font-mono text-[11px] text-fg-3">ana/usage-billing → main</span>
          <SplitButton
            actions={strategies}
            value={strategy}
            onValueChange={setStrategy}
            onClick={merge}
            loading={phase === "merging"}
            disabled={phase === "merged"}
            menuLabel="Choose merge strategy"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-fg">Re: Q3 vendor renewal</p>
          <p className="truncate text-[12px] text-fg-3" aria-live="polite">{note}</p>
        </div>
        <SplitButton
          variant="secondary"
          size="sm"
          onClick={() => setNote("Draft saved just now")}
          menuLabel="More save options"
          actions={[
            { value: "template", label: "Save as template", icon: <File /> },
            { value: "schedule", label: "Schedule send…", icon: <Clock />, shortcut: "⌘ ⇧ ↵", onSelect: () => setNote("Sends tomorrow at 9:00") },
            { value: "discard", label: "Discard draft", icon: <Trash />, danger: true, onSelect: () => setNote("Draft discarded") },
          ]}
        >
          Save draft
        </SplitButton>
      </div>
    </div>
  );
}
