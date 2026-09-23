"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Share } from "@/lib/icons";
import { ShareDialog, type SharePerson } from "@/components/ui/share-dialog";

const people: SharePerson[] = [
  { id: "u_priya", name: "Priya Raman", email: "priya@northwind.com", role: "editor", owner: true },
  { id: "u_mara", name: "Mara Okafor", email: "mara@northwind.com", role: "editor" },
  { id: "u_ines", name: "Inès Moreau", email: "ines@northwind.com", role: "commenter" },
  { id: "p_jonah", email: "jonah.park@fieldwork.studio", role: "viewer", pending: true },
];

// Sharing a spreadsheet: the dialog opens inside the stage, the way it sits over a file in the app.
export default function Demo() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  // Shown open on arrival without stealing focus from the page; opened by hand, it behaves as a normal modal.
  const [arrived, setArrived] = useState(true);

  return (
    <div ref={setStage} className="relative isolate flex min-h-[600px] w-full max-w-[640px] items-start justify-center overflow-hidden rounded-xl pt-6">
      <div className="flex w-full max-w-[420px] items-center gap-3 rounded-xl border border-line bg-raised px-3.5 py-3 shadow-[var(--shadow)]">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-success-soft font-mono text-[10px] font-medium text-success">
          XLS
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">q3-forecast.xlsx</p>
          <p className="truncate text-[12px] text-fg-3">Edited 12m ago by Mara Okafor</p>
        </div>
        {stage && (
          <ShareDialog
            container={stage}
            defaultOpen
            modal={arrived ? false : true}
            disablePointerDismissal={arrived}
            initialFocus={arrived ? false : undefined}
            onOpenChange={() => setArrived(false)}
            trigger={
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                  "transition-[background-color,border-color,scale] duration-150 ease-out-quart hover:border-fg-4 hover:bg-fg/[0.04] active:scale-[0.97] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                )}
              >
                <Share size={14} />
                Share
              </button>
            }
            title="Share “q3-forecast.xlsx”"
            link="https://northwind.app/s/q3-forecast-8f2k"
            currentUserId="u_priya"
            organizationName="Northwind"
            organizationDomain="northwind.com"
            defaultPeople={people}
            defaultAccess={{ scope: "organization", role: "viewer" }}
            onInvite={() => new Promise((r) => setTimeout(r, 800))}
            onResend={() => new Promise((r) => setTimeout(r, 600))}
          />
        )}
      </div>
    </div>
  );
}
