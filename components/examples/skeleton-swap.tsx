"use client";
import { useEffect, useRef, useState } from "react";
import { Skeleton, SkeletonCircle, SkeletonLine } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";

type Customer = { initials: string; name: string; email: string; plan: string; mrr: string; seats: string; note: string };

const customers: Customer[] = [
  { initials: "LH", name: "Lumen Health", email: "billing@lumenhealth.com", plan: "Enterprise", mrr: "$4,820", seats: "86", note: "Renews 30 Sep. Wants SSO on the sandbox workspace too." },
  { initials: "PC", name: "Parcel & Co", email: "ops@parcel.co", plan: "Team", mrr: "$1,200", seats: "14", note: "Asked for an invoice in EUR." },
  { initials: "HA", name: "Harbor Analytics", email: "finance@harbor-analytics.io", plan: "Business", mrr: "$12,450", seats: "212", note: "Expanding to the London office in Q4. Procurement needs a signed DPA and a security review before the new seats are added." },
];

// Load a customer fast, slow, or refresh the one on screen. Fast answers never
// flash a skeleton; slow ones hold it long enough to read, then settle into place.
export default function Demo() {
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refetch, setRefetch] = useState<"keep" | "skeleton">("skeleton");
  const [note, setNote] = useState("The first customer takes 1.2 s to load.");
  const timer = useRef<number>(undefined);

  const request = (ms: number, next: number, mode: "keep" | "skeleton", message: string) => {
    window.clearTimeout(timer.current);
    setRefetch(mode);
    setLoading(true);
    setNote(message);
    timer.current = window.setTimeout(() => {
      setIndex(next);
      setLoading(false);
    }, ms);
  };
  useEffect(() => {
    timer.current = window.setTimeout(() => setLoading(false), 1200);
    return () => window.clearTimeout(timer.current);
  }, []);

  const c = customers[index];
  const next = (index + 1) % customers.length;

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Action onClick={() => request(80, next, "skeleton", "An 80 ms answer lands inside the 150 ms delay, so no skeleton.")}>Next · 80 ms</Action>
        <Action onClick={() => request(1200, next, "skeleton", "A 1.2 s answer: skeleton after 150 ms, then the swap.")}>Next · 1.2 s</Action>
        <Action onClick={() => request(900, index, "keep", "Refresh keeps the data on screen and dims it after 150 ms.")}>Refresh</Action>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <SkeletonSwap loading={loading} refetch={refetch} skeleton={<CustomerSkeleton />}>
          <CustomerCard c={c} />
        </SkeletonSwap>
      </div>

      <p role="status" className="min-h-[18px] text-[12px] leading-[18px] text-fg-3">{note}</p>
    </div>
  );
}

function CustomerCard({ c }: { c: Customer }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-line-2 text-[12px] font-medium text-fg-2">{c.initials}</span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-medium leading-[20px] tracking-[-0.01em] text-fg">{c.name}</span>
          <span className="truncate text-[12px] leading-[18px] text-fg-3">{c.email}</span>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {[["Plan", c.plan], ["MRR", c.mrr], ["Seats", c.seats]].map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="font-mono text-[10.5px] uppercase leading-[14px] tracking-[0.08em] text-fg-3">{k}</dt>
            <dd className="tabular mt-1 truncate text-[13px] leading-[18px] text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12.5px] leading-[19px] text-fg-2">{c.note}</p>
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <Skeleton label="Loading customer" className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="flex min-w-0 flex-1 flex-col">
          <SkeletonLine className="text-[14px] leading-[20px]" width="44%" />
          <SkeletonLine className="text-[12px] leading-[18px]" width="62%" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[40, 52, 28].map((w) => (
          <div key={w} className="flex flex-col">
            <SkeletonLine className="text-[10.5px] leading-[14px]" width="36%" />
            <SkeletonLine className="mt-1 text-[13px] leading-[18px]" width={`${w + 20}%`} />
          </div>
        ))}
      </div>
      <SkeletonLine className="text-[12.5px] leading-[19px]" lines={2} width="58%" />
    </Skeleton>
  );
}

function Action({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tabular h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
    >
      {children}
    </button>
  );
}
