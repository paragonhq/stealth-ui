"use client";
import { useEffect, useRef, useState } from "react";
import { AgentStatus, type AgentRunStatus } from "@/components/ui/agent-status";

const steps = ["Read the auth module", "Map every session call", "Swap cookies for tokens", "Update the middleware", "Migrate the tests", "Run the test suite", "Open a pull request"];

type Run = { status: AgentRunStatus; step: number; startedAt?: number; endedAt?: number };

// Two agents in the background of an app's top bar: one working through a
// refactor (it finishes with a tick), one parked on a question for you.
export default function Demo() {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [run, setRun] = useState<Run>({ status: "running", step: 4 });
  const [waitingSince, setWaitingSince] = useState<number>();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Timestamps only exist on the client, so nothing time-based is in the server HTML.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setRun((r) => (r.startedAt ? r : { ...r, startedAt: Date.now() - 133_000 }));
      setWaitingSince(Date.now() - 48_000);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // Advances a step every few seconds while on screen, then finishes.
  useEffect(() => {
    if (!visible || run.status !== "running") return;
    const t = window.setTimeout(() => {
      setRun((r) => (r.step < steps.length ? { ...r, step: r.step + 1 } : { ...r, status: "done", endedAt: Date.now() }));
    }, 2600);
    return () => window.clearTimeout(t);
  }, [visible, run.status, run.step]);

  return (
    <div ref={root} className="flex w-full max-w-[520px] flex-col gap-3">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-line bg-frame px-3 py-2">
        <span className="mr-auto flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className="text-fg-3">acme</span>
          <span className="text-fg-4">/</span>
          <span className="truncate font-medium text-fg">web</span>
        </span>
        <AgentStatus
          status={run.status}
          title="Move sessions to signed tokens"
          step={run.step}
          totalSteps={steps.length}
          currentStep={steps[run.step - 1]}
          startedAt={run.startedAt}
          endedAt={run.endedAt}
          onStop={() => setRun((r) => ({ ...r, status: "stopped", endedAt: Date.now() }))}
          actions={<DemoAction>{run.status === "done" ? "Review changes" : "View run"}</DemoAction>}
        />
        <AgentStatus
          status="waiting"
          title="Draft the October changelog"
          step={2}
          totalSteps={3}
          currentStep="Which release should it cover: 4.2 or 4.2.1?"
          startedAt={waitingSince}
          actions={<DemoAction>Answer</DemoAction>}
        />
      </div>
      <div className="flex h-7 items-center justify-between px-1">
        <p className="text-[12px] text-fg-3">Press a pill for the details.</p>
        <button
          type="button"
          onClick={() => setRun({ status: "running", step: 4, startedAt: Date.now() - 133_000 })}
          className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Replay
        </button>
      </div>
    </div>
  );
}

function DemoAction({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-7 items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
    >
      {children}
    </button>
  );
}
