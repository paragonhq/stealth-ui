"use client";
import { useState } from "react";
import { Bolt, Code, CreditCard, Tag } from "@/lib/icons";
import { CheckboxCard, CheckboxCardGroup } from "@/components/ui/checkbox-card";

const events = [
  { value: "deployments", title: "Deployments", description: "Created, succeeded, failed or canceled", icon: <Bolt /> },
  { value: "pull-requests", title: "Pull requests", description: "Opened, merged or closed on any repository", icon: <Code /> },
  { value: "releases", title: "Releases", description: "Published tags with their changelog", icon: <Tag />, badge: "Beta" },
];

// Choosing which events a webhook sends: select-all, a count that rolls, and a
// card the current role can't turn on.
export default function Demo() {
  const [value, setValue] = useState<string[]>(["deployments"]);

  return (
    <div className="w-full max-w-[540px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-3.5">
        <h3 id="events-title" className="text-[14px] font-medium tracking-[-0.015em] text-fg">Events to send</h3>
        <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-3">POST https://api.northwind.dev/hooks/ship</p>
      </div>
      <CheckboxCardGroup
        aria-labelledby="events-title"
        value={value}
        onValueChange={setValue}
        allValues={events.map((e) => e.value)}
        selectAll
        selectAllLabel="All events"
      >
        {events.map((e) => (
          <CheckboxCard key={e.value} {...e} />
        ))}
        <CheckboxCard
          value="billing"
          disabled
          title="Billing"
          description="Only workspace owners can send invoices"
          icon={<CreditCard />}
        />
      </CheckboxCardGroup>
    </div>
  );
}
