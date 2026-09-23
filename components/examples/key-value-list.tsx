"use client";
import { useState } from "react";
import { KeyValue, KeyValueList, KeyValueStatus } from "@/components/ui/key-value-list";

// The details panel beside a deployment: IDs to copy, a status, a link, and a field you can fix in place.
export default function Demo() {
  const [description, setDescription] = useState("Checkout redesign, phase 2");
  const [owner, setOwner] = useState("payments-team");

  return (
    <section aria-labelledby="deploy-title" className="w-full max-w-[440px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 id="deploy-title" className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">checkout-web</h3>
          <p className="text-[12px] text-fg-3">Production deployment</p>
        </div>
        <KeyValueStatus tone="success" live className="shrink-0 text-[12.5px]">Serving traffic</KeyValueStatus>
      </header>
      <KeyValueList className="px-4 py-1" labelWidth={116}>
        <KeyValue label="Deployment ID" mono truncate="middle" copyValue="dpl_8fK2mQx7Rz4VbN1c9Ta9c">
          dpl_8fK2mQx7Rz4VbN1c9Ta9c
        </KeyValue>
        <KeyValue label="Status">
          <KeyValueStatus tone="success">Ready</KeyValueStatus>
        </KeyValue>
        <KeyValue label="Domain" href="https://checkout.example.com" copyValue="https://checkout.example.com">
          checkout.example.com
        </KeyValue>
        <KeyValue label="Commit" mono copyValue="a41f9c2e07b1">
          a41f9c2 · main
        </KeyValue>
        <KeyValue label="Description" onSave={(next) => wait(700).then(() => setDescription(next))} validate={(v) => (v ? null : "Enter a description")}>
          {description}
        </KeyValue>
        <KeyValue
          label="Owner"
          mono
          onSave={(next) => wait(600).then(() => (/\s/.test(next) ? Promise.reject(new Error("taken")) : setOwner(next)))}
        >
          {owner}
        </KeyValue>
        <KeyValue label="Created">
          <span title="22 Sep 2026, 16:36 UTC">4m ago by Maya Lin</span>
        </KeyValue>
        <KeyValue label="Build cache" />
      </KeyValueList>
    </section>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
