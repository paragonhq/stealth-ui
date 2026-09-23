"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { InfiniteList } from "@/components/ui/infinite-list";

type Txn = { id: string; merchant: string; memo: string; amount: number; date: string };

const merchants: [string, string, number][] = [
  ["Linear", "Team plan · 12 seats", -96],
  ["Figma", "Organization · annual", -1080],
  ["Stripe payout", "To Mercury ••4410", 18420.5],
  ["AWS", "us-east-1 · compute", -2310.18],
  ["Vercel", "Pro · bandwidth overage", -42.6],
  ["Notion", "Plus · 8 members", -80],
  ["Customer refund", "Invoice INV-2291", -129],
  ["Google Workspace", "Business Starter", -84],
  ["GitHub", "Actions minutes", -61.2],
  ["Stripe payout", "To Mercury ••4410", 9730.25],
  ["Datadog", "Infrastructure · 14 hosts", -434],
];
const TOTAL = 44;
const all: Txn[] = Array.from({ length: TOTAL }, (_, i) => {
  const [merchant, memo, amount] = merchants[(i * 7) % merchants.length];
  const d = new Date(Date.UTC(2026, 8, 21) - Math.floor(i * 0.75) * 86_400_000);
  return {
    id: `txn_${4210 - i}`,
    merchant,
    memo,
    amount,
    date: `${d.getUTCDate()} ${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`,
  };
});
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" });
// A real minus sign, so debits and credits line up in tabular figures.
const money = (n: number) => usd.format(n).replace("-", "−");
const PAGE = 8;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A card's transactions. Scroll and the next page streams in under skeletons;
// go offline and the page fails (after one quiet retry) into a retry row.
export default function Demo() {
  const [txns, setTxns] = useState(() => all.slice(0, PAGE));
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);

  return (
    <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium tracking-[-0.012em] text-fg">Transactions</p>
          <p className="text-[11.5px] tabular text-fg-3">
            {txns.length} of {TOTAL} · Operating ••4410
          </p>
        </div>
        <button
          type="button"
          aria-pressed={offline}
          onClick={() => {
            offlineRef.current = !offline;
            setOffline(!offline);
          }}
          className={cn(
            "inline-flex h-7 shrink-0 select-none items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
            offline ? "border-warning/40 bg-warning-soft text-warning" : "border-line-2 bg-raised text-fg-2 hover:border-fg-4 hover:bg-hover hover:text-fg",
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full transition-colors duration-150", offline ? "bg-warning" : "bg-success")} />
          {offline ? "Offline" : "Online"}
        </button>
      </div>

      <InfiniteList
        aria-label="Transactions"
        total={TOTAL}
        hasMore={txns.length < TOTAL}
        rootMargin="0px 0px 80px 0px"
        errorMessage="Couldn’t load older transactions. Check your connection."
        className="h-[340px] px-2 py-1.5"
        onLoadMore={async () => {
          await wait(1100);
          if (offlineRef.current) throw new Error("Offline");
          setTxns((t) => all.slice(0, t.length + PAGE));
        }}
      >
        {txns.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-hover">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-frame text-[12px] font-medium text-fg-2">
              {t.merchant[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium tracking-[-0.006em] text-fg">{t.merchant}</p>
              <p className="truncate text-[12px] text-fg-3">
                {t.date} · {t.memo}
              </p>
            </div>
            <span className={cn("shrink-0 text-[13px] tabular", t.amount > 0 ? "text-success" : "text-fg")}>{money(t.amount)}</span>
          </div>
        ))}
      </InfiniteList>
    </div>
  );
}
