"use client";
import { useRef, useState } from "react";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";

// A workspace on Free that has hit its project limit. "Not now" hides the prompt;
// trying to create another project brings it back.
export default function Demo() {
  const [open, setOpen] = useState(true);
  const newProject = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Projects</h3>
        <button
          ref={newProject}
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          New project
        </button>
      </div>

      <UpgradePrompt
        open={open}
        onOpenChange={setOpen}
        returnFocus={newProject}
        title="You’ve used all 3 projects on Free"
        description="Upgrade to keep building. Your existing projects stay as they are."
        usage={{ used: 3, limit: 3, label: "Projects" }}
        plan={{
          name: "Pro",
          price: "$20 per month",
          perks: ["Unlimited projects", "Preview deployments on every pull request", "100 GB storage"],
        }}
        onUpgrade={() => new Promise((resolve) => setTimeout(resolve, 1100))}
      />

      <p className="pt-2 text-[12px] font-medium text-fg-3">Activity</p>

      <UpgradePrompt
        variant="inline"
        title="History older than 7 days is on Pro"
        plan={{ name: "Pro" }}
        upgradeLabel="Upgrade"
        upgradedLabel="Upgraded"
        onUpgrade={() => new Promise((_, reject) => setTimeout(() => reject(new Error("Checkout unavailable")), 900))}
      />
    </div>
  );
}
