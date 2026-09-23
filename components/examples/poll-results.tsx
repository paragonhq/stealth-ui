"use client";
import { useState } from "react";
import { PollResults } from "@/components/ui/poll-results";

const options = [
  { id: "postgres", label: "Postgres", votes: 412 },
  { id: "dynamo", label: "DynamoDB", votes: 180 },
  { id: "cockroach", label: "CockroachDB", votes: 96 },
  { id: "sqlite", label: "SQLite with Litestream replication", votes: 38 },
];

// An engineering-wide poll in a team thread. Go offline to see a vote fail and roll back.
export default function Demo() {
  const [offline, setOffline] = useState(false);

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center gap-2 text-[12px] text-fg-3">
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full bg-fg/10 text-[10px] font-medium text-fg-2"
        >
          MO
        </span>
        <span className="text-fg-2">Maya Okafor</span>
        <span>· #platform</span>
      </div>
      <PollResults
        question="Which database should the new billing service use?"
        options={options}
        meta="2 days left"
        onVote={() =>
          new Promise((resolve, reject) =>
            window.setTimeout(
              () => (offline ? reject(new Error("offline")) : resolve(null)),
              700,
            ),
          )
        }
      />
      <div className="-mx-4 mt-3 border-t border-line px-4 pt-3">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] text-fg-3 select-none">
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => setOffline(e.target.checked)}
            className="size-3.5 cursor-pointer accent-current"
          />
          Simulate a failed request
        </label>
      </div>
    </div>
  );
}
