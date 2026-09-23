"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Inbox, Menu } from "@/lib/icons";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Status = "Todo" | "In progress" | "In review" | "Done";
const issues: { id: string; title: string; status: Status; who: string; by: string; body: string }[] = [
  { id: "STL-482", title: "Checkout fails when the coupon field is left empty", status: "In progress", who: "MC", by: "Maya Chen", body: "Submitting checkout with an empty coupon field returns a 422 and the pay button stays disabled. Blank should mean no coupon." },
  { id: "STL-479", title: "Pricing toggle loses its state after navigating back", status: "In review", who: "LP", by: "Leo Park", body: "Switching to yearly, opening a plan and pressing back shows monthly prices again. The toggle should come from the URL." },
  { id: "STL-476", title: "Add annual plan to the invoice PDF", status: "Todo", who: "AR", by: "Ana Ruiz", body: "Invoices for annual plans list twelve monthly lines. They need one line with the yearly price and the saving." },
  { id: "STL-471", title: "Plan cards jump when the price loads", status: "Todo", who: "MC", by: "Maya Chen", body: "The cards render at their skeleton height, then grow 18px when prices arrive. Reserve the price row’s height." },
  { id: "STL-468", title: "Currency symbol wraps onto its own line on small phones", status: "Done", who: "JO", by: "Jonas Olsen", body: "At 320px the € sign drops below the amount on the Pro card. Keep the symbol and number together." },
];

const views = [
  { name: "All issues", count: 48 },
  { name: "Assigned to me", count: 7 },
  { name: "Created by me", count: 12 },
  { name: "Billing launch", count: 19 },
  { name: "Bugs this week", count: 5 },
];

const dot: Record<Status, string> = {
  Todo: "border border-fg-3",
  "In progress": "bg-warning",
  "In review": "bg-info",
  Done: "bg-success",
};

const activity = [
  ["Maya Chen", "changed status to In progress", "2h"],
  ["Leo Park", "linked a pull request #1289", "3h"],
  ["Maya Chen", "can reproduce on staging with an empty code", "5h"],
  ["Ana Ruiz", "added the label Checkout", "6h"],
  ["Jonas Olsen", "set priority to High", "1d"],
  ["Ana Ruiz", "attached checkout-error.mov", "1d"],
  ["Leo Park", "mentioned this in STL-479", "2d"],
  ["Maya Chen", "created the issue", "2d"],
];

export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [issue, setIssue] = useState(issues[0]);
  const [view, setView] = useState(views[0].name);
  const [width, setWidth] = useState(360);

  return (
    <div
      ref={frame}
      className="relative h-[440px] w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]"
    >
      <div className="flex h-11 items-center gap-2 border-b border-line px-2.5">
        <button
          type="button"
          aria-label="Open views"
          onClick={() => setNavOpen(true)}
          className="relative grid size-7 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92]"
        >
          <Menu />
        </button>
        <p className="truncate text-[13px] font-medium text-fg">{view}</p>
        <span className="tabular text-[12px] text-fg-4">{views.find((v) => v.name === view)?.count}</span>
      </div>
      <ul className="p-1.5">
        {issues.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => {
                setIssue(i);
                setOpen(true);
              }}
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left outline-none transition-colors duration-150 hover:bg-hover",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                open && issue.id === i.id && "bg-hover",
              )}
            >
              <span className="w-[58px] shrink-0 font-mono text-[11.5px] text-fg-3">{i.id}</span>
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot[i.status])} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{i.title}</span>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-hover text-[9px] font-medium text-fg-2 max-[420px]:hidden">{i.who}</span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open} onOpenChange={setOpen} modal="trap-focus">
        <SheetContent container={frame} resizable width={width} onWidthChange={setWidth} defaultWidth={360} minWidth={300} maxWidth={520}>
          <SheetHeader>
            <p className="font-mono text-[11px] text-fg-3">{issue.id}</p>
            <SheetTitle>{issue.title}</SheetTitle>
            <SheetDescription>Opened by {issue.by} · 2 days ago</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <dl className="grid grid-cols-[88px_1fr] gap-y-2.5 text-[12.5px]">
              <dt className="text-fg-3">Status</dt>
              <dd className="flex items-center gap-2 text-fg">
                <span aria-hidden className={cn("size-2 rounded-full", dot[issue.status])} />
                {issue.status}
              </dd>
              <dt className="text-fg-3">Priority</dt>
              <dd className="text-fg">High</dd>
              <dt className="text-fg-3">Assignee</dt>
              <dd className="text-fg">{issue.by}</dd>
              <dt className="text-fg-3">Labels</dt>
              <dd className="flex flex-wrap gap-1">
                {["Checkout", "Billing launch"].map((l) => (
                  <span key={l} className="rounded-md border border-line-2 px-1.5 py-px text-[11.5px] text-fg-2">{l}</span>
                ))}
              </dd>
            </dl>
            <p className="mt-5 text-[13px] leading-[1.55] text-fg-2">
              {issue.body}
            </p>
            <p className="mb-2 mt-6 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Activity</p>
            <ol className="flex flex-col">
              {activity.map(([who, what, when], n) => (
                <li key={n} className="flex gap-2.5 py-1.5 text-[12.5px]">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-4" />
                  <p className="min-w-0 flex-1 text-fg-2">
                    <span className="text-fg">{who}</span> {what}
                  </p>
                  <span className="tabular shrink-0 text-fg-4">{when}</span>
                </li>
              ))}
            </ol>
          </SheetBody>
          <SheetFooter>
            <SheetClose>Close</SheetClose>
            <SheetClose variant="primary">Mark as done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet side="left" open={navOpen} onOpenChange={setNavOpen} modal="trap-focus">
        <SheetContent container={frame} defaultWidth={260}>
          <SheetHeader>
            <SheetTitle>Views</SheetTitle>
          </SheetHeader>
          <SheetBody className="px-2 pt-0">
            <ul>
              {views.map((v) => (
                <li key={v.name}>
                  <button
                    type="button"
                    aria-current={v.name === view ? "true" : undefined}
                    onClick={() => {
                      setView(v.name);
                      setNavOpen(false);
                    }}
                    className={cn(
                      "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] text-fg-2 outline-none transition-[background-color,color] duration-150 hover:bg-hover hover:text-fg",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                      "aria-[current]:bg-hover aria-[current]:text-fg",
                    )}
                  >
                    <Inbox className="shrink-0 text-fg-3" />
                    <span className="min-w-0 flex-1 truncate">{v.name}</span>
                    <span className="tabular text-[11.5px] text-fg-4">{v.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
