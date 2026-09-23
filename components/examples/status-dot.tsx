"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { StatusDot, statusLabels, type Status } from "@/components/ui/status-dot";

const team: { name: string; initials: string; note: string; status: Status; tooltip: string; ping?: boolean }[] = [
  { name: "Maya Chen", initials: "MC", note: "In a call · #incident-2041", status: "online", tooltip: "In a call for 12m", ping: true },
  { name: "Leo Park", initials: "LP", note: "Reviewing billing-v2", status: "away", tooltip: "Back at 2:30 PM" },
  { name: "Priya Raman", initials: "PR", note: "Focus time", status: "busy", tooltip: "Notifications paused until 4 PM" },
  { name: "Tom Weiss", initials: "TW", note: "Berlin · 11:40 PM", status: "offline", tooltip: "Last seen 3h ago" },
];

function Avatar({ initials, children }: { initials: string; children: React.ReactNode }) {
  return (
    <span className="relative shrink-0">
      <span className="grid size-8 place-items-center rounded-full bg-hover text-[11px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">{initials}</span>
      <span className="absolute -bottom-px -right-px flex">{children}</span>
    </span>
  );
}

// An on-call roster: your own status to set, and teammates' at a glance.
export default function Demo() {
  const [mine, setMine] = useState<Status>("online");

  return (
    <div className="w-full max-w-[360px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)] [--dot-cutout:var(--frame)]">
      <div className="flex flex-col gap-3 border-b border-line p-3">
        <div className="flex items-center gap-3">
          <Avatar initials="RS">
            <StatusDot status={mine} ring />
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Ryan Schneider</p>
            <StatusDot status={mine} size="sm" showLabel labels={{ busy: "Do not disturb" }} className="mt-1" />
          </div>
        </div>
        <div role="group" aria-label="Set your status" className="grid grid-cols-4 gap-1 rounded-lg bg-hover p-0.5">
          {(Object.keys(statusLabels) as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={mine === s}
              onClick={() => setMine(s)}
              className={cn(
                "flex h-7 items-center justify-center gap-1.5 rounded-md text-[12px] outline-none transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.96] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                mine === s ? "bg-raised text-fg shadow-[var(--shadow),inset_0_0_0_1px_var(--line-2)]" : "text-fg-3 hover:text-fg",
              )}
            >
              <StatusDot status={s} size="sm" aria-hidden />
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <p className="px-3 pb-1 pt-3 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Platform on-call</p>
      <ul className="flex flex-col pb-1.5">
        {team.map((p) => (
          <li key={p.name} className="flex items-center gap-3 px-3 py-2">
            <Avatar initials={p.initials}>
              <StatusDot status={p.status} ring ping={p.ping} tooltip={p.tooltip} />
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-fg">{p.name}</p>
              <p className="truncate text-[12px] text-fg-3">{p.note}</p>
            </div>
            <StatusDot status={p.status} size="sm" showLabel className="shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
