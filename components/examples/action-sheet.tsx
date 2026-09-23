"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ChevronLeft, MoreH } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { ActionSheet, ActionSheetContent, ActionSheetItem, ActionSheetTrigger } from "@/components/ui/action-sheet";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A file on a phone. The sheet lives inside the phone, not over the page:
// swipe it down, tap outside, or pick an action. Download keeps the sheet up
// until the file is ready.
export default function Demo() {
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<{ text: string; undo?: boolean } | null>(null);
  const [deleted, setDeleted] = useState(false);

  // Confirmations leave on their own; one with Undo stays long enough to use it.
  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), status.undo ? 6000 : 4000);
    return () => window.clearTimeout(t);
  }, [status]);

  return (
    <div
      ref={setScreen}
      className="relative isolate flex h-[480px] w-[300px] flex-col overflow-hidden rounded-[28px] border border-line-2 bg-frame shadow-[var(--shadow)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-2 pt-2">
        <span aria-hidden className="grid size-11 place-items-center text-fg-3">
          <ChevronLeft />
        </span>
        <span className="text-[15px] font-medium tracking-[-0.015em]">Finance</span>
        <ActionSheet container={screen}>
          <ActionSheetTrigger
            disabled={deleted}
            aria-label="Actions for q3-forecast.xlsx"
            className="grid size-11 place-items-center rounded-full text-fg-2 outline-none transition-[background-color,scale] duration-100 touch-manipulation [-webkit-tap-highlight-color:transparent] hover:bg-hover active:scale-[0.92] data-popup-open:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[-4px] focus-visible:outline-fg-3 disabled:opacity-40"
          >
            <MoreH size={18} />
          </ActionSheetTrigger>
          <ActionSheetContent title="q3-forecast.xlsx" description="248 KB · Edited today by Maya Chen">
            <ActionSheetItem onSelect={() => setStatus({ text: "Link copied" })}>Copy link</ActionSheetItem>
            <ActionSheetItem
              onSelect={async () => {
                await wait(1400);
                setStatus({ text: "Saved to Downloads" });
              }}
            >
              Download
            </ActionSheetItem>
            <ActionSheetItem onSelect={() => setStatus({ text: "Duplicated as q3-forecast copy.xlsx" })}>Duplicate</ActionSheetItem>
            <ActionSheetItem onSelect={() => setStatus({ text: "Choose a folder" })}>Move to…</ActionSheetItem>
            <ActionSheetItem
              variant="danger"
              onSelect={() => {
                setDeleted(true);
                setStatus({ text: "Deleted q3-forecast.xlsx", undo: true });
              }}
            >
              Delete file
            </ActionSheetItem>
          </ActionSheetContent>
        </ActionSheet>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {deleted ? (
            <motion.div
              key="gone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col items-center justify-center pb-16 text-center"
            >
              <p className="text-[15px] text-fg-2">This file was deleted</p>
            </motion.div>
          ) : (
            <motion.div
              key="file"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="flex flex-col gap-4"
            >
              <Sheet />
              <div>
                <p className="truncate text-[15px] font-medium tracking-[-0.01em]">q3-forecast.xlsx</p>
                <p className="text-[13px] text-fg-3">248 KB · Edited today by Maya Chen</p>
              </div>
              <dl className="flex flex-col divide-y divide-line border-y border-line text-[13px]">
                {[
                  ["Owner", "Maya Chen"],
                  ["Shared with", "Finance team"],
                ].map(([k, v]) => (
                  <div key={k} className="flex h-11 items-center justify-between">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="text-fg-2">{v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
        <AnimatePresence>
          {status && (
            <motion.div
              key={status.text}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ duration: 0.28, ease: ease.out }}
              className="pointer-events-auto flex h-11 max-w-full items-center gap-3 rounded-full border border-line-2 bg-raised ps-4 pe-1.5 text-[13px] shadow-pop"
            >
              <span className="truncate">{status.text}</span>
              {status.undo ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleted(false);
                    setStatus(null);
                  }}
                  className="h-8 shrink-0 rounded-full px-3 font-medium outline-none transition-[background-color,scale] duration-100 hover:bg-hover active:scale-[0.95] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                >
                  Undo
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setStatus(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-fg-3 outline-none transition-[background-color,scale] duration-100 hover:bg-hover active:scale-[0.92] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
                    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
                  </svg>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// A spreadsheet thumbnail drawn in the page's own lines.
function Sheet() {
  return (
    <div aria-hidden className="grid aspect-[16/10] grid-cols-4 grid-rows-6 overflow-hidden rounded-xl border border-line bg-raised">
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className={`border-b border-e border-line ${i < 4 ? "bg-fg/[0.04]" : ""}`}>
          {i >= 4 && i % 4 !== 0 && <div className="m-1.5 h-1 rounded-full bg-fg/10" style={{ width: `${40 + ((i * 17) % 45)}%` }} />}
          {i >= 4 && i % 4 === 0 && <div className="m-1.5 h-1 w-3/4 rounded-full bg-fg/[0.18]" />}
        </div>
      ))}
    </div>
  );
}
