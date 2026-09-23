"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Message } from "@/lib/icons";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHandle,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@/components/ui/bottom-sheet";

const comments = [
  { who: "Maya Chen", at: "9:41", text: "The hero headline wraps to three lines at 375px. Can we drop it to 32px on phones?", open: true },
  { who: "Leo Park", at: "9:52", text: "Pricing cards feel cramped. 16px between them instead of 12?", open: true },
  { who: "Ana Ruiz", at: "10:05", text: "Love the new logo lockup in the footer.", open: false },
  { who: "Jonas Olsen", at: "10:18", text: "The CTA contrast is 3.9:1 in light mode. Needs to clear 4.5.", open: true },
  { who: "Maya Chen", at: "10:24", text: "Testimonials carousel: add a pause button, it autoplays.", open: false },
  { who: "Priya Nair", at: "11:02", text: "FAQ answers should open one at a time, not all at once.", open: false },
  { who: "Leo Park", at: "11:40", text: "Customer logos are slightly blurry on retina. Export at 2x.", open: false },
  { who: "Ana Ruiz", at: "12:15", text: "Can the sign-up button say “Create account”?", open: false },
  { who: "Jonas Olsen", at: "13:30", text: "Footer links need 44px touch targets on phones.", open: false },
  { who: "Priya Nair", at: "14:02", text: "Ship it once the contrast fix lands.", open: false },
];
const unresolved = comments.filter((c) => c.open).length;

export default function Demo() {
  const phone = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div
      ref={phone}
      className="relative h-[500px] w-[300px] max-w-full overflow-hidden rounded-[32px] border border-line-2 bg-frame shadow-[var(--shadow)]"
    >
      {/* The page behind: a design under review. */}
      <div className="flex h-12 items-center justify-between px-5 pt-2">
        <p className="text-[13px] font-medium text-fg">Homepage v3</p>
        <p className="font-mono text-2xs text-fg-4">1440 × 3200</p>
      </div>
      <div aria-hidden className="mx-4 flex flex-col gap-2.5 rounded-xl border border-line bg-raised p-4">
        <div className="h-2 w-16 rounded-full bg-hover" />
        <div className="mt-2 h-4 w-full rounded bg-line-2" />
        <div className="h-4 w-3/4 rounded bg-line-2" />
        <div className="mt-1 h-2 w-full rounded-full bg-hover" />
        <div className="h-2 w-5/6 rounded-full bg-hover" />
        <div className="mt-2 h-7 w-24 rounded-md bg-fg/80" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-16 rounded-lg border border-line bg-frame" />
          ))}
        </div>
      </div>

      <BottomSheet open={open} onOpenChange={setOpen} modal="trap-focus" snapPoints={["82px", 0.55, 1]}>
        <BottomSheetTrigger
          className={cn(
            "absolute bottom-5 left-1/2 inline-flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-fg px-4 text-[13px] font-medium text-frame shadow-pop",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,scale] duration-150 ease-out-quart hover:bg-fg/90 active:scale-[0.96]",
          )}
        >
          <Message />
          {comments.length} comments
        </BottomSheetTrigger>
        <BottomSheetContent container={phone}>
          <BottomSheetHandle />
          <BottomSheetHeader className="flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <BottomSheetTitle>Comments</BottomSheetTitle>
              <BottomSheetDescription>
                <span className="text-warning">{unresolved} unresolved</span> · {comments.length} total
              </BottomSheetDescription>
            </div>
            <BottomSheetClose>Done</BottomSheetClose>
          </BottomSheetHeader>
          <BottomSheetBody>
            <ul className="flex flex-col">
              {comments.map((c, n) => (
                <li key={n} className="flex gap-3 border-b border-line py-3 last:border-0">
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[10px] font-medium text-fg-2">
                    {c.who
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 text-[12.5px]">
                      <span className="font-medium text-fg">{c.who}</span>
                      <span className="tabular text-2xs text-fg-4">{c.at}</span>
                      {c.open && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-warning" aria-label="Unresolved" />}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-[1.45] text-fg-2">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
