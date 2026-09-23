"use client";
import { useState } from "react";
import { Trash } from "@/lib/icons";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

// A danger zone, where the second of hesitation a hold costs is the point.
export default function Demo() {
  const [archived, setArchived] = useState(false);

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="border-b border-line px-4 py-3">
        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Danger zone</p>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Delete atlas-web</p>
          <p className="text-[12px] leading-[1.5] text-fg-3">Removes 3 environments and 1,284 deployments. This can&rsquo;t be undone.</p>
        </div>
        <HoldToConfirm icon={<Trash />} confirmedLabel="Deleted" onConfirm={() => {}} resetAfter={2400}>
          Delete project
        </HoldToConfirm>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-frame/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-fg">{archived ? "214 issues archived" : "214 closed issues older than 90 days"}</p>
          <p className="text-[11px] text-fg-3">{archived ? "They stay searchable under Archive." : "Tap either button to see the hint."}</p>
        </div>
        <HoldToConfirm
          tone="neutral"
          size="sm"
          duration={900}
          confirmedLabel="Archived"
          onConfirm={() => setArchived(true)}
          resetAfter={null}
        >
          Archive all
        </HoldToConfirm>
      </div>
    </div>
  );
}
