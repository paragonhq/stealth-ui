"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Trash, Upload } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

type Stage = "ready" | "building" | "live";
const status: Record<Stage, { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-fg-3" },
  building: { label: "Building", dot: "bg-warning animate-pulse-soft" },
  live: { label: "Live", dot: "bg-success" },
};

// A promote-to-production card: the primary action loads in place without
// changing width, Cancel is only available while there is something to cancel.
export default function Demo() {
  const [stage, setStage] = useState<Stage>("ready");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const deploy = () => {
    setStage("building");
    timer.current = window.setTimeout(() => setStage("live"), 2400);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setStage("ready");
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Promote to production</p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-fg-3">stealth-web · main@4f2a91c</p>
            </div>
            <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-line px-2 text-[11.5px] text-fg-2">
              <span className={cn("size-1.5 rounded-full transition-colors duration-300", status[stage].dot)} />
              <span className="tabular" aria-live="polite">{status[stage].label}</span>
            </span>
          </div>
          <p className="text-pretty text-[12.5px] leading-[1.5] text-fg-2">
            Replaces the build serving acme.com. The current one stays available to roll back to for 30 days.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" size="sm" render={<a href="#build-logs" />} trailingIcon={<ArrowUpRight />}>
            Build logs
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={stage !== "building"} onClick={cancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Upload />}
              loading={stage === "building"}
              loadingText="Deploying…"
              onClick={deploy}
            >
              Deploy
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-fg">Delete preview</p>
          <p className="truncate text-[12px] text-fg-3">Removes pr-482.acme.dev and its logs.</p>
        </div>
        <Button variant="danger" size="sm" leadingIcon={<Trash />}>
          Delete
        </Button>
      </div>
    </div>
  );
}
