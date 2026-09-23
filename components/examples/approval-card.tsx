"use client";
import { useState } from "react";
import { ApprovalCard, type ApprovalDecision } from "@/components/ui/approval-card";

// Mid-run, the agent needs a migration applied to staging. An earlier request
// sits above it already answered, the way it would in the conversation.
export default function Demo() {
  const [round, setRound] = useState(0);
  const [decision, setDecision] = useState<ApprovalDecision>("pending");

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      <ApprovalCard title="Read environment variables" summary={<code className="font-mono text-[12px]">.env.example</code>} defaultDecision="allowed" risk="low" />

      <ApprovalCard
        key={round}
        // The first request waits quietly; asking again moves focus to it like a real one would.
        autoFocus={round > 0}
        title="Run a database migration"
        description={
          <>
            on <span className="font-mono text-[12px] text-fg">billing-staging</span>
          </>
        }
        risk="medium"
        riskReason="Alters the invoices table. Staging only; production is untouched."
        summary={<code className="font-mono text-[12px]">npm run db:migrate -- --env staging</code>}
        alwaysLabel="Always allow on staging"
        timeout={60000}
        onDecisionChange={setDecision}
      >
        <div className="flex h-9 min-w-0 items-center gap-2 overflow-x-auto rounded-md border border-line bg-frame px-2.5 font-mono text-[12px] text-fg">
          <span className="text-fg-4">$</span>
          <span className="whitespace-nowrap">npm run db:migrate -- --env staging</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-[12px]">
          {[
            ["Tables", "3 changed"],
            ["Rows", "48,210"],
            ["Estimate", "~40s"],
          ].map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-hover/60 px-2 py-1.5">
              <dt className="text-[11px] text-fg-3">{k}</dt>
              <dd className="truncate tabular text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </ApprovalCard>

      <div className="flex h-7 items-center justify-between px-1">
        <p className="text-[12px] text-fg-3">{decision === "pending" ? "Enter allows, Escape denies." : "The agent carries on with your answer."}</p>
        {decision !== "pending" && (
          <button
            type="button"
            onClick={() => {
              setDecision("pending");
              setRound((r) => r + 1);
            }}
            className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            Ask again
          </button>
        )}
      </div>
    </div>
  );
}
