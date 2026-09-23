"use client";
import { useEffect, useRef, useState } from "react";
import { Bolt, CircleCheck, Message, Refresh, Users, Warning } from "@/lib/icons";
import { Timeline, useNow, type TimelineEvent } from "@/components/ui/timeline";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=64&h=64&fit=crop&crop=faces&q=70`;
const min = 60000;

type Seed = Omit<TimelineEvent, "date"> & { ago: number };

// An incident's history: resolved minutes ago, opened yesterday's deploy. "Post update" adds
// what the on-call would post next, so you can watch new events arrive at the top.
const seed: Seed[] = [
  {
    id: "resolved",
    ago: 3 * min,
    icon: <CircleCheck />,
    tone: "success",
    title: (
      <>
        <b>Maya Okafor</b> resolved the incident
      </>
    ),
    description: "Error rate under 0.1% for 15 minutes across all regions.",
  },
  {
    id: "rollback",
    ago: 18 * min,
    icon: <Refresh />,
    tone: "info",
    title: (
      <>
        Rollback to <b className="font-mono text-[12px]">v2.41.3</b> finished
      </>
    ),
    details: (
      <pre className="font-mono text-[11.5px] leading-[18px] whitespace-pre-wrap text-fg-2">
        {"✓ eu-west-1   healthy in 42s\n✓ us-east-1   healthy in 51s\n✓ ap-south-1  healthy in 1m 08s"}
      </pre>
    ),
  },
  {
    id: "ack",
    ago: 26 * min,
    actor: { name: "Leo Brandt", avatarSrc: photo("1507003211169-0a1dd7228f2d") },
    title: (
      <>
        <b>Leo Brandt</b> acknowledged
      </>
    ),
    description: "Looks like the promo service retry storm again. Rolling back first, then digging in.",
  },
  {
    id: "alert",
    ago: 31 * min,
    icon: <Warning />,
    tone: "danger",
    title: "Checkout p95 latency above 2s",
    details: "p95 reached 2.8s against a 2s threshold in 3 of 14 regions. Paged the payments on-call.",
  },
  {
    id: "deploy",
    ago: 21 * 60 * min,
    icon: <Bolt />,
    title: (
      <>
        <b>Priya Raghunathan-Castellanos</b> deployed <b className="font-mono text-[12px]">v2.42.0</b>
      </>
    ),
    description: "Promo code validation moved into the checkout service.",
  },
  {
    id: "rota",
    ago: 26 * 60 * min,
    icon: <Users />,
    title: "On-call rotation changed to Leo Brandt",
  },
];

const updates: Seed[] = [
  {
    id: "status",
    ago: 0,
    icon: <Message />,
    title: (
      <>
        <b>Tomás Ibarra</b> posted to the status page
      </>
    ),
    description: "“Checkout is working normally again. We’ll share a full write-up tomorrow.”",
  },
  {
    id: "postmortem",
    ago: 0,
    actor: { name: "Maya Okafor", avatarSrc: photo("1494790108377-be9c29b29330") },
    title: (
      <>
        <b>Maya Okafor</b> scheduled the postmortem
      </>
    ),
    description: "Thursday 10:00 with payments and support.",
  },
  {
    id: "followup",
    ago: 0,
    icon: <CircleCheck />,
    tone: "success",
    title: "Follow-up ENG-486 created",
    description: "Cap promo service retries at 3 with jitter.",
  },
];

const older: Seed[] = [
  {
    id: "runbook",
    ago: 4 * 24 * 60 * min,
    icon: <Message />,
    title: "Checkout runbook updated",
    description: "Added the rollback steps for the promo service.",
  },
  { id: "created", ago: 9 * 24 * 60 * min, icon: <Bolt />, title: "Service checkout-web created" },
];

export default function Demo() {
  const now = useNow();
  // Seeds are relative to the moment the page loaded on the client, so the demo never goes stale.
  const [base, setBase] = useState<number | null>(null);
  const [added, setAdded] = useState<TimelineEvent[]>([]);
  const [page, setPage] = useState<"one" | "loading" | "all">("one");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (now !== null && base === null) setBase(now);
  const at = (s: Seed): TimelineEvent => ({ ...s, date: (base ?? 0) - s.ago });
  const events = [...added, ...seed.map(at), ...(page === "all" ? older.map(at) : [])];
  const next = updates[added.length];

  return (
    <div className="flex h-[440px] w-full max-w-[460px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line pr-2.5 pl-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] leading-[18px] font-medium">
            <span className="font-mono text-[12px] font-normal text-fg-3">INC-214</span> Checkout latency
          </p>
        </div>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && setAdded((a) => [{ ...next, date: Date.now() }, ...a])}
          className="inline-flex h-7 shrink-0 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 ease-out select-none hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50"
        >
          Post update
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 [--timeline-surface:var(--raised)]">
        <Timeline
          events={base === null ? [] : events}
          loading={base === null}
          hasMore={page !== "all"}
          loadingMore={page === "loading"}
          onLoadMore={() => {
            setPage("loading");
            timer.current = window.setTimeout(() => setPage("all"), 900);
          }}
        />
      </div>
    </div>
  );
}
