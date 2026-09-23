"use client";
import { useState } from "react";
import { TrialBanner } from "@/components/ui/trial-banner";

// The same trial at the top of the app and in the sidebar. Step the days to see it turn urgent, then end.
export default function Demo() {
  const [days, setDays] = useState(5);
  const [open, setOpen] = useState(true);
  const endsOn = ["Sep 22", "Sep 23", "Sep 24", "Sep 25", "Sep 26", "Sep 27", "Sep 28", "Sep 29"][Math.max(0, days)] ?? "Sep 29";

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-line bg-frame">
        <div className="p-2 pb-0">
          <TrialBanner
            open={open}
            onOpenChange={setOpen}
            daysLeft={days}
            totalDays={14}
            plan="Pro"
            endsOn={endsOn}
            onUpgrade={() => new Promise((resolve) => setTimeout(resolve, 900))}
          />
        </div>
        <div className="flex gap-3 p-2">
          <div className="hidden w-44 shrink-0 flex-col gap-1 sm:flex">
            {["Overview", "Deployments", "Analytics", "Settings"].map((item, i) => (
              <span key={item} className={i === 0 ? "rounded-md bg-hover px-2 py-1.5 text-[12.5px] text-fg" : "px-2 py-1.5 text-[12.5px] text-fg-3"}>
                {item}
              </span>
            ))}
            <div className="mt-3">
              <TrialBanner
                variant="card"
                daysLeft={days}
                totalDays={14}
                plan="Pro"
                endsOn={endsOn}
                description={days < 0 ? "Projects are read-only until you choose a plan." : undefined}
              />
            </div>
          </div>
          <div className="flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-line p-3">
            <span className="h-2.5 w-1/3 rounded-full bg-fg/10" />
            <span className="h-2.5 w-2/3 rounded-full bg-fg/5" />
            <span className="h-2.5 w-1/2 rounded-full bg-fg/5" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-[12px] text-fg-3">
        <span>Days left</span>
        <div className="flex h-7 items-center rounded-md border border-line-2 bg-raised">
          <button type="button" aria-label="One day less" onClick={() => setDays((d) => Math.max(-1, d - 1))} className="grid h-full w-7 place-items-center rounded-l-md text-fg-2 outline-none transition-[background-color,color] hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3">
            −
          </button>
          <span className="w-14 text-center text-fg tabular">{days < 0 ? "Ended" : days}</span>
          <button type="button" aria-label="One day more" onClick={() => setDays((d) => Math.min(13, d + 1))} className="grid h-full w-7 place-items-center rounded-r-md text-fg-2 outline-none transition-[background-color,color] hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3">
            +
          </button>
        </div>
        {!open && days > 2 && (
          <button type="button" onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-fg-2 underline decoration-fg-4 underline-offset-2 outline-none hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3">
            Show banner
          </button>
        )}
      </div>
    </div>
  );
}
