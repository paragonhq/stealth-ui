"use client";
import { Callout, CalloutAction } from "@/components/ui/callout";

const stale = ["STRIPE_WEBHOOK_SECRET", "SENTRY_AUTH_TOKEN", "S3_ARCHIVE_KEY"];

// Three notes on an environment settings page, from a gentle tip to a hard stop.
export default function Demo() {
  return (
    <section className="flex w-full max-w-[500px] flex-col gap-3 rounded-2xl border border-line bg-frame p-4">
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Environment variables</h3>
        <span className="font-mono text-[11.5px] text-fg-3">staging</span>
      </header>
      <Callout
        tone="warning"
        title="3 variables point to deleted secrets"
        action={<CalloutAction>Review variables</CalloutAction>}
        details={
          <ul className="flex flex-col gap-1">
            {stale.map((name) => (
              <li key={name} className="flex items-center justify-between gap-3">
                <code className="truncate font-mono text-[12px] text-fg">{name}</code>
                <span className="shrink-0 text-[12px] text-fg-3">Deleted 2 Sep</span>
              </li>
            ))}
          </ul>
        }
      >
        Deploys read them as empty until you link a new secret.
      </Callout>

      <Callout tone="tip" size="sm">
        Prefix a name with <code className="font-mono text-[11.5px] text-fg">PUBLIC_</code> to expose it to the browser. Everything else stays on the server.
      </Callout>

      <Callout tone="danger" title="Deleting staging can’t be undone">
        It removes 24 variables, 3 domains and 90 days of deploy history for everyone on the team.
      </Callout>
    </section>
  );
}
