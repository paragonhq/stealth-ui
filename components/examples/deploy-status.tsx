"use client";
import { useEffect, useRef, useState } from "react";
import { type DeployState, DeployStatus } from "@/components/ui/deploy-status";

// A project's recent deployments. The top one is building now; Redeploy runs
// it again through queued, building and ready.
type Run = { status: DeployState; createdAt?: number; startedAt?: number; finishedAt?: number };

export default function Demo() {
  const [run, setRun] = useState<Run>({ status: "building" });
  const [past, setPast] = useState<{ ready?: number; error?: number }>({});
  const timers = useRef<number[]>([]);

  const schedule = (steps: [number, () => void][]) => {
    timers.current.forEach(clearTimeout);
    timers.current = steps.map(([ms, fn]) => window.setTimeout(fn, ms));
  };

  useEffect(() => {
    // Times are set on the client so the first paint matches the server.
    const now = Date.now();
    const t = window.setTimeout(() => {
      setRun({ status: "building", createdAt: now - 41_000, startedAt: now - 34_000 });
      setPast({ ready: now - 3 * 3_600_000, error: now - 26 * 3_600_000 });
    }, 0);
    timers.current = [window.setTimeout(() => setRun((r) => ({ ...r, status: "ready", finishedAt: Date.now() })), 7000)];
    return () => {
      clearTimeout(t);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const redeploy = () => {
    const created = Date.now();
    setRun({ status: "queued", createdAt: created });
    schedule([
      [2200, () => setRun((r) => ({ ...r, status: "building", startedAt: Date.now() }))],
      [9800, () => setRun((r) => ({ ...r, status: "ready", finishedAt: Date.now() }))],
    ]);
  };

  const busy = run.status === "queued" || run.status === "building";

  return (
    <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-11 items-center justify-between border-b border-line pl-4 pr-2">
        <span className="text-[13px] font-medium tracking-[-0.01em]">Deployments</span>
        <button
          type="button"
          onClick={redeploy}
          disabled={busy}
          className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale,opacity] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-50"
        >
          Redeploy
        </button>
      </div>
      <div className="divide-y divide-line">
        <DeployStatus
          status={run.status}
          environment="Production"
          commit={{ message: "Fix invoice rounding for EUR totals", sha: "4f2a9c1e8b7d", branch: "main", author: "Maya Okafor" }}
          createdAt={run.createdAt}
          startedAt={run.startedAt}
          finishedAt={run.finishedAt}
          logsHref="#logs"
        />
        <DeployStatus
          status="ready"
          environment="Preview"
          commit={{ message: "Add seat-based pricing to the plan picker", sha: "b81e03d9a4c2", branch: "feat/seat-pricing", author: "Jonas Weber" }}
          createdAt={past.ready}
          startedAt={past.ready}
          finishedAt={past.ready ? past.ready + 52_000 : undefined}
          logsHref="#logs"
        />
        <DeployStatus
          status="error"
          environment="Preview"
          commit={{ message: "Move billing webhooks to the queue worker", sha: "e0c47a1f93b6", branch: "chore/webhook-queue", author: "Priya Raman" }}
          createdAt={past.error}
          startedAt={past.error}
          finishedAt={past.error ? past.error + 19_000 : undefined}
          error="Type error in lib/billing/queue.ts:42 — Property 'retryAt' does not exist on type 'Job'."
          logsHref="#logs"
        />
      </div>
    </div>
  );
}
