"use client";
import { useEffect, useRef, useState } from "react";
import { MessageComposer } from "@/components/ui/message-composer";
import { ReplyPreview, ReplyQuote, type ReplyTarget } from "@/components/ui/reply-preview";

type Msg = { id: string; author: "Maya Chen" | "You"; text: string; replyTo?: ReplyTarget };

const initial: Msg[] = [
  { id: "m1", author: "Maya Chen", text: "Can you send over the Q3 forecast before the board call? Priya wants the EMEA split on its own slide." },
  { id: "m2", author: "You", text: "Yes, finishing the appendix now." },
  { id: "m3", author: "Maya Chen", text: "Also, are we still presenting the hiring plan or pushing it to October?" },
  { id: "m4", author: "You", text: "Pushing it. Headcount isn’t signed off yet." },
  { id: "m5", author: "Maya Chen", text: "Makes sense. I’ll tell Jon." },
  {
    id: "m6",
    author: "Maya Chen",
    text: "One more thing on the forecast: use the revised FX rates from Friday.",
    replyTo: { id: "m1", author: "Maya Chen", text: "Can you send over the Q3 forecast before the board call? Priya wants the EMEA split on its own slide." },
  },
];

export default function Demo() {
  const [messages, setMessages] = useState(initial);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const count = useRef(0);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const reply = (m: Msg) => {
    setReplyTo({ id: m.id, author: m.author, text: m.text });
    list.current?.closest("[data-demo]")?.querySelector("textarea")?.focus();
  };

  return (
    <div data-demo className="flex h-[440px] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
      <ul ref={list} aria-label="Conversation with Maya Chen" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-3 [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-12px),transparent)]">
        {messages.map((m) => {
          const own = m.author === "You";
          return (
            <li key={m.id} data-message-id={m.id} className="group/row flex items-center gap-1.5 px-4 py-0.5 outline-none focus-visible:bg-hover data-[own]:flex-row-reverse" data-own={own || undefined}>
              <div
                data-bubble
                className={
                  own
                    ? "flex max-w-[78%] flex-col gap-1.5 rounded-2xl bg-fg px-3 py-2 text-[13px] leading-5 text-frame"
                    : "flex max-w-[78%] flex-col gap-1.5 rounded-2xl bg-fg/[0.07] px-3 py-2 text-[13px] leading-5 text-fg"
                }
              >
                {m.replyTo && <ReplyQuote target={m.replyTo} className="-mx-1.5 -mt-0.5 w-auto" />}
                <span className="text-pretty">{m.text}</span>
              </div>
              <button
                type="button"
                aria-label={`Reply to “${m.text.slice(0, 40)}”`}
                onClick={() => reply(m)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 opacity-0 outline-none transition-[opacity,background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.9] group-hover/row:opacity-100 pointer-coarse:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6.5 4 3 7.5 6.5 11M3 7.5h6a4 4 0 0 1 4 4v1" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 px-3 pb-3">
        <MessageComposer
          placeholder="Message Maya"
          label="Message Maya Chen"
          header={<ReplyPreview target={replyTo} onCancel={() => setReplyTo(null)} />}
          onSend={({ text }) => {
            count.current += 1;
            setMessages((all) => [...all, { id: `sent-${count.current}`, author: "You", text, replyTo: replyTo ?? undefined }]);
            setReplyTo(null);
          }}
        />
      </div>
    </div>
  );
}
