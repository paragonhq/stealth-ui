"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Bell, Lock } from "@/lib/icons";
import { Badge, BadgeCount, BadgeDot, type BadgeTone } from "@/components/ui/badge";

type Stage = { label: string; tone: BadgeTone; pulse?: boolean };
const stages: Stage[] = [
  { label: "Queued", tone: "neutral" },
  { label: "Building", tone: "info", pulse: true },
  { label: "Deploying", tone: "warning", pulse: true },
  { label: "Ready", tone: "success" },
];

const button = cn(
  "inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
);

// A deploy whose status badge walks through its stages, a notification count, and labels in a list.
export default function Demo() {
  const [stage, setStage] = useState(-1);
  const [unread, setUnread] = useState(3);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const current = stages[Math.max(0, stage)];
  const running = stage >= 0 && stage < stages.length - 1;

  const deploy = () => {
    window.clearTimeout(timer.current);
    let i = 0;
    setStage(0);
    const next = () => {
      i++;
      setStage(i);
      if (i < stages.length - 1) timer.current = window.setTimeout(next, 1300);
    };
    timer.current = window.setTimeout(next, 900);
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
              <span className="truncate">stealth-web</span>
              <Badge size="sm" variant="outline">Production</Badge>
            </p>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-3">main · 8f3c2a1 · Fix invoice rounding</p>
          </div>
          <Badge tone={current.tone} dot pulse={current.pulse} aria-live="polite">
            {stage < 0 ? "Idle" : current.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
            <BadgeDot tone="success" /> All systems normal
          </span>
          <button type="button" className={cn(button, "min-w-[78px] justify-center")} onClick={deploy}>
            {running ? "Restart" : stage === stages.length - 1 ? "Redeploy" : "Deploy"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3.5 rounded-xl border border-line bg-raised px-3 py-3 shadow-[var(--shadow)] [--badge-ring:var(--raised)]">
        <BadgeCount count={unread} tone="danger" label={(n) => `${n} unread`}>
          <button
            type="button"
            aria-label={`Notifications, ${unread} unread`}
            onClick={() => setUnread(0)}
            className={cn(
              "grid size-8 place-items-center rounded-lg text-fg-2",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.94] active:duration-75",
            )}
          >
            <Bell />
          </button>
        </BadgeCount>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-fg">Inbox</p>
          <p className="truncate text-[12px] text-fg-3">Open it to mark everything read</p>
        </div>
        <button type="button" className={button} onClick={() => setUnread((n) => (n >= 99 ? n + 23 : n + 1))}>
          New message
        </button>
      </div>

      <ul className="flex flex-col rounded-xl border border-line bg-raised py-1 shadow-[var(--shadow)]">
        {[
          { name: "Billing API", badges: <Badge tone="danger" size="sm">Degraded</Badge> },
          { name: "Audit log", badges: <Badge size="sm" icon={<Lock />}>Enterprise</Badge> },
          { name: "Webhooks v2", badges: <Badge size="sm" variant="solid">New</Badge> },
        ].map((row) => (
          <li key={row.name} className="flex h-10 items-center justify-between gap-3 px-3.5 text-[13px] text-fg">
            <span className="truncate">{row.name}</span>
            {row.badges}
          </li>
        ))}
      </ul>
    </div>
  );
}
