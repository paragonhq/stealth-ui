"use client";
import { useState } from "react";
import { Refresh } from "@/lib/icons";
import { BranchSwitcher, BranchSwitcherContent, BranchSwitcherControl } from "@/components/ui/branch-switcher";

const drafts = [
  "Checkout latency is back to normal. The 14:02 deploy moved session reads to Postgres without an index; we added it at 15:40 and p95 dropped from 410 ms to 175 ms.",
  "Resolved: checkout was slow for 98 minutes on Tuesday.\n\nCause: session lookups hit an unindexed Postgres table after api@4.18.0.\nFix: index on sessions.token_hash, shipped 15:40.\nFollow-up: restore the Redis cache layer this sprint.",
  "Short version for the channel: checkout slowed down after Tuesday’s deploy, it’s fixed, and nothing was lost.",
  "Heads up, team: Tuesday’s checkout slowdown is fixed. A missing index made every session read scan the table. p95 is 175 ms again, and the cache layer comes back this sprint.",
];

// Three takes on the same status update. Regenerate adds a fourth and the switcher follows it.
export default function Demo() {
  const [count, setCount] = useState(3);

  return (
    <div className="flex min-h-[340px] w-full max-w-[460px] flex-col justify-start gap-4 text-[13px] leading-[1.6]">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-line bg-raised px-3 py-2 text-fg">
        Draft a status update about the checkout incident for #eng
      </div>

      <BranchSwitcher count={count} defaultValue={1} className="flex flex-col gap-1.5">
        <BranchSwitcherContent>
          {(i) => (
            <div className="flex flex-col gap-2 text-pretty text-fg">
              {drafts[i].split("\n\n").map((p, j) => (
                <p key={j} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          )}
        </BranchSwitcherContent>

        <div className="-ms-1 flex items-center gap-1">
          <BranchSwitcherControl />
          <span aria-hidden className="mx-1.5 h-3.5 w-px bg-line-2" />
          <button
            type="button"
            disabled={count >= drafts.length}
            onClick={() => setCount((c) => Math.min(drafts.length, c + 1))}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50"
          >
            <Refresh size={14} />
            Regenerate
          </button>
        </div>
      </BranchSwitcher>
    </div>
  );
}
