"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ease } from "@/lib/motion";
import { TwoStepConfirm } from "@/components/ui/two-step-confirm";

const TEAM = [
  { id: "mo", name: "Maya Okafor", email: "maya@northwind.dev", role: "Admin" },
  { id: "jr", name: "Jonah Reyes", email: "jonah@northwind.dev", role: "Member" },
  { id: "pn", name: "Priya Natarajan-Whitfield", email: "priya.natarajan@northwind.dev", role: "Member" },
];

// Removing a teammate: frequent enough that a dialog is friction, costly enough to ask once.
export default function Demo() {
  const [team, setTeam] = useState(TEAM);
  const [armed, setArmed] = useState<string | null>(null);
  const reduce = useReducedMotion();

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Members</p>
        <p className="tabular text-[12px] text-fg-3">{team.length} of 3 seats</p>
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {team.map((m) => (
            <motion.li
              key={m.id}
              initial={false}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: ease.inOut }}
              className="overflow-hidden border-b border-line last:border-b-0"
            >
              <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${armed === m.id ? "bg-danger-soft" : ""}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2">
                  {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">{m.name}</p>
                  <p className="truncate text-[11.5px] text-fg-3">{m.email} · {m.role}</p>
                </div>
                <TwoStepConfirm
                  size="sm"
                  variant="ghost"
                  confirmLabel={`Remove ${m.name.split(" ")[0]}?`}
                  confirmedLabel="Removed"
                  resetAfter={null}
                  onArmedChange={(on) => setArmed((a) => (on ? m.id : a === m.id ? null : a))}
                  onConfirm={() => {
                    setArmed(null);
                    // Let the confirmed state land before the row folds away.
                    setTimeout(() => setTeam((t) => t.filter((x) => x.id !== m.id)), 700);
                  }}
                >
                  Remove
                </TwoStepConfirm>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {team.length === 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-[12.5px] text-fg-3">No members left on this team</p>
          <button
            type="button"
            onClick={() => setTeam(TEAM)}
            className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            Restore members
          </button>
        </div>
      )}
    </div>
  );
}
