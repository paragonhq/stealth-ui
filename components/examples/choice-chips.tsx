"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { ChoiceChip, ChoiceChips } from "@/components/ui/choice-chips";

// Deployment counts by status and environment. Each chip's count is faceted by
// the other filter, so picking an environment rolls the status counts.
const DATA: Record<string, Record<string, number>> = {
  ready: { production: 52, preview: 64, development: 12 },
  building: { production: 1, preview: 2, development: 0 },
  failed: { production: 2, preview: 9, development: 1 },
  canceled: { production: 0, preview: 3, development: 1 },
  queued: { production: 0, preview: 0, development: 0 },
};
const STATUSES = [
  { value: "ready", label: "Ready", dot: "bg-success" },
  { value: "building", label: "Building", dot: "bg-warning" },
  { value: "failed", label: "Failed", dot: "bg-danger" },
  { value: "canceled", label: "Canceled", dot: "bg-fg-4" },
  { value: "queued", label: "Queued", dot: "bg-fg-4" },
];
const ENVS = [
  { value: "production", label: "Production" },
  { value: "preview", label: "Preview" },
  { value: "development", label: "Development" },
];

const sum = (statuses: string[], envs: string[]) =>
  statuses.reduce((n, s) => n + envs.reduce((m, e) => m + DATA[s][e], 0), 0);

export default function Demo() {
  const [status, setStatus] = useState<string[]>(["failed"]);
  const [env, setEnv] = useState<string[]>([]);

  const allStatuses = Object.keys(DATA);
  const allEnvs = ENVS.map((e) => e.value);
  const envScope = env.length ? env : allEnvs;
  const statusScope = status.length ? status : allStatuses;
  const shown = sum(statusScope, envScope);
  const total = sum(allStatuses, allEnvs);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-5 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Deployments</h3>
        <p className="tabular text-[12px] text-fg-3">
          <NumberFlow value={shown} className="text-fg-2" /> of {total}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span id="status-label" className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">
          Status
        </span>
        <ChoiceChips aria-labelledby="status-label" value={status} onValueChange={setStatus} clearedAnnouncement="Status filters cleared">
          {STATUSES.map((s) => {
            const count = sum([s.value], envScope);
            return (
              <ChoiceChip
                key={s.value}
                value={s.value}
                count={count}
                disabled={s.value === "queued"}
                icon={<span className={`size-1.5 rounded-full ${s.dot}`} />}
              >
                {s.label}
              </ChoiceChip>
            );
          })}
        </ChoiceChips>
      </div>

      <div className="flex flex-col gap-2">
        <span id="env-label" className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">
          Environment
        </span>
        <ChoiceChips aria-labelledby="env-label" multiple={false} size="sm" value={env} onValueChange={setEnv} clearLabel="Any" clearedAnnouncement="Showing every environment">
          {ENVS.map((e) => (
            <ChoiceChip key={e.value} value={e.value}>
              {e.label}
            </ChoiceChip>
          ))}
        </ChoiceChips>
      </div>
    </div>
  );
}
