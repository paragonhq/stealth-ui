"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Volume } from "@/lib/icons";
import {
  MessageActionCopy,
  MessageActionFeedback,
  MessageActionRegenerate,
  MessageActions,
  MessageActionShare,
  MessageActionsMenuItem,
  MessageActionsMenuSeparator,
  MessageActionsMore,
} from "@/components/ui/message-actions";

const earlier = "The deploy on Tuesday 14:02 shipped `api@4.18.0`, which moved session lookups from Redis to Postgres.";
const latest = [
  "p95 on `/v1/checkout` went from 180 ms to 410 ms right after that deploy. Two things line up:",
  "1. Session reads now hit Postgres on every request instead of the cache.",
  "2. The `sessions` table has no index on `token_hash`, so each read is a sequential scan.",
  "Adding the index and restoring the cache layer should bring p95 back under 200 ms.",
].join("\n");

// A reply you can copy, rate, regenerate and act on. The earlier reply only shows its row on hover.
export default function Demo() {
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-5 text-[13px] leading-[1.6] text-fg">
      <div data-message className="flex flex-col gap-1">
        <p className="text-pretty text-fg-2">{render(earlier)}</p>
        <MessageActions reveal="hover" className="-ms-1.5">
          <MessageActionCopy value={earlier} />
          <MessageActionFeedback />
        </MessageActions>
      </div>

      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md border border-line bg-raised px-3 py-2 text-fg">Why did checkout get slower after that?</div>

      <div data-message className="flex flex-col gap-1">
        <div className={busy ? "opacity-40 transition-opacity duration-200" : "transition-opacity duration-200"} aria-busy={busy || undefined}>
          {latest.split("\n").map((line, i) => (
            <p key={i} className={i > 0 && i < 3 ? "pl-4 -indent-4 text-pretty" : "text-pretty"}>
              {render(line)}
            </p>
          ))}
        </div>
        <MessageActions className="-ms-1.5">
          <MessageActionCopy value={latest} />
          <MessageActionRegenerate
            busy={busy}
            onRegenerate={() => {
              setBusy(true);
              timer.current = window.setTimeout(() => setBusy(false), 1800);
            }}
          />
          <MessageActionFeedback
            reasons={["Not accurate", "Missed the question", "Too long", "Outdated", "Unsafe"]}
          />
          <MessageActionShare />
          <MessageActionsMore>
            <MessageActionsMenuItem icon={<Volume />}>Read aloud</MessageActionsMenuItem>
            <MessageActionsMenuItem icon={<GitBranch />}>Branch in new chat</MessageActionsMenuItem>
            <MessageActionsMenuItem icon={<Bookmark />}>Save to notes</MessageActionsMenuItem>
            <MessageActionsMenuSeparator />
            <MessageActionsMenuItem icon={<Flag />} variant="danger">
              Report
            </MessageActionsMenuItem>
          </MessageActionsMore>
          <span className="ms-auto hidden pe-1 text-[11.5px] text-fg-4 sm:inline">Atlas 2 · 4.2s</span>
        </MessageActions>
      </div>
    </div>
  );
}

// Just enough markdown for the demo: `code` spans.
function render(line: string) {
  return line.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") ? (
      <code key={i} className="rounded-[4px] border border-line bg-raised px-1 py-px font-mono text-[12px] text-fg">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

// Same 16px grid and stroke as the shared icon set.
function GitBranch() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="4.5" cy="3.75" r="1.5" />
      <circle cx="4.5" cy="12.25" r="1.5" />
      <circle cx="11.5" cy="5.25" r="1.5" />
      <path d="M4.5 5.25v5.5M11.5 6.75c0 2.5-2 3.25-4.5 3.5-1.2.1-2.1.6-2.5 1.1" />
    </svg>
  );
}

function Flag() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.75 13.5V2.75M3.75 3.25h7.5l-1.5 2.75 1.5 2.75h-7.5" />
    </svg>
  );
}
