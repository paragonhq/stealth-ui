"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { File, Warning } from "@/lib/icons";
import { SwipeDeck, type SwipeDirection } from "@/components/ui/swipe-deck";

type Claim = { id: string; merchant: string; category: string; amount: number; date: string; who: string; note: string; receipt: string | null };

const claims: Claim[] = [
  { id: "c1", merchant: "Hotel Lumen, Berlin", category: "Lodging", amount: 412.8, date: "12 Sep", who: "Maya Chen", note: "2 nights for the client workshop", receipt: "lumen-folio-0912.pdf" },
  { id: "c2", merchant: "Rail, Hamburg to Berlin", category: "Travel", amount: 89.9, date: "11 Sep", who: "Jonas Weber", note: "Return ticket, second class", receipt: "rail-ticket.pdf" },
  { id: "c3", merchant: "Team offsite dinner", category: "Team events", amount: 618, date: "10 Sep", who: "Sam Okafor", note: "8 people, over the €500 limit", receipt: "dinner-receipt.jpg" },
  { id: "c4", merchant: "Monitor, 27-inch", category: "Equipment", amount: 349, date: "9 Sep", who: "Lena Park", note: "Replacement for the broken one", receipt: null },
  { id: "c5", merchant: "Northwind Coffee", category: "Meals", amount: 23.4, date: "8 Sep", who: "Priya Nair", note: "Candidate coffee chat", receipt: "northwind-0908.jpg" },
];

const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[11px] font-medium text-fg-2">{initials(claim.who)}</span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-fg">{claim.who}</p>
          <p className="text-[12px] text-fg-3">{claim.date}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{claim.category}</p>
        <p className="mt-1.5 text-[15px] font-medium tracking-[-0.015em] text-balance text-fg">{claim.merchant}</p>
        <p className="tabular mt-2 text-[30px] font-medium leading-none tracking-[-0.03em] text-fg">{money.format(claim.amount)}</p>
        <p className="mt-3 text-[12.5px] text-fg-2">{claim.note}</p>
      </div>

      <div className="mt-auto flex h-9 items-center gap-2 rounded-lg border border-line bg-frame px-2.5 text-[12px]">
        {claim.receipt ? (
          <>
            <File className="shrink-0 text-fg-3" />
            <span className="min-w-0 truncate font-mono text-[11.5px] text-fg-2">{claim.receipt}</span>
          </>
        ) : (
          <>
            <Warning className="shrink-0 text-warning" />
            <span className="text-fg-2">No receipt attached</span>
          </>
        )}
      </div>
    </div>
  );
}

// Approving expense claims: right approves, left rejects, and the buttons do the same.
export default function Demo() {
  const [index, setIndex] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, SwipeDirection>>({});
  const approved = Object.values(verdicts).filter((v) => v === "right").length;
  const reviewed = Math.min(index, claims.length);

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-4">
      <div className="flex w-full items-baseline justify-between">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Expense claims</h3>
        <span className="tabular text-[12px] text-fg-3">
          <NumberFlow value={reviewed} /> of {claims.length} reviewed
        </span>
      </div>

      <SwipeDeck
        aria-label="Expense claims to review"
        items={claims}
        getKey={(c) => c.id}
        getLabel={(c) => `${c.merchant}, ${money.format(c.amount)}`}
        index={index}
        onIndexChange={setIndex}
        onSwipe={(c, dir) => setVerdicts((v) => ({ ...v, [c.id]: dir }))}
        onUndo={(c) =>
          setVerdicts((v) => {
            const next = { ...v };
            delete next[c.id];
            return next;
          })
        }
        left={{ label: "Reject", tone: "danger" }}
        right={{ label: "Approve", tone: "success" }}
        height={320}
        renderCard={(c) => <ClaimCard claim={c} />}
        empty={
          <div className="flex flex-col items-center gap-1 px-6 text-center">
            <p className="text-[13px] font-medium text-fg">All claims reviewed</p>
            <p className="tabular text-[12.5px] text-fg-3">
              {approved} approved, {claims.length - approved} rejected
            </p>
            <button
              type="button"
              onClick={() => {
                setVerdicts({});
                setIndex(0);
              }}
              className="mt-3 inline-flex h-8 items-center rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Review again
            </button>
          </div>
        }
      />
    </div>
  );
}
