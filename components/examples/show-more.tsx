"use client";
import { ShowMore } from "@/components/ui/show-more";

const comments = [
  {
    initials: "MO",
    name: "Maya Okafor",
    time: "2h",
    body: (
      <>
        <p>
          I reproduced the double charge on staging: when the card needs 3-D Secure, the confirm step retries on the client after the
          redirect, and the webhook also finalizes the invoice. Both paths call <code className="font-mono text-[12px] text-fg">finalizeInvoice</code>, so
          we bill twice whenever the webhook wins the race.
        </p>
        <p className="mt-2">
          Proposed fix: make finalization idempotent on the invoice id and drop the client retry entirely. I’ve drafted it in{" "}
          <a href="#pr-2291" className="text-fg underline decoration-fg-4 underline-offset-[3px] hover:decoration-fg-2">
            #2291
          </a>
          , with a test that fires both paths within 50ms of each other. Refunds for the 14 affected customers are queued for tomorrow.
        </p>
      </>
    ),
  },
  { initials: "JL", name: "Jonas Lindqvist", time: "1h", body: <p>Approved. Ship it behind the billing flag first.</p> },
];

export default function Demo() {
  return (
    // Reserve the expanded height so the cards grow downward instead of re-centring.
    <ul className="flex min-h-[390px] w-full max-w-[440px] flex-col gap-3">
      {comments.map((c) => (
        <li key={c.name} className="flex gap-3 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
          <span aria-hidden className="-mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2 ring-1 ring-inset ring-line-2">
            {c.initials}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex items-baseline gap-2 text-[13px]">
              <span className="font-medium text-fg">{c.name}</span>
              <span className="text-[12px] tabular text-fg-3">{c.time}</span>
            </p>
            <ShowMore lines={3}>{c.body}</ShowMore>
          </div>
        </li>
      ))}
    </ul>
  );
}
