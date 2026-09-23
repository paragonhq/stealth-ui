"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { NewItemsPill, useNewItems } from "@/components/ui/new-items-pill";

type Event = { id: string; who: string; did: string; what: string; when: string };

const initial: Event[] = [
  { id: "e8", who: "Maya Chen", did: "deployed", what: "web@4f2a1c to production", when: "4m" },
  { id: "e7", who: "Leo Park", did: "commented on", what: "INV-2041 · Annual renewal", when: "12m" },
  { id: "e6", who: "Priya Raman", did: "merged", what: "#1182 Retry webhooks with backoff", when: "26m" },
  { id: "e5", who: "Tom Weiss", did: "uploaded", what: "q3-forecast.xlsx", when: "41m" },
  { id: "e4", who: "Maya Chen", did: "resolved", what: "INC-88 · Elevated 502s on api-eu", when: "1h" },
  { id: "e3", who: "Ana Souza", did: "invited", what: "jordan@northwind.io to Platform", when: "2h" },
  { id: "e2", who: "Leo Park", did: "closed", what: "#1174 Flaky checkout test", when: "3h" },
  { id: "e1", who: "Priya Raman", did: "rotated", what: "the production signing key", when: "5h" },
];

const incoming: Omit<Event, "id" | "when">[] = [
  { who: "Ana Souza", did: "approved", what: "#1190 Rate limit the export API" },
  { who: "Tom Weiss", did: "deployed", what: "api@9b31e0 to staging" },
  { who: "Maya Chen", did: "commented on", what: "INC-91 · Slow dashboard queries" },
  { who: "Jordan Lee", did: "joined", what: "the Platform team" },
  { who: "Leo Park", did: "paid", what: "INV-2044 · $1,280.00" },
];

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

// A team activity feed that keeps receiving events while you read it.
export default function Demo() {
  const reduce = useReducedMotion();
  const [events, setEvents] = useState(initial);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef(0);
  const { visible, pending, reveal, fresh } = useNewItems(events, { getKey: (e) => e.id, scrollRef });

  const push = useCallback(() => {
    const n = next.current++;
    const e = incoming[n % incoming.length];
    setEvents((list) => [{ ...e, id: `n${n}`, when: "now" }, ...list]);
  }, []);

  // New events keep arriving every few seconds, but only while the demo is on screen and the tab is visible.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (!document.hidden && next.current < 12) push();
    }, 4200);
    return () => window.clearInterval(id);
  }, [paused, push]);

  return (
    <div ref={card} className="relative w-full max-w-[380px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Activity</p>
        <button
          type="button"
          onClick={push}
          className="h-7 rounded-md px-2 text-[12px] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.96] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
        >
          Simulate event
        </button>
      </div>

      <div className="relative">
        <NewItemsPill count={pending.length} onReveal={reveal} noun={{ one: "new event", other: "new events" }} authors={pending.map((e) => ({ id: e.id, name: e.who })).reverse()} />
        <div ref={scrollRef} tabIndex={0} aria-label="Activity feed" className="h-[340px] overflow-y-auto overscroll-contain outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3">
          <ul className="flex flex-col py-1">
            <AnimatePresence initial={false}>
              {visible.map((e) => {
                const isFresh = fresh.has(e.id);
                const order = isFresh ? [...fresh].indexOf(e.id) : 0;
                return (
                  <motion.li
                    key={e.id}
                    layout={reduce ? false : "position"}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(2px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={reduce ? { duration: 0.15 } : { ...spring.soft, delay: Math.min(order, 8) * 0.03 }}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 transition-colors",
                      isFresh ? "bg-hover duration-150" : "bg-transparent duration-1000",
                    )}
                  >
                    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
                      {initials(e.who)}
                    </span>
                    <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-fg-2">
                      <span className="font-medium text-fg">{e.who}</span> {e.did} <span className="text-fg">{e.what}</span>
                    </p>
                    <span className="shrink-0 pt-px text-[12px] text-fg-3 tabular">{e.when}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}
