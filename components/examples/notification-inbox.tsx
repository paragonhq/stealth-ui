"use client";
import { useEffect, useRef, useState } from "react";
import { CreditCard, Search, Warning } from "@/lib/icons";
import { NotificationInbox, type InboxNotification } from "@/components/ui/notification-inbox";

/** Epoch ms, `minutes` ago. Only called from state initializers and events, never in render output. */
const ago = (minutes: number) => Date.now() - minutes * 60_000;

const seed = (): InboxNotification[] => [
  { id: "n1", actor: "Maya Chen", mention: true, time: ago(4), title: <><b>Maya Chen</b> commented on <b>Q3 forecast</b></>, preview: "@ryan can we split the EMEA numbers by quarter before Thursday?" },
  { id: "n2", icon: <Warning />, time: ago(18), title: <><b>web@4f2a1c</b> failed to deploy to <b>production</b></>, preview: "Build step exited with code 1 after 2m 14s" },
  { id: "n3", actor: "Leo Park", mention: true, time: ago(64), title: <><b>Leo Park</b> mentioned you in <b>INV-2041</b></>, preview: "Can you approve the annual renewal? Finance needs it today." },
  { id: "n4", actor: "Priya Raman", read: true, time: ago(190), title: <><b>Priya Raman</b> merged <b>#1182 Retry webhooks with backoff</b></> },
  { id: "n5", actor: "Ana Souza", read: true, time: ago(60 * 26), title: <><b>Ana Souza</b> invited you to <b>Platform</b></> },
  { id: "n6", actor: "Tom Weiss", read: true, time: ago(60 * 50), title: <><b>Tom Weiss</b> shared <b>q3-forecast.xlsx</b></>, preview: "Updated with September actuals" },
  { id: "n7", icon: <CreditCard />, read: true, time: ago(60 * 24 * 4), title: <><b>INV-2039</b> was paid</>, preview: "$1,280.00 from Northwind Traders" },
];

const incoming = [
  { actor: "Jordan Lee", mention: true, title: <><b>Jordan Lee</b> replied to your comment on <b>Q3 forecast</b></>, preview: "Split by quarter now. EMEA Q3 is up 12%." },
  { actor: "Maya Chen", title: <><b>Maya Chen</b> assigned you <b>INC-91 · Slow dashboard queries</b></> },
  { actor: "Priya Raman", title: <><b>Priya Raman</b> requested your review on <b>#1190</b></>, preview: "Rate limit the export API" },
];

// A workspace header: the bell in its real home, with notifications that keep arriving.
export default function Demo() {
  const [items, setItems] = useState(seed);
  const [open, setOpen] = useState(false);
  const next = useRef(0);

  const receive = () => {
    const n = next.current++;
    const e = incoming[n % incoming.length];
    setItems((list) => [{ ...e, id: `new-${n}`, time: ago(0) }, ...list]);
  };

  // The first time the panel is open, one more notification lands while you're looking at it.
  useEffect(() => {
    if (!open || next.current > 0) return;
    const t = window.setTimeout(receive, 2200);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <div className="flex h-[460px] w-full max-w-[520px] flex-col items-stretch gap-3">
      <div className="flex h-12 items-center gap-2 rounded-xl border border-line bg-frame px-3 shadow-[var(--shadow)] [--badge-cutout:var(--frame)]">
        <span aria-hidden className="grid size-6 place-items-center rounded-md bg-fg font-mono text-[11px] font-medium text-frame">N</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Northwind</span>
        <span className="hidden h-8 w-44 items-center gap-2 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] text-fg-4 sm:flex">
          <Search size={14} />
          Search
        </span>
        <NotificationInbox
          items={items}
          onItemsChange={setItems}
          open={open}
          onOpenChange={setOpen}
          footer={
            <a href="#" onClick={(e) => e.preventDefault()} className="shrink-0 rounded text-fg-2 underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors hover:text-fg hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3">
              Settings
            </a>
          }
        />
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">RS</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 truncate text-[12px] text-fg-3">Open the bell, then let something new arrive.</p>
        <button
          type="button"
          onClick={receive}
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          Simulate notification
        </button>
      </div>
    </div>
  );
}
