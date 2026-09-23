"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Mail, Trash, Undo } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { SwipeActions, type SwipeAction } from "@/components/ui/swipe-actions";

type Message = { id: string; from: string; subject: string; preview: string; time: string; unread: boolean };

const inbox: Message[] = [
  { id: "m1", from: "Maya Chen", subject: "Q3 forecast review", preview: "Updated the numbers in q3-forecast.xlsx, can you check the EMEA tab before Thursday?", time: "9:41", unread: true },
  { id: "m2", from: "Deploy bot", subject: "Production deploy finished", preview: "web · main · 3f9c2e1 built in 48s and is live on all regions", time: "9:12", unread: true },
  { id: "m3", from: "Jonas Weber", subject: "Invoice INV-2041 is due Friday", preview: "€4,280.00 for the September retainer. PDF attached for your records.", time: "Yesterday", unread: false },
  { id: "m4", from: "Priya Nair", subject: "Design review notes", preview: "Left comments on the onboarding flow, mostly copy and the empty states.", time: "Mon", unread: false },
];

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.25" y="3" width="11.5" height="3" rx=".75" />
      <path d="M3.25 6v6.25c0 .4.35.75.75.75h8c.4 0 .75-.35.75-.75V6M6.5 8.75h3" />
    </svg>
  );
}

function MailOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.75 8 2.75l5.5 4v5.75c0 .4-.35.75-.75.75h-9.5a.75.75 0 0 1-.75-.75z" />
      <path d="m2.75 7 5.25 3.5L13.25 7" />
    </svg>
  );
}

// A triage inbox: swipe right to toggle read, left to archive (full swipe) or delete.
export default function Demo() {
  const [items, setItems] = useState(inbox);
  const [undo, setUndo] = useState<{ verb: string; item: Message; index: number } | null>(null);
  const reduce = useReducedMotion();
  const timer = useRef<number>(undefined);
  const unread = items.filter((m) => m.unread).length;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const drop = (m: Message, verb: string) => {
    setUndo({ verb, item: m, index: items.findIndex((x) => x.id === m.id) });
    setItems((list) => list.filter((x) => x.id !== m.id));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUndo(null), 6000);
  };

  const restore = () => {
    if (!undo) return;
    setItems((list) => {
      const next = [...list];
      next.splice(Math.min(undo.index, next.length), 0, undo.item);
      return next;
    });
    setUndo(null);
  };

  const toggleRead = (id: string) => setItems((list) => list.map((m) => (m.id === id ? { ...m, unread: !m.unread } : m)));

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Inbox</h3>
            <span className="tabular text-[12px] text-fg-3">{unread ? `${unread} unread` : "All read"}</span>
          </div>
          <span className="hidden text-[12px] text-fg-4 sm:inline">Swipe a row, or hover it</span>
          <span className="text-[12px] text-fg-4 sm:hidden">Swipe a row</span>
        </div>

        <ul aria-label="Messages" className="relative">
          <AnimatePresence initial={false}>
            {items.map((m) => {
              const start: SwipeAction[] = [
                { id: "read", label: m.unread ? "Mark read" : "Mark unread", icon: m.unread ? <MailOpenIcon /> : <Mail />, onAction: () => toggleRead(m.id) },
              ];
              const end: SwipeAction[] = [
                { id: "archive", label: "Archive", icon: <ArchiveIcon />, removes: true, onAction: () => drop(m, "Archived") },
                { id: "delete", label: "Delete", icon: <Trash />, tone: "danger", removes: true, onAction: () => drop(m, "Deleted") },
              ];
              return (
                <motion.li
                  key={m.id}
                  // Only a restored row animates in; removal is folded shut by the row itself.
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ height: { duration: reduce ? 0 : 0.24, ease: ease.out }, opacity: { duration: 0.2 } }}
                  className="overflow-hidden border-b border-line last:border-b-0"
                >
                  <SwipeActions startActions={start} endActions={end} toolbarAlign="top">
                    <div className="relative flex gap-3 px-4 py-3 pr-4">
                      <span className="mt-[7px] grid size-1.5 shrink-0 place-items-center">
                        <motion.span
                          initial={false}
                          animate={{ scale: m.unread ? 1 : 0, opacity: m.unread ? 1 : 0 }}
                          transition={{ duration: 0.2, ease: ease.out }}
                          className="size-1.5 rounded-full bg-fg"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => m.unread && toggleRead(m.id)}
                            className="min-w-0 truncate text-left text-[13px] font-medium tracking-[-0.005em] text-fg outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-solid focus-visible:after:outline-1 focus-visible:after:-outline-offset-2 focus-visible:after:outline-fg-3"
                          >
                            <span className={m.unread ? "text-fg" : "text-fg-2"}>{m.from}</span>
                          </button>
                          <span className="tabular shrink-0 text-[12px] text-fg-3">{m.time}</span>
                        </div>
                        <p className={`truncate text-[12.5px] ${m.unread ? "text-fg" : "text-fg-2"}`}>{m.subject}</p>
                        <p className="truncate text-[12.5px] text-fg-3">{m.preview}</p>
                      </div>
                    </div>
                  </SwipeActions>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
            <p className="text-[13px] font-medium text-fg">Inbox zero</p>
            <p className="text-[12.5px] text-fg-3">Nothing left to triage.</p>
            <button
              type="button"
              onClick={() => setItems(inbox)}
              className="mt-3 inline-flex h-8 items-center rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Restore messages
            </button>
          </div>
        )}
      </div>

      {/* Undo lives beside the list it changed, and says what it will bring back. */}
      <div className="h-9" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {undo && (
            <motion.div
              key={undo.item.id + undo.verb}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, ease: ease.out }}
              className="flex h-9 items-center justify-between gap-3 rounded-lg border border-line-2 bg-raised pl-3 pr-1 shadow-pop"
            >
              <span className="min-w-0 truncate text-[12.5px] text-fg-2">
                {undo.verb} <span className="text-fg">{undo.item.subject}</span>
              </span>
              <button
                type="button"
                onClick={restore}
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.97]"
              >
                <Undo /> Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
