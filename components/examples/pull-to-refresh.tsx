"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { PullToRefresh, type PullToRefreshActions } from "@/components/ui/pull-to-refresh";

type Mail = { id: number; from: string; subject: string; preview: string; when: string; unread?: boolean };

const initial: Mail[] = [
  { id: 1, from: "Maya Okafor", subject: "Q3 forecast, second pass", preview: "Updated the churn assumptions in q3-forecast.xlsx — can you check the…", when: "9:41" },
  { id: 2, from: "Stripe", subject: "Payout of $18,420.50 is on its way", preview: "Expected to arrive in your Mercury account ending 4410 on…", when: "8:12" },
  { id: 3, from: "Jonas Berg", subject: "Re: checkout rounding bug", preview: "Found it. We were rounding per line item instead of on the total…", when: "Yesterday" },
  { id: 4, from: "Priya Raman", subject: "Design review moved to Thursday", preview: "Same time, same room. I’ll bring the new onboarding flows…", when: "Yesterday" },
  { id: 5, from: "GitHub", subject: "[acme-web] 2 failing checks on #1284", preview: "checkout.test.ts › rounds the order total once…", when: "Mon" },
  { id: 6, from: "Lena Vogel", subject: "Offsite dates", preview: "Poll closes Friday. So far 14–16 Oct is winning by…", when: "Mon" },
];
const incoming: Mail[] = [
  { id: 7, from: "Tomás Ferreira", subject: "Invoice INV-2291 refunded", preview: "Refund of $129.00 processed for Northwind Labs…", when: "Now", unread: true },
  { id: 8, from: "Vercel", subject: "acme-web deployed to production", preview: "4f2a91c · Fix checkout rounding · 2m 14s", when: "Now", unread: true },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A mail inbox. The first refresh brings two messages, the second finds
// nothing new, the third fails; the header button does the same as the pull.
export default function Demo() {
  const [mail, setMail] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [doneLabel, setDoneLabel] = useState("Up to date");
  const pulls = useRef(0);
  const ptr = useRef<PullToRefreshActions>(null);
  const reduce = useReducedMotion();

  return (
    <div className="flex h-[440px] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Inbox</p>
        <button
          type="button"
          aria-label="Refresh inbox"
          disabled={refreshing}
          onClick={() => ptr.current?.refresh()}
          className={cn(
            "relative grid size-8 place-items-center rounded-lg text-fg-2",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
            "before:absolute before:-inset-1.5 before:content-[''] disabled:text-fg-4",
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn(refreshing && "animate-spin [animation-duration:0.8s]")}>
            <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
          </svg>
        </button>
      </div>

      <PullToRefresh
        actionsRef={ptr}
        aria-label="Inbox messages"
        className="min-h-0 flex-1"
        labels={{ done: doneLabel }}
        onRefresh={async () => {
          setRefreshing(true);
          try {
            await wait(1200);
            const n = pulls.current++ % 3;
            if (n === 2) throw new Error("Offline");
            setDoneLabel(n === 0 ? "2 new messages" : "Up to date");
            if (n === 0) setMail((m) => [...incoming.map((x) => ({ ...x, id: x.id + m.length * 10 })), ...m]);
          } finally {
            setRefreshing(false);
          }
        }}
      >
        <ul className="flex flex-col py-1">
          <AnimatePresence initial={false}>
            {mail.map((m) => (
              <motion.li
                key={m.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: reduce ? 0.15 : 0.3, ease: ease.out }}
                className="overflow-hidden"
              >
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="mx-1.5 flex gap-3 rounded-lg px-2.5 py-2.5 outline-none transition-colors duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
                >
                  <span className="mt-[7px] grid size-1.5 shrink-0 place-items-center">
                    {m.unread && <span className="size-1.5 rounded-full bg-fg" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {m.unread && <span className="sr-only">Unread, </span>}
                    <span className="flex items-baseline gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-[13px] tracking-[-0.006em]", m.unread ? "font-medium text-fg" : "text-fg")}>{m.from}</span>
                      <span className="shrink-0 text-[11.5px] tabular text-fg-3">{m.when}</span>
                    </span>
                    <span className={cn("block truncate text-[12.5px]", m.unread ? "text-fg" : "text-fg-2")}>{m.subject}</span>
                    <span className="block truncate text-[12px] text-fg-3">{m.preview}</span>
                  </span>
                </a>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </PullToRefresh>
    </div>
  );
}
