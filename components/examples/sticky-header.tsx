"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { StickyHeader, StickyHeaderTitle } from "@/components/ui/sticky-header";

const milestones = [
  { name: "Usage-based billing in beta", owner: "Priya Raman", due: "Jul 28", status: "Shipped" },
  { name: "SSO for every paid plan", owner: "Leo Park", due: "Aug 15", status: "On track" },
  { name: "Audit log export to S3", owner: "Maya Chen", due: "Aug 29", status: "At risk" },
  { name: "Self-serve seat changes", owner: "Tom Weiss", due: "Sep 12", status: "On track" },
  { name: "Invoice PDFs in 9 languages", owner: "Ana Souza", due: "Sep 26", status: "Not started" },
];

const tone: Record<string, string> = {
  Shipped: "bg-success-soft text-success",
  "On track": "bg-info-soft text-info",
  "At risk": "bg-warning-soft text-warning",
  "Not started": "bg-hover text-fg-3",
};

// A planning doc: the header is invisible at rest, gains its edge as the doc
// slides under it, and picks up the title once the real heading has gone by.
export default function Demo() {
  const title = useRef<HTMLHeadingElement>(null);

  return (
    <div className="h-[420px] w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div
        tabIndex={0}
        aria-label="Q3 planning"
        className="h-full overflow-y-auto overscroll-contain outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3"
      >
        <StickyHeader className="flex h-12 items-center gap-1 pl-2 pr-3">
          <button
            type="button"
            aria-label="Back to projects"
            className="relative grid size-8 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.94] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden"
          >
            <ChevronLeft />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-[13px]">
            <span className="shrink-0 text-fg-3">Projects</span>
            <ChevronRight size={14} className="shrink-0 text-fg-4" />
            <StickyHeaderTitle watch={title} className="font-medium tracking-[-0.01em] text-fg">
              Q3 planning
            </StickyHeaderTitle>
          </nav>
          <div className="mr-1.5 hidden shrink-0 items-center sm:flex" aria-label="3 people viewing">
            {["MC", "LP", "PR"].map((initials, i) => (
              <span
                key={initials}
                aria-hidden
                className="-ml-1.5 grid size-6 place-items-center rounded-full border-2 border-frame bg-hover text-[9.5px] font-medium text-fg-2 first:ml-0"
                style={{ zIndex: 3 - i }}
              >
                {initials}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="h-7 shrink-0 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            Share
          </button>
        </StickyHeader>

        <article className="px-5 pb-8 pt-3">
          <h1 ref={title} className="text-[20px] font-medium leading-[1.15] tracking-[-0.02em] text-fg text-balance">
            Q3 planning
          </h1>
          <p className="mt-1.5 text-[12px] text-fg-3">Updated 2h ago by Maya Chen · Platform team</p>

          <h2 className="mt-6 text-[13.5px] font-medium tracking-[-0.01em] text-fg">What we’re betting on</h2>
          <p className="mt-2 text-[13px] leading-[1.6] text-fg-2 text-pretty">
            Billing is the loudest source of support tickets, and most of them come from teams that outgrew the seat
            they signed up on. This quarter we make plan changes self-serve and move metered usage out of beta.
          </p>

          <h2 className="mt-6 text-[13.5px] font-medium tracking-[-0.01em] text-fg">Milestones</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised">
            {milestones.map((m) => (
              <li key={m.name} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-fg">{m.name}</p>
                  <p className="truncate text-[12px] text-fg-3">
                    {m.owner} · <span className="tabular">{m.due}</span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[m.status]}`}>{m.status}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-6 text-[13.5px] font-medium tracking-[-0.01em] text-fg">Risks</h2>
          <p className="mt-2 text-[13px] leading-[1.6] text-fg-2 text-pretty">
            The audit log export depends on the storage migration landing first. If it slips past August 15, we ship
            export to our own bucket and add S3 in Q4.
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-fg-2 text-pretty">
            Invoice translations need a vendor. Ana has two quotes; we decide by the end of July.
          </p>
        </article>
      </div>
    </div>
  );
}
