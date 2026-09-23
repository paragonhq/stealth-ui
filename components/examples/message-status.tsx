"use client";
import { useEffect, useRef, useState } from "react";
import { MessageStatus, type MessageStatusValue } from "@/components/ui/message-status";

type Sent = { id: number; text: string; status: MessageStatusValue; time: string };

const outbox = [
  "Staging is green. Promoting build 482 to production now.",
  "Rollback plan is in the incident doc if we need it.",
  "Deploy finished. Error rate is flat.",
];

const clock = (minute: number) => `9:${String(41 + minute).padStart(2, "0")}`;

export default function Demo() {
  const [offline, setOffline] = useState(false);
  const [messages, setMessages] = useState<Sent[]>([
    { id: 0, text: "Can you check the Q3 forecast before the 10:00 review?", status: "read", time: clock(0) },
  ]);
  const timers = useRef<number[]>([]);
  const offlineRef = useRef(offline);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const set = (id: number, status: MessageStatusValue) => setMessages((all) => all.map((m) => (m.id === id ? { ...m, status } : m)));
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // Slow enough that the clock shows, then the receipts arrive one by one, like a real round trip.
  const deliver = (id: number) => {
    set(id, "sending");
    later(1300, () => {
      if (offlineRef.current) return set(id, "failed");
      set(id, "sent");
      later(900, () => set(id, "delivered"));
      later(2200, () => set(id, "read"));
    });
  };

  const next = outbox[(messages.length - 1) % outbox.length];
  const send = () => {
    const id = messages.length;
    setMessages((all) => [...all, { id, text: next, status: "sending", time: clock(id) }]);
    deliver(id);
  };

  const last = messages[messages.length - 1];

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-xl border border-line bg-raised p-3 shadow-[var(--shadow)]">
        <ul aria-label="Messages to Priya Raman" className="flex max-h-[232px] flex-col items-end gap-1 overflow-y-auto overscroll-contain">
          {messages.map((m) => (
            <li key={m.id} className="flex max-w-[85%] items-end gap-1.5">
              {m.id !== last.id && <MessageStatus status={m.status} time={m.time} className="mb-1" onRetry={() => deliver(m.id)} />}
              <p className="rounded-2xl bg-fg px-3 py-2 text-[13px] leading-5 text-pretty text-frame">{m.text}</p>
            </li>
          ))}
        </ul>
        <div className="flex justify-end pr-1 pt-0.5">
          <MessageStatus key={last.id} status={last.status} time={last.time} label onRetry={() => deliver(last.id)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
        <p className="text-[12px] text-fg-3">{offline ? "Offline: sends will fail" : "Receipts arrive in about 3s"}</p>
        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            aria-pressed={offline}
            onClick={() => setOffline((o) => !o)}
            className="inline-flex h-8 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            {offline ? "Go online" : "Go offline"}
          </button>
        <button
          type="button"
          onClick={send}
          className="inline-flex h-8 items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          Send message
        </button>
        </div>
      </div>
    </div>
  );
}
