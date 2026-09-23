"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight, Clock, CornerDownLeft, Folder, Mail, Trash, Undo, VolumeOff } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { RowActions } from "@/components/ui/row-actions";

type Thread = { id: string; from: string; subject: string; snippet: string; time: string; unread: boolean; snoozed?: boolean };

const seed: Thread[] = [
  { id: "1", from: "Maya Chen", subject: "Launch review moved to Thursday", snippet: "Legal needs one more pass on the pricing page copy before we", time: "9:41", unread: true },
  { id: "2", from: "Billing", subject: "Invoice INV-2081 is ready", snippet: "Your September invoice for $1,240.00 is available to download", time: "8:02", unread: true },
  { id: "3", from: "Dev Patel", subject: "Re: flaky checkout test", snippet: "Found it — the fixture clock drifts past midnight UTC, so the", time: "Yesterday", unread: false },
  { id: "4", from: "Priya Raman", subject: "Contract redlines", snippet: "Two small changes in section 4. Nothing blocking, but can you", time: "Mon", unread: false },
];

const archive = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.25" y="3" width="11.5" height="3" rx="1" />
    <path d="M3.25 6v6.25a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V6M6.5 8.75h3" />
  </svg>
);

// An inbox. Hover or tab onto a thread: archive, snooze and read slide in over the time,
// the rest wait in the menu. Keys work too: E archives the focused thread.
export default function Demo() {
  const [threads, setThreads] = useState(seed);
  const [undo, setUndo] = useState<{ thread: Thread; index: number; verb: string } | null>(null);
  const reduce = useReducedMotion();
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const remove = (t: Thread, verb: string) => {
    const index = threads.findIndex((x) => x.id === t.id);
    setThreads((prev) => prev.filter((x) => x.id !== t.id));
    setUndo({ thread: t, index, verb });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUndo(null), 6000);
  };
  const update = (id: string, patch: Partial<Thread>) => setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Inbox</p>
        <p className="text-[12px] text-fg-3 tabular">
          {threads.filter((t) => t.unread).length ? `${threads.filter((t) => t.unread).length} unread` : "All read"}
        </p>
      </div>

      <ul className="flex min-h-[248px] flex-col p-1.5" aria-label="Inbox">
        <AnimatePresence initial={false}>
          {threads.map((t) => (
            <motion.li
              key={t.id}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: ease.inOut }}
              className="overflow-hidden"
            >
              <RowActions
                label={t.subject}
                trailing={t.snoozed ? <span className="flex items-center gap-1"><Clock size={12} />Tomorrow</span> : t.time}
                actions={[
                  { id: "archive", label: "Archive", icon: archive, shortcut: "e", inline: true, onSelect: () => remove(t, "Archived") },
                  { id: "snooze", label: t.snoozed ? "Unsnooze" : "Snooze until tomorrow", icon: <Clock />, shortcut: "h", inline: true, onSelect: () => update(t.id, { snoozed: !t.snoozed }) },
                  { id: "read", label: t.unread ? "Mark as read" : "Mark as unread", icon: <Mail />, shortcut: "u", inline: true, onSelect: () => update(t.id, { unread: !t.unread }) },
                  { id: "reply", label: "Reply", icon: <CornerDownLeft />, shortcut: "r", onSelect: () => update(t.id, { unread: false }) },
                  { id: "forward", label: "Forward", icon: <ArrowRight />, shortcut: "f", onSelect: () => update(t.id, { unread: false }) },
                  { id: "move", label: "Move to…", icon: <Folder />, onSelect: () => {} },
                  { id: "mute", label: "Mute thread", icon: <VolumeOff />, onSelect: () => remove(t, "Muted") },
                  { id: "delete", label: "Delete", icon: <Trash />, shortcut: "#", tone: "danger", separated: true, onSelect: () => remove(t, "Deleted") },
                ]}
              >
                <button
                  type="button"
                  onClick={() => update(t.id, { unread: false })}
                  className="flex w-full min-w-0 items-start gap-2.5 text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:outline-solid focus-visible:after:outline-1 focus-visible:after:-outline-offset-1 focus-visible:after:outline-fg-3"
                >
                  <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full transition-[background-color,scale] duration-200", t.unread ? "bg-fg" : "scale-50 bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px] transition-colors duration-150", t.unread ? "font-medium text-fg" : "text-fg-2")}>
                      {t.from}
                      <span className="sr-only">{t.unread ? ", unread" : ""}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-fg-3">
                      <span className={t.unread ? "text-fg-2" : undefined}>{t.subject}</span> — {t.snippet}
                    </span>
                  </span>
                </button>
              </RowActions>
            </motion.li>
          ))}
        </AnimatePresence>
        {threads.length === 0 && (
          <li className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <p className="text-[13px] text-fg-2">Your inbox is empty</p>
            <button
              type="button"
              onClick={() => setThreads(seed)}
              className="inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              Restore messages
            </button>
          </li>
        )}
      </ul>

      <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
        <AnimatePresence>
          {undo && (
            <motion.div
              key={undo.thread.id + undo.verb}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, transition: { duration: 0.14 } }}
              transition={{ duration: 0.24, ease: ease.out }}
              className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-line-2 bg-raised py-1 pl-3 pr-1 text-[12.5px] text-fg-2 shadow-pop"
            >
              <span className="min-w-0 truncate">
                {undo.verb} <span className="text-fg">{undo.thread.subject}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const { thread, index } = undo;
                  setThreads((prev) => [...prev.slice(0, index), thread, ...prev.slice(index)]);
                  setUndo(null);
                }}
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.96] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
              >
                <Undo size={14} />
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
