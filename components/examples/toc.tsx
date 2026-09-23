"use client";
import { useRef } from "react";
import { TableOfContents, type TocItem } from "@/components/ui/toc";

const items: TocItem[] = [
  { id: "toc-overview", title: "Overview", level: 2 },
  { id: "toc-endpoint", title: "Create an endpoint", level: 2 },
  { id: "toc-verify", title: "Verify signatures", level: 2 },
  { id: "toc-secret", title: "Signing secret", level: 3 },
  { id: "toc-replay", title: "Replay protection", level: 3 },
  { id: "toc-retries", title: "Retries and backoff", level: 2 },
  { id: "toc-events", title: "Event types", level: 2 },
  { id: "toc-testing", title: "Test locally", level: 2 },
];

const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3 text-[13px] leading-[1.6] text-fg-2">{children}</p>;
const Code = ({ children }: { children: React.ReactNode }) => (
  <pre className="mb-3 overflow-x-auto rounded-lg border border-line bg-raised px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-fg-2">{children}</pre>
);
const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="mt-7 mb-2 text-[15px] font-medium tracking-[-0.015em] text-fg outline-none first:mt-0">
    {children}
  </h2>
);
const H3 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h3 id={id} className="mt-5 mb-1.5 text-[13.5px] font-medium tracking-[-0.01em] text-fg outline-none">
    {children}
  </h3>
);

// A docs page for webhooks, scrolling inside its own frame, with its contents beside it.
export default function Demo() {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="grid w-full max-w-[560px] grid-cols-1 overflow-hidden rounded-xl border border-line bg-frame sm:grid-cols-[minmax(0,1fr)_168px]">
      <TableOfContents
        items={items}
        root={scroller}
        offset={24}
        className="order-first max-h-[132px] overflow-y-auto border-b border-line px-4 py-3 sm:order-last sm:max-h-none sm:overflow-visible sm:border-b-0 sm:border-l sm:py-5 sm:pr-3 sm:pl-4"
      />
      <div ref={scroller} tabIndex={0} aria-label="Webhooks guide" className="h-[300px] overflow-y-auto overscroll-contain px-5 py-5 outline-none focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-4 focus-visible:outline-solid sm:h-[420px]">
        <H2 id="toc-overview">Overview</H2>
        <P>Webhooks tell your server when something happens in your account: an invoice is paid, a card is declined, a subscription renews. We send an HTTPS POST with a JSON body to the endpoint you choose.</P>
        <P>Delivery is at least once. Store the event ID and ignore any you have already handled.</P>

        <H2 id="toc-endpoint">Create an endpoint</H2>
        <P>Add an endpoint in Settings → Developers, or with the API. Choose only the events you need; every extra event is a request your server has to answer.</P>
        <Code>{`POST /v1/webhook_endpoints
{ "url": "https://api.northwind.io/hooks",
  "events": ["invoice.paid", "invoice.payment_failed"] }`}</Code>
        <P>Respond with a 2xx within 10 seconds. Do slow work after you respond, from a queue.</P>

        <H2 id="toc-verify">Verify signatures</H2>
        <P>Every request carries a Stealth-Signature header. Check it before trusting the body, or anyone who finds your URL can send you invoices.</P>
        <H3 id="toc-secret">Signing secret</H3>
        <P>Each endpoint has its own secret, shown once when you create it. Keep it in your secret manager, never in the repository. Rotating it keeps the old secret valid for 24 hours.</P>
        <Code>{`const event = webhooks.verify(body, signature, process.env.WEBHOOK_SECRET);`}</Code>
        <H3 id="toc-replay">Replay protection</H3>
        <P>The signature includes a timestamp. Reject requests more than five minutes old so a captured request can’t be sent again later.</P>

        <H2 id="toc-retries">Retries and backoff</H2>
        <P>If your endpoint doesn’t answer with a 2xx, we retry for three days: after 1 minute, 5 minutes, 30 minutes, 2 hours, then every 6 hours. After that the event is marked failed and you get an email.</P>
        <P>Endpoints that fail for 5 days straight are disabled. Turn them back on from the dashboard once the fix is out.</P>

        <H2 id="toc-events">Event types</H2>
        <P>invoice.paid, invoice.payment_failed, customer.created, customer.updated, subscription.renewed and subscription.canceled cover most integrations. The full list is in the API reference.</P>
        <P>Events are versioned with your account’s API version, so a new field never breaks a handler you already shipped.</P>

        <H2 id="toc-testing">Test locally</H2>
        <P>Forward events to your machine with the CLI, then trigger one to see the whole round trip.</P>
        <Code>{`stealth listen --forward-to localhost:3000/hooks
stealth trigger invoice.payment_failed`}</Code>
        <P>The CLI prints each delivery and your server’s response, so a failing handler shows up before it reaches production.</P>
      </div>
    </div>
  );
}
