"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Send } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { ChatScroll, ChatScrollViewport, JumpToLatest, useChatScroll } from "@/components/ui/jump-to-latest";

type Msg = { id: number; who: string; text: string; mine?: boolean };

const history: Msg[] = [
  { who: "Priya Shah", text: "Morning. Launch is today at 14:00 UTC, this channel is the war room." },
  { who: "Sam Okafor", text: "Support is staffed until midnight, two people on the queue." },
  { who: "Jonas Weber", text: "Feature flags are set: new-pricing at 0%, kill switch tested on staging." },
  { who: "Maya Chen", text: "Invoices for existing customers keep their current plan until renewal." },
  { who: "Priya Shah", text: "Launch checklist is pinned. Two items left: status page copy and the pricing FAQ." },
  { who: "Jonas Weber", text: "Status page copy is in review, should be merged within the hour." },
  { who: "Maya Chen", text: "Pricing FAQ is done. I added the annual-to-monthly downgrade question." },
  { who: "Sam Okafor", text: "Support macros are loaded for the new plans." },
  { who: "Priya Shah", text: "Great. Rollout starts at 14:00 UTC, 10% first." },
  { who: "Jonas Weber", text: "Dashboards are up: error rate, checkout conversion, p95 latency." },
  { who: "Maya Chen", text: "I’ll watch billing webhooks during the first hour." },
].map((m, i) => ({ ...m, id: i + 1 }));

const script = [
  { who: "Priya Shah", text: "10% is live. Error rate is flat." },
  { who: "Jonas Weber", text: "p95 checkout latency 412ms, same as yesterday." },
  { who: "Maya Chen", text: "First 38 upgrades went through, webhooks all delivered." },
  { who: "Sam Okafor", text: "One ticket so far, a question about proration. Answered." },
  { who: "Priya Shah", text: "Going to 50% in five minutes unless anyone objects." },
  { who: "Jonas Weber", text: "No objections from infra." },
  { who: "Maya Chen", text: "Billing looks healthy. Go for it." },
  { who: "Priya Shah", text: "50% is live." },
];

function Bubble({ m }: { m: Msg }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      // History is already there on load; only messages that arrive afterwards slide in.
      initial={m.id <= history.length ? false : reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: ease.out }}
      className="flex gap-2.5 px-4 py-1.5"
    >
      <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-fg/[0.08] text-[11px] font-medium text-fg-2">
        {m.mine ? "Y" : m.who.split(" ").map((p) => p[0]).join("")}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{m.mine ? "You" : m.who}</p>
        <p className="text-[13px] leading-[1.45] text-fg-2 text-pretty">{m.text}</p>
      </div>
    </motion.li>
  );
}

function Composer({ onSend }: { onSend: (text: string) => void }) {
  const { scrollToBottom } = useChatScroll();
  const [text, setText] = useState("");
  const send = () => {
    const t = text.trim();
    if (!t) return;
    // Your own message always brings you back to the bottom.
    scrollToBottom();
    onSend(t);
    setText("");
  };
  return (
    <form
      className="flex items-center gap-2 border-t border-line p-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="jump-demo-input" className="sr-only">
        Message #launch
      </label>
      <input
        id="jump-demo-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message #launch"
        enterKeyHint="send"
        autoComplete="off"
        className="h-8 min-w-0 flex-1 rounded-lg border border-line-2 bg-frame px-2.5 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-4 focus:border-fg-4 focus:ring-2 focus:ring-fg/10 sm:text-[13px]"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!text.trim()}
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-fg text-frame outline-none transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92] disabled:opacity-40"
      >
        <Send size={14} />
      </button>
    </form>
  );
}

export default function Demo() {
  const [messages, setMessages] = useState(history);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const step = useRef(0);

  // Teammates keep posting while the demo is on screen and the tab is visible.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const t = window.setInterval(() => {
      // Stops after a while, so a tab left open doesn't grow forever.
      if (document.hidden || step.current >= 40) return;
      const next = script[step.current % script.length];
      step.current++;
      setMessages((list) => [...list, { id: list.length + 1, who: next.who, text: next.text }]);
    }, 2600);
    return () => window.clearInterval(t);
  }, [visible]);

  return (
    <div ref={root} className="w-full max-w-[440px]">
      <ChatScroll itemCount={messages.length} className="h-[400px] overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
          <span className="text-[13px] font-medium text-fg"># launch</span>
          <span className="text-[12px] text-fg-3">Scroll up while people are posting</span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ChatScrollViewport aria-label="Messages in launch" className="py-2" contentProps={{ role: "log", "aria-live": "polite", "aria-relevant": "additions" }}>
            <ul>
              {messages.map((m) => (
                <Bubble key={m.id} m={m} />
              ))}
            </ul>
          </ChatScrollViewport>
          <JumpToLatest />
        </div>
        <Composer onSend={(text) => setMessages((list) => [...list, { id: list.length + 1, who: "You", text, mine: true }])} />
      </ChatScroll>
    </div>
  );
}
