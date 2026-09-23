"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Send } from "@/lib/icons";
import { TypingIndicator, type TypingPerson } from "@/components/ui/typing-indicator";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=96&h=96&fit=crop&crop=faces&q=70`;

const team: (TypingPerson & { says: string })[] = [
  { id: "ana", name: "Ana Ruiz", src: photo("1494790108377-be9c29b29330"), says: "Staging is green, promoting now." },
  { id: "ben", name: "Ben Carter", src: photo("1507003211169-0a1dd7228f2d"), says: "Hold on, the migration is still running." },
  { id: "chen", name: "Chen Wei", says: "Changelog draft is in the doc." },
  { id: "dev", name: "Dev Patel", src: photo("1500648767791-00dcc994a43e"), says: "I’ll watch error rates for the first hour." },
];

type Message = { id: number; who: string; text: string };

export default function Demo() {
  const reduce = useReducedMotion();
  const [typing, setTyping] = useState<string[]>(["ana"]);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, who: "Ben Carter", text: "Migration dry run passed on the replica." },
    { id: 1, who: "Dev Patel", text: "Release notes for 4.2 are approved." },
    { id: 2, who: "Chen Wei", text: "Deploy window opens at 14:00." },
  ]);
  const people = team.filter((t) => typing.includes(t.id));

  // Stopping means they sent it: the line shrinks as their message lands in the thread.
  const toggle = (id: string) => {
    if (!typing.includes(id)) return setTyping((t) => [...t, id]);
    const who = team.find((t) => t.id === id)!;
    setTyping((t) => t.filter((x) => x !== id));
    setMessages((m) => [...m.slice(-4), { id: Date.now(), who: who.name, text: who.says }]);
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      {/* The composer is pinned: when the line opens, the thread gives up the room, not the page. */}
      <div className="flex h-[292px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-10 items-center border-b border-line px-3.5 text-[13px] font-medium tracking-[-0.01em] text-fg">
          <span className="text-fg-3">#</span>
          <span className="ml-1">release-4-2</span>
        </div>
        <ul className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3.5 pb-1 pt-3" aria-label="Messages">
          <AnimatePresence initial={false} mode="popLayout">
            {messages.map((m) => (
              <motion.li
                key={m.id}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
                className="flex shrink-0 flex-col gap-0.5 text-[12.5px] leading-5"
              >
                <span className="text-[12px] font-medium text-fg">{m.who}</span>
                <span className="text-fg-2">{m.text}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="shrink-0 px-3 pb-3">
          <TypingIndicator people={people} className="px-0.5" />
          <div className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-line-2 bg-frame pl-3 pr-1 text-[13px] text-fg-4">
            <span className="flex-1 truncate">Message #release-4-2</span>
            <span className="grid size-7 place-items-center rounded-md text-fg-4">
              <Send size={14} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-center text-[12px] text-fg-3">Start and stop typing as a teammate</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {team.map((t) => {
            const on = typing.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.id)}
                className="group/chip inline-flex h-7 items-center gap-1.5 rounded-full border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,border-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75 aria-pressed:border-fg-4 aria-pressed:bg-hover aria-pressed:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-fg-4 transition-colors duration-150 group-aria-pressed/chip:bg-fg" />
                {t.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* A thread has a fixed height; the bubble opens at the bottom and pushes older messages up. */}
      <div className="flex h-[132px] flex-col justify-end gap-1 overflow-hidden rounded-xl border border-line bg-raised px-3 pb-3 pt-2.5 shadow-[var(--shadow)]">
        <p className="mb-auto text-[11.5px] text-fg-3">Direct message with Ana Ruiz</p>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-fg px-3 py-1.5 text-[12.5px] leading-5 text-frame">Can you check the invoice total?</div>
        <TypingIndicator people={people.filter((p) => p.id === "ana")} variant="bubble" />
      </div>
    </div>
  );
}
