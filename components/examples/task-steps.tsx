"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { TaskStep, TaskSteps, formatDuration, useElapsed, type TaskStepStatus } from "@/components/ui/task-steps";

type Plan = { label: string; plan: string; lines: string[]; done: string; ms: number };

const plan: Plan[] = [
  { label: "Provisioning build machine", plan: "4 vCPU runner, cached", lines: ["Allocating a 4 vCPU runner in iad1", "Restoring build cache · 318 MB"], done: "4 vCPU · cache restored", ms: 2000 },
  { label: "Installing dependencies", plan: "pnpm · 3 workspaces", lines: ["Resolving 1,284 packages", "Linking 3 workspaces"], done: "1,284 packages", ms: 2400 },
  { label: "Building", plan: "next build", lines: ["Compiling 412 modules", "Generating static pages · 38 of 38", "Optimizing 64 images"], done: "412 modules · 38 pages", ms: 3300 },
  { label: "Running checks", plan: "Types and 214 tests", lines: ["Type-checking", "Running 214 tests"], done: "214 tests passed", ms: 2200 },
  { label: "Deploying to edge", plan: "18 regions", lines: ["Uploading 96 files", "Propagating to 18 regions"], done: "Live in 18 regions", ms: 2200 },
];
const CHECKS = 3;

type Step = { status: TaskStepStatus; line: number; startedAt?: number; endedAt?: number };
const fresh = (): Step[] => plan.map(() => ({ status: "pending", line: 0 }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A production deploy: the first run fails its checks so the error, the retry
// and the skipped steps can all be seen; the retry goes through.
export default function Demo() {
  const [steps, setSteps] = useState<Step[]>(fresh);
  const [run, setRun] = useState<{ startedAt?: number; endedAt?: number }>({});
  const token = useRef(0);
  const attempts = useRef(0);
  const [canceled, setCanceled] = useState(false);

  const patch = (i: number, next: Partial<Step>) => setSteps((s) => s.map((step, j) => (j === i ? { ...step, ...next } : step)));

  const runFrom = async (from: number) => {
    const id = ++token.current;
    const live = () => token.current === id;
    const failThisTime = attempts.current++ === 0;
    setCanceled(false);
    setRun((r) => ({ startedAt: from === 0 ? Date.now() : r.startedAt }));
    setSteps((s) => s.map((step, j) => (j >= from ? { status: "pending", line: 0 } : step)));
    for (let i = from; i < plan.length; i++) {
      await sleep(i === from ? 250 : 180);
      if (!live()) return;
      patch(i, { status: "active", line: 0, startedAt: Date.now(), endedAt: undefined });
      const { lines, ms } = plan[i];
      for (let l = 0; l < lines.length; l++) {
        if (l) patch(i, { line: l });
        await sleep(ms / lines.length);
        if (!live()) return;
      }
      if (i === CHECKS && failThisTime) {
        patch(i, { status: "failed", endedAt: Date.now() });
        setSteps((s) => s.map((step, j) => (j > i ? { ...step, status: "skipped" } : step)));
        setRun((r) => ({ ...r, endedAt: Date.now() }));
        return;
      }
      patch(i, { status: "done", endedAt: Date.now() });
    }
    setRun((r) => ({ ...r, endedAt: Date.now() }));
  };

  const cancel = () => {
    token.current++;
    setSteps((s) => s.map((step) => (step.status === "active" ? { ...step, status: "skipped", endedAt: Date.now() } : step.status === "pending" ? { ...step, status: "skipped" } : step)));
    setRun((r) => ({ ...r, endedAt: Date.now() }));
    setCanceled(true);
  };

  useEffect(() => {
    const t = setTimeout(() => runFrom(0), 500);
    return () => {
      clearTimeout(t);
      token.current++;
    };
    // Starts once on mount; runFrom only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = steps.some((s) => s.status === "failed");
  const finished = steps.every((s) => s.status === "done");
  const state = canceled ? "canceled" : failed ? "failed" : finished ? "ready" : run.startedAt ? "building" : "queued";
  const busy = state === "building" || state === "queued";
  const total = useElapsed(run.startedAt, run.endedAt);

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13.5px] font-medium tracking-[-0.012em] text-fg">acme-web</p>
            <span className="rounded-md border border-line-2 px-1.5 py-px text-[10.5px] leading-[14px] text-fg-2">Production</span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-fg-3">main · 4f2a91c · Fix checkout rounding</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <StatusLabel state={state} />
          <span className="font-mono text-[11px] tabular text-fg-3" suppressHydrationWarning>
            {total != null ? formatDuration(total) : "—"}
          </span>
        </div>
      </div>

      <TaskSteps aria-label="Deploy acme-web to production" className="px-4 py-4">
        {plan.map((p, i) => {
          const s = steps[i];
          return (
            <TaskStep
              key={p.label}
              status={s.status}
              label={p.label}
              description={s.status === "done" ? p.done : s.status === "active" || s.status === "failed" ? p.lines[s.line] : p.plan}
              startedAt={s.startedAt}
              endedAt={s.endedAt}
              error={i === CHECKS ? "2 of 214 tests failed in checkout.test.ts. Fix them, or retry if they’re flaky." : undefined}
              action={
                <>
                  <button type="button" onClick={() => runFrom(CHECKS)} className={btn("secondary")}>
                    <RetryIcon />
                    Retry from checks
                  </button>
                  <button type="button" className={btn("ghost")}>
                    View logs
                  </button>
                </>
              }
            />
          );
        })}
      </TaskSteps>

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line px-4 py-2">
        <p className="min-w-0 text-pretty text-[12px] leading-[17px] text-fg-3">
          {finished ? (
            <>
              Live at <span className="text-fg-2">acme-web.app</span>
            </>
          ) : (
            "The previous deploy stays live until this one is ready"
          )}
        </p>
        {busy ? (
          <button type="button" onClick={cancel} className={cn(btn("ghost"), "shrink-0")}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              attempts.current = 1;
              runFrom(0);
            }}
            className={cn(btn("secondary"), "shrink-0")}
          >
            Redeploy
          </button>
        )}
      </div>
    </div>
  );
}

function StatusLabel({ state }: { state: "queued" | "building" | "ready" | "failed" | "canceled" }) {
  const text = { queued: "Queued", building: "Building", ready: "Ready", failed: "Failed", canceled: "Canceled" }[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        state === "ready" ? "text-success" : state === "failed" ? "text-danger" : "text-fg-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          state === "ready" ? "bg-success" : state === "failed" ? "bg-danger" : state === "building" ? "animate-pulse-soft bg-warning" : "bg-fg-4",
        )}
      />
      {text}
    </span>
  );
}

function btn(variant: "secondary" | "ghost") {
  return cn(
    "inline-flex h-7 select-none items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
    "disabled:pointer-events-none disabled:opacity-50",
    variant === "secondary" ? "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover" : "text-fg-2 hover:bg-hover hover:text-fg",
  );
}

function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
    </svg>
  );
}
