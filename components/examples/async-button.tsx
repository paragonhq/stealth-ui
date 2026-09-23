"use client";
import { useRef, useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Three speeds a real request comes back at: normal, failing, and faster than a spinner.
export default function Demo() {
  const [name, setName] = useState("Northwind Labs");
  const [deployError, setDeployError] = useState<string | null>(null);
  const attempts = useRef(0);

  return (
    <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <label htmlFor="ws-name" className="text-[12px] text-fg-2">Workspace name</label>
        <div className="flex items-center gap-2">
          <input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-line-2 bg-frame px-2.5 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-2 focus:ring-fg/10 sm:text-[13px]"
          />
          <AsyncButton onClick={() => wait(1100)}>Save changes</AsyncButton>
        </div>
      </form>

      <div className="flex items-center gap-3 border-t border-line p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Deploy to production</p>
          {/* The error replaces the meta line, right beside the button that failed. */}
          <p role="alert" className={deployError ? "text-[12px] text-danger" : "truncate font-mono text-[11px] leading-[18px] text-fg-3"}>
            {deployError ?? "main · 4f2a91c · 2 min ago"}
          </p>
        </div>
        <AsyncButton
          variant="secondary"
          pendingLabel="Deploying…"
          successLabel="Deployed"
          onClick={async () => {
            setDeployError(null);
            await wait(1400);
            // Every other attempt fails, so the error and the retry can both be seen.
            if (attempts.current++ % 2 === 0) throw new Error("Couldn’t deploy: the runner timed out");
          }}
          onError={(e) => setDeployError(e instanceof Error ? e.message : "Couldn’t deploy.")}
        >
          Deploy
        </AsyncButton>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-frame/50 px-4 py-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2">MO</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] text-fg">maya.okafor@northwind.dev</p>
          <p className="text-[11px] text-fg-3">Invite pending</p>
        </div>
        {/* Answers in 80ms: no spinner flash, straight to the tick. */}
        <AsyncButton size="sm" variant="secondary" successLabel="Sent" onClick={() => wait(80)}>
          Resend
        </AsyncButton>
      </div>
    </div>
  );
}
