"use client";
import { useEffect, useRef, useState } from "react";
import { AgentPlan, type PlanStep } from "@/components/ui/agent-plan";

const s = (id: string, label: string, status: PlanStep["status"], extra?: Partial<PlanStep>): PlanStep => ({ id, label, status, ...extra });

const migration = (a: PlanStep["status"], b: PlanStep["status"], c: PlanStep["status"], detail?: string) => [
  s("m1", "Create the usage_events table", a),
  s("m2", "Add indexes on workspace and period", b),
  s("m3", "Backfill from last quarter’s invoices", c, { detail }),
];

// The agent works through a billing change, a test fails, and it rewrites its
// own plan: a fix step appears and the test step is renamed to a rerun.
const frames: PlanStep[][] = [
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "active", { substeps: migration("done", "active", "pending") }),
    s("job", "Update the nightly invoice job", "pending"),
    s("tests", "Run the billing tests", "pending"),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "active", { substeps: migration("done", "done", "active", "48 of 212 workspaces") }),
    s("job", "Update the nightly invoice job", "pending"),
    s("tests", "Run the billing tests", "pending"),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "active", { substeps: migration("done", "done", "active", "161 of 212 workspaces") }),
    s("job", "Update the nightly invoice job", "pending"),
    s("tests", "Run the billing tests", "pending"),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "active", { detail: "src/jobs/invoice.ts" }),
    s("tests", "Run the billing tests", "pending"),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "done"),
    s("tests", "Run the billing tests", "active", { detail: "38 of 64 passed" }),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "done"),
    s("tests", "Run the billing tests", "failed", { detail: "2 failing: proration rounds down on partial months" }),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "done"),
    s("fix", "Round proration to the nearest cent", "active", { detail: "src/billing/prorate.ts" }),
    s("tests", "Rerun the billing tests", "pending"),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "done"),
    s("fix", "Round proration to the nearest cent", "done"),
    s("tests", "Rerun the billing tests", "active", { detail: "64 tests" }),
    s("pr", "Open a pull request", "pending"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "done"),
    s("fix", "Round proration to the nearest cent", "done"),
    s("tests", "Rerun the billing tests", "done"),
    s("pr", "Open a pull request", "active"),
  ],
  [
    s("read", "Read the current billing schema", "done"),
    s("migrate", "Write the migration", "done", { substeps: migration("done", "done", "done") }),
    s("job", "Update the nightly invoice job", "done"),
    s("fix", "Round proration to the nearest cent", "done"),
    s("tests", "Rerun the billing tests", "done"),
    s("pr", "Open a pull request", "done"),
  ],
];

export default function Demo() {
  const root = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [visible, setVisible] = useState(false);

  // Plays only while on screen; stops on the last frame.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || frame >= frames.length - 1) return;
    const t = window.setTimeout(() => setFrame((f) => f + 1), frame === 5 ? 2200 : 1500);
    return () => window.clearTimeout(t);
  }, [visible, frame]);

  const finished = frame === frames.length - 1;

  return (
    <div ref={root} className="flex w-full max-w-[440px] flex-col gap-2">
      <AgentPlan title="Usage-based billing" steps={frames[frame]} />
      <div className="flex h-7 items-center justify-between px-1">
        <p className="text-[12px] text-fg-3">{finished ? "Done. Steps with substeps still open on press." : "The agent rewrites its plan as it learns."}</p>
        <button
          type="button"
          onClick={() => setFrame(0)}
          className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Replay
        </button>
      </div>
    </div>
  );
}
