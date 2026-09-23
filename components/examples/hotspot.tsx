"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Bell, Bolt, Search } from "@/lib/icons";
import { Hotspot, resetHotspot, useHotspot } from "@/components/ui/hotspot";

const KEYS = { automations: "demo-automations-2026-09", protection: "demo-branch-protection-2026-09" };

const iconButton = cn(
  "relative grid size-8 place-items-center rounded-lg text-fg-3 outline-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
);

// Two new things in a repository's settings: a toolbar button and a setting.
export default function Demo() {
  const [protect, setProtect] = useState(false);
  const a = useHotspot(KEYS.automations);
  const b = useHotspot(KEYS.protection);
  const dismissedCount = Number(a.dismissed) + Number(b.dismissed);

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
      <div className="w-full overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-12 items-center gap-1 border-b border-line pl-4 pr-2">
          <p className="mr-auto truncate text-[13px] font-medium text-fg">checkout-web · Settings</p>
          <button type="button" aria-label="Search" className={iconButton}>
            <Search />
          </button>
          <Hotspot
            storageKey={KEYS.automations}
            title="Automations are here"
            description="Run a workflow when an issue changes status: assign a reviewer, post to a channel, or close stale branches."
            learnMoreHref="#automations"
            learnMoreLabel="How automations work"
            inset={7}
            align="end"
          >
            <button type="button" aria-label="Automations" className={iconButton}>
              <Bolt />
            </button>
          </Hotspot>
          <button type="button" aria-label="Notifications" className={iconButton}>
            <Bell />
          </button>
        </div>

        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-fg">Default branch</p>
              <p className="mt-0.5 text-[12px] text-fg-3">Pull requests open against this branch.</p>
            </div>
            <span className="rounded-md border border-line-2 px-2 py-1 font-mono text-[12px] text-fg-2">main</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13px] text-fg">
                Branch protection
                <Hotspot
                  storageKey={KEYS.protection}
                  title="Protect main from force pushes"
                  description="Require a passing build and one approval before anything merges."
                  side="top"
                />
              </p>
              <p className="mt-0.5 text-[12px] text-fg-3">Block merges until checks pass.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={protect}
              aria-label="Branch protection"
              onClick={() => setProtect((p) => !p)}
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full outline-none transition-[background-color] duration-200",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                protect ? "bg-fg" : "bg-line-2",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0.5 top-0.5 size-4 rounded-full bg-frame shadow-[var(--shadow)] transition-transform duration-200 ease-out-expo",
                  protect && "translate-x-4",
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <p className="flex h-7 items-center gap-2 text-[12px] text-fg-3" role="status">
        {dismissedCount === 0 ? (
          "Open a beacon to see what’s new."
        ) : (
          <>
            {dismissedCount === 2 ? "Both dismissed. They stay hidden after a reload." : "1 dismissed. It stays hidden after a reload."}
            <button
              type="button"
              onClick={() => {
                resetHotspot(KEYS.automations);
                resetHotspot(KEYS.protection);
              }}
              className="rounded-sm text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              Show again
            </button>
          </>
        )}
      </p>
    </div>
  );
}
