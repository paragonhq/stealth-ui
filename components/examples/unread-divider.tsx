"use client";
import { useState } from "react";
import { UnreadDivider } from "@/components/ui/unread-divider";

type Msg = { id: number; who: string; time: string; text: string };

const read: Msg[] = [
  { id: 1, who: "Priya Shah", time: "9:02", text: "Morning. Staging is green again after the cache fix." },
  { id: 2, who: "Jonas Weber", time: "9:05", text: "Nice. Are we still cutting the release at noon?" },
  { id: 3, who: "Priya Shah", time: "9:06", text: "Yes, unless the billing migration slips." },
  { id: 4, who: "Maya Chen", time: "9:14", text: "Billing is on track. I’ll post the dry-run numbers in a bit." },
];
const unread: Msg[] = [
  { id: 5, who: "Maya Chen", time: "10:31", text: "Dry run finished: 18,402 invoices migrated, 3 flagged for review." },
  { id: 6, who: "Maya Chen", time: "10:32", text: "The flagged ones are all annual plans with mid-cycle upgrades." },
  { id: 7, who: "Jonas Weber", time: "10:40", text: "I can take those after standup." },
];
const incoming: Msg[] = [
  { id: 8, who: "Priya Shah", time: "10:44", text: "Thanks. Pushing the release cut to 1pm to be safe." },
  { id: 9, who: "Sam Okafor", time: "10:46", text: "Release notes draft is in the doc, comments welcome." },
  { id: 10, who: "Maya Chen", time: "10:47", text: "Looks good to me." },
];

function Message({ m }: { m: Msg }) {
  return (
    <li className="flex gap-2.5 px-4 py-1.5">
      <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-fg/[0.08] text-[11px] font-medium text-fg-2">
        {m.who.split(" ").map((p) => p[0]).join("")}
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-fg">{m.who}</span>
          <span className="text-[11px] text-fg-3 tabular">{m.time}</span>
        </p>
        <p className="text-[13px] leading-[1.45] text-fg-2 text-pretty">{m.text}</p>
      </div>
    </li>
  );
}

export default function Demo() {
  const [round, setRound] = useState(0);
  const [extra, setExtra] = useState(0);
  const [seen, setSeen] = useState(false);
  const fresh = [...unread, ...incoming.slice(0, extra)];

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-11 items-center gap-2 border-b border-line px-4">
          <span className="text-[13px] font-medium text-fg"># release</span>
          <span className="text-[12px] text-fg-3">4 members</span>
        </div>
        <ul key={round} aria-label="Messages in release" tabIndex={0} className="h-[300px] overflow-y-auto overscroll-contain py-2 outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3">
          <li className="flex items-center gap-3 px-4 py-2" role="presentation">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Today</span>
            <span className="h-px flex-1 bg-line" />
          </li>
          {read.map((m) => (
            <Message key={m.id} m={m} />
          ))}
          <li className="px-4">
            <UnreadDivider count={fresh.length} scrollOnMount onSeenChange={setSeen} />
          </li>
          {fresh.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <p className="text-[12px] text-fg-3" aria-live="polite">
          {seen ? "Marked as read" : "Clears 3s after it’s seen"}
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={seen || extra >= incoming.length}
            onClick={() => setExtra((n) => n + 1)}
            className="h-7 rounded-md px-2 text-[12px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            Receive one
          </button>
          <button
            type="button"
            onClick={() => {
              setRound((r) => r + 1);
              setExtra(0);
              setSeen(false);
            }}
            className="h-7 rounded-md border border-line-2 bg-raised px-2 text-[12px] text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            Mark unread
          </button>
        </div>
      </div>
    </div>
  );
}
