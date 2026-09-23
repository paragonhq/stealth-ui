"use client";
import { useEffect, useRef, useState } from "react";
import { RunLog, type LogLevel, type LogStep } from "@/components/ui/run-log";

type Script = { id: string; label: string; lines: [LogLevel, string][] };

// A production deploy, told the way a runner would print it.
const script: Script[] = [
  {
    id: "install",
    label: "Install dependencies",
    lines: [
      ["info", "npm ci --prefer-offline"],
      ["debug", "cache hit: node_modules (sha256:8c41…e2f0)"],
      ["info", "added 1,284 packages in 11.2s"],
      ["warn", "deprecated inflight@1.0.6: leaks memory, use lru-cache"],
      ["info", "212 packages are looking for funding"],
    ],
  },
  {
    id: "build",
    label: "Build web@4f2a1c9",
    lines: [
      ["info", "next build"],
      ["info", "Creating an optimized production build …"],
      ["info", "Compiled 418 modules in 24.8s"],
      ["warn", "Image with src “/og/q3-forecast.png” has no width or height"],
      ["info", "Collecting page data"],
      ["info", "Generating static pages (86/86)"],
      ["info", "Route (app)                     Size     First load JS"],
      ["info", "┌ ○ /                           4.1 kB          96 kB"],
      ["info", "├ ○ /billing                    7.8 kB         103 kB"],
      ["info", "└ ƒ /api/invoices               0 B              0 B"],
    ],
  },
  {
    id: "migrate",
    label: "Run migrations",
    lines: [
      ["info", "prisma migrate deploy --schema ./db/schema.prisma"],
      ["info", "3 migrations found in prisma/migrations"],
      ["info", "Applying 20260921_add_usage_events …"],
      ["error", "ECONNRESET: connection to db-primary.internal:5432 reset by peer"],
      ["warn", "Retrying in 2s (attempt 2 of 3)"],
      ["info", "Applying 20260921_add_usage_events … done in 812ms"],
      ["info", "Applying 20260922_index_usage_by_period … done in 1.9s"],
      ["info", "Applying 20260922_backfill_usage … done in 4.3s"],
      ["info", "All migrations applied"],
    ],
  },
  {
    id: "deploy",
    label: "Deploy to production",
    lines: [
      ["info", "Uploading build output (38.2 MB)"],
      ["info", "Promoting 4f2a1c9 across 3 regions"],
      ["info", "iad1 healthy · fra1 healthy · sin1 healthy"],
      ["info", "Live at https://app.acme.dev"],
    ],
  },
];

const count = script.reduce((n, s) => n + s.lines.length, 0);

// Builds the log as it stood after `n` lines had printed, with steady fake timings.
function snapshot(n: number): { steps: LogStep[]; done: boolean } {
  let printed = 0;
  let t = 0;
  const steps: LogStep[] = script.map((s) => {
    const start = t;
    const lines = s.lines.slice(0, Math.max(0, n - printed)).map(([level, text], i) => {
      t += level === "debug" ? 40 : 380 + ((i * 257) % 900);
      return { id: `${s.id}-${i}`, time: t, level, text };
    });
    const finished = n - printed >= s.lines.length;
    printed += s.lines.length;
    const status: LogStep["status"] = finished ? "done" : lines.length ? "running" : "pending";
    return { id: s.id, label: s.label, status, lines, duration: finished ? t - start : undefined };
  });
  // The step after the last finished one is running even before its first line.
  const firstOpen = steps.findIndex((s) => s.status !== "done");
  if (firstOpen >= 0 && steps[firstOpen].status === "pending") steps[firstOpen].status = "running";
  return { steps, done: n >= count };
}

export default function Demo() {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [n, setN] = useState(8);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Prints a line every half second or so while on screen.
  useEffect(() => {
    if (!visible || n >= count) return;
    const t = window.setTimeout(() => setN((x) => x + 1), 380 + ((n * 173) % 520));
    return () => window.clearTimeout(t);
  }, [visible, n]);

  const { steps, done } = snapshot(n);

  return (
    <div ref={root} className="flex w-full max-w-[560px] flex-col gap-2">
      <RunLog title="Deploy web to production" steps={steps} streaming={!done} height={300} />
      <div className="flex h-7 items-center justify-between px-1">
        <p className="text-[12px] text-fg-3">{done ? "Deployed. Steps fold as they finish." : "Scroll up to stop following."}</p>
        <button
          type="button"
          onClick={() => setN(8)}
          className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Replay
        </button>
      </div>
    </div>
  );
}
