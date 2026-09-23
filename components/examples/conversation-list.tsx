"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ease } from "@/lib/motion";
import { ConversationList, type Conversation } from "@/components/ui/conversation-list";

const initial: Conversation[] = [
  { id: "crit", name: "Design crit", sender: "Priya", preview: "Pushed the new onboarding flow, comments welcome before Thursday", time: "9:41", unread: 3, mention: true, pinned: true },
  { id: "maya", name: "Maya Chen", online: true, preview: "Can you look over q3-forecast.xlsx before the 3pm?", time: "9:12", unread: 1, pinned: true },
  { id: "jonas", name: "Jonas Weber", sender: "You", preview: "Sounds good, I’ll ship it after standup", time: "8:55" },
  { id: "oncall", name: "Infra on-call", sender: "Deploy bot", preview: "api-gateway rolled back to v2.14.3 in eu-west-1", time: "8:31", unread: 12, muted: true },
  { id: "lena", name: "Lena Park", draft: "Let me check with legal and get back to you on the", time: "Yesterday" },
  { id: "sam", name: "Sam Okafor", online: true, preview: "Thanks, the invoice went through this morning", time: "Yesterday" },
  { id: "hiring", name: "Hiring — Product design", sender: "Ren", preview: "Portfolio review moved to Thursday at 2pm", time: "Mon" },
  { id: "ava", name: "Ava Rossi", sender: "You", preview: "Photo", time: "12 Sep" },
];

// A scripted afternoon: someone types for a moment, then their message lands.
const script: { id: string; text: string; who?: string }[] = [
  { id: "maya", text: "Also, the revenue tab has a broken formula in row 42" },
  { id: "sam", text: "Could we move our 1:1 to 4pm today?" },
  { id: "crit", who: "Priya", text: "Updated the empty states too, same file" },
  { id: "ava", text: "Love these, can you send the originals?" },
];

export default function Demo() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState(initial);
  const [value, setValue] = useState<string | null>("jonas");
  const [archived, setArchived] = useState<{ c: Conversation; index: number } | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);
  // The open chat never collects a badge, even if you opened it while they were typing.
  const selected = useRef<string | null>("jonas");
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const update = (id: string, patch: Partial<Conversation>) => setItems((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const receive = () => {
    const next = script[step % script.length];
    setStep((s) => s + 1);
    setBusy(true);
    update(next.id, { typing: next.who ?? true });
    timers.current.push(
      window.setTimeout(() => {
        setBusy(false);
        setItems((list) => {
          const c = list.find((x) => x.id === next.id);
          if (!c) return list;
          const open = selected.current === c.id;
          const bumped: Conversation = { ...c, typing: false, sender: next.who, draft: undefined, preview: next.text, time: new Date(), unread: open ? 0 : (c.unread ?? 0) + 1, markedUnread: false };
          // Newest first within its section: the row springs to the top.
          const rest = list.filter((x) => x.id !== c.id);
          const at = c.pinned ? 0 : rest.findIndex((x) => !x.pinned);
          return [...rest.slice(0, at < 0 ? rest.length : at), bumped, ...rest.slice(at < 0 ? rest.length : at)];
        });
      }, 1600),
    );
  };

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-12 items-center justify-between border-b border-line pl-4 pr-2">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Messages</h3>
          <button
            type="button"
            onClick={receive}
            disabled={busy}
            className="h-7 rounded-md px-2 text-[12px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:opacity-50"
          >
            Simulate a message
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto overscroll-contain p-1.5">
          <ConversationList
            conversations={items}
            value={value}
            onValueChange={(id) => {
              selected.current = id;
              setValue(id);
              update(id, { unread: 0, markedUnread: false });
            }}
            onReadChange={(id, read) => update(id, read ? { unread: 0, markedUnread: false } : { markedUnread: true })}
            onPinnedChange={(id, pinned) =>
              setItems((list) => {
                const c = list.find((x) => x.id === id)!;
                const rest = list.filter((x) => x.id !== id);
                return pinned ? [{ ...c, pinned }, ...rest] : [...rest.filter((x) => x.pinned), { ...c, pinned }, ...rest.filter((x) => !x.pinned)];
              })
            }
            onMutedChange={(id, muted) => update(id, { muted })}
            onArchive={(id) => {
              const index = items.findIndex((x) => x.id === id);
              if (index < 0) return;
              setArchived({ c: items[index], index });
              if (value === id) {
                selected.current = null;
                setValue(null);
              }
              setItems((list) => list.filter((x) => x.id !== id));
            }}
          />
        </div>
      </div>

      <div className="relative h-8" aria-live="polite">
        <AnimatePresence initial={false}>
          {archived && (
            <motion.div
              key={archived.c.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="absolute inset-0 flex items-center justify-between gap-3 rounded-lg border border-line bg-raised pl-3 pr-1 text-[12.5px] text-fg-2"
            >
              <span className="truncate">
                Archived <span className="text-fg">{archived.c.name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setItems((list) => [...list.slice(0, archived.index), archived.c, ...list.slice(archived.index)]);
                  setArchived(null);
                }}
                className="h-6 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-fg/[0.07] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
              >
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
