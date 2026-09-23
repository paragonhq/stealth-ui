"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Plus, Search, Share } from "@/lib/icons";
import { ProductTour, type TourFinishReason, type TourStep } from "@/components/ui/product-tour";

const steps: TourStep[] = [
  {
    target: "[data-tour=search]",
    title: "Search everything",
    content: "Issues, people and commits in one place. Press / from anywhere.",
    align: "start",
  },
  {
    target: "[data-tour=filters]",
    title: "Filter by status",
    content: "Narrow the board to what’s blocked or waiting on review.",
    align: "start",
  },
  {
    target: "[data-tour=new]",
    title: "Create an issue",
    content: "Start from a template, or paste a stack trace and the title and labels fill themselves in. Press C.",
    align: "end",
  },
  {
    target: "[data-tour=issue]",
    title: "Open any issue",
    content: "Comments, linked commits and the deploy it shipped in.",
    side: "top",
    padding: 2,
    radius: 8,
  },
  {
    target: "[data-tour=share]",
    title: "Bring your team in",
    content: "Share the board with a link. Guests can comment but can’t change anything.",
    align: "end",
  },
];

const issues = [
  { id: "CHK-212", title: "Apple Pay sheet closes on first tap in Safari", status: "bg-warning", who: "MC" },
  { id: "CHK-208", title: "Retry failed webhooks with backoff", status: "bg-info", who: "LP" },
  { id: "CHK-205", title: "Tax line missing for Irish addresses", status: "bg-danger", who: "AR" },
  { id: "CHK-201", title: "Move card form to the new field components", status: "bg-info", who: "MC" },
  { id: "CHK-198", title: "Coupon code accepts trailing spaces", status: "bg-success", who: "SK" },
  { id: "CHK-194", title: "Checkout times out behind corporate proxies", status: "bg-warning", who: "LP" },
];

// An issue board a new teammate lands on, with the tour they get on day one.
export default function Demo() {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [ended, setEnded] = useState<{ reason: TourFinishReason; at: number } | null>(null);

  return (
    <div className="flex w-full max-w-[500px] flex-col items-center gap-4">
      <div ref={setFrame} className="relative w-full overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-12 items-center gap-2 border-b border-line px-3">
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-fg font-mono text-[10px] font-medium text-frame">
            C
          </span>
          <p className="mr-auto truncate text-[13px] font-medium text-fg max-[400px]:hidden">checkout-web</p>
          <div data-tour="search" className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line-2 bg-frame px-2 text-[12px] text-fg-4 sm:max-w-[150px]">
            <Search className="size-3.5 shrink-0" />
            <span className="truncate">Search</span>
            <kbd className="ml-auto font-mono text-[10.5px] text-fg-4">/</kbd>
          </div>
          <button
            type="button"
            data-tour="share"
            aria-label="Share"
            className="grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92]"
          >
            <Share />
          </button>
          <button
            type="button"
            data-tour="new"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-fg pl-1.5 pr-2 text-[12px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            <Plus className="size-3.5" />
            New
          </button>
        </div>
        <div className="flex items-center px-3 pb-1 pt-3">
          <div data-tour="filters" className="flex items-center gap-1 text-[12px]">
            {[
              ["All", 24],
              ["In review", 5],
              ["Blocked", 2],
            ].map(([label, n], i) => (
              <span key={label} className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2", i === 0 ? "bg-hover text-fg" : "text-fg-3")}>
                {label}
                <span className="tabular text-fg-4">{n}</span>
              </span>
            ))}
          </div>
        </div>
        <ul className="px-1.5 pb-2">
          {issues.map((issue, i) => (
            <li key={issue.id} data-tour={i === 0 ? "issue" : undefined} className="flex h-10 items-center gap-3 rounded-lg px-2">
              <span className="w-[54px] shrink-0 font-mono text-[11px] text-fg-3">{issue.id}</span>
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", issue.status)} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{issue.title}</span>
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-hover text-[9px] font-medium text-fg-2">
                {issue.who}
              </span>
            </li>
          ))}
        </ul>

        <ProductTour
          steps={steps}
          container={frame}
          open={open}
          onOpenChange={setOpen}
          step={step}
          onStepChange={setStep}
          onFinish={(reason) => setEnded({ reason, at: step })}
        />
      </div>

      <div className="flex h-8 items-center gap-3">
        <p className="text-[12.5px] text-fg-3" role="status">
          {ended ? (ended.reason === "completed" ? "Tour finished." : `Skipped at step ${ended.at + 1} of ${steps.length}.`) : "New here?"}
        </p>
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setEnded(null);
            setOpen(true);
          }}
          className="inline-flex h-8 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          {ended ? "Take it again" : "Take the tour"}
        </button>
      </div>
    </div>
  );
}
