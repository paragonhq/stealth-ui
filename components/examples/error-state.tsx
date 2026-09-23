"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { ease } from "@/lib/motion";
import { ErrorState } from "@/components/ui/error-state";

const invoices = [
  { id: "INV-2291", customer: "Northwind Labs", amount: "$4,200.00", status: "Paid" },
  { id: "INV-2290", customer: "Acme Corp", amount: "$12,480.00", status: "Due 30 Sep" },
  { id: "INV-2289", customer: "Globex", amount: "$960.00", status: "Paid" },
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A billing page where the invoices request timed out. The first retry fails
// too (so the attempt count and redrawn mark can be seen); the second works.
// Below it, the same failure as one quiet row inside a card.
export default function Demo() {
  const [loaded, setLoaded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const tries = useRef(0);
  const reduce = useReducedMotion();

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <section aria-labelledby="inv-h" className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="inv-h" className="text-[13.5px] font-medium tracking-[-0.012em] text-fg">
            Invoices
          </h2>
          <span className="font-mono text-[11px] text-fg-3">September</span>
        </div>
        <div className="min-h-[196px] p-4">
          <AnimatePresence mode="wait" initial={false}>
            {loaded ? (
              <motion.ul key="list" aria-label="Invoices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: ease.out }} className="-my-1 flex flex-col">
                {invoices.map((inv, i) => (
                  <motion.li
                    key={inv.id}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: ease.out, delay: i * 0.03 }}
                    className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                  >
                    <span className="w-[72px] shrink-0 font-mono text-[11.5px] text-fg-3">{inv.id}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{inv.customer}</span>
                    <span className="shrink-0 text-[12px] text-fg-3">{inv.status}</span>
                    <span className="w-[84px] shrink-0 text-right text-[13px] tabular text-fg">{inv.amount}</span>
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <motion.div key="error" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                <ErrorState
                  heading="Couldn’t load invoices"
                  description="The billing service didn’t answer within 30 seconds. Your invoices are safe; try again in a moment."
                  code="ERR_UPSTREAM_TIMEOUT"
                  status={504}
                  requestId="req_7Hq2Lk9xVb41"
                  occurredAt={Date.UTC(2026, 8, 22, 14, 32, 10)}
                  details={"GET /v1/invoices?period=2026-09\nupstream billing-api timed out after 30000 ms\n  at fetchInvoices (billing/client.ts:88)\n  at InvoicesPage (app/billing/page.tsx:24)"}
                  onRetry={async () => {
                    await wait(900);
                    if (tries.current++ === 0) throw new Error("Timed out again");
                    setLoaded(true);
                  }}
                >
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 outline-none transition-[background-color,color] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                  >
                    Status page
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 11 11 5M6 5h5v5" />
                    </svg>
                  </a>
                </ErrorState>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section aria-labelledby="cm-h" className="rounded-xl border border-line bg-raised px-4 py-3 shadow-[var(--shadow)]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cm-h" className="text-[13px] font-medium text-fg">
            Comments
          </h2>
          <span className="text-[11.5px] text-fg-3">INV-2290</span>
        </div>
        <div className="mt-1.5 min-h-8">
          {commentsLoaded ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-1.5 text-[12.5px] text-fg-2">
              <span className="text-fg">Maya Okafor</span> Sent a reminder to Acme’s AP team.
            </motion.p>
          ) : (
            <ErrorState
              variant="inline"
              heading="Couldn’t load 3 comments."
              onRetry={async () => {
                await wait(700);
                setCommentsLoaded(true);
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
