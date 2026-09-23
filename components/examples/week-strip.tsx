"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { Plus } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { WeekStrip } from "@/components/ui/week-strip";

type Event = { time: string; title: string; meta: string };

// Days are relative to today, which only the client knows.
const agenda: Record<number, Event[]> = {
  [-3]: [{ time: "16:00", title: "Sprint retro", meta: "45 min" }],
  [-1]: [{ time: "15:00", title: "Customer call · Northwind", meta: "30 min" }],
  0: [
    { time: "09:30", title: "Standup", meta: "15 min" },
    { time: "14:00", title: "Design review", meta: "Room 4B" },
  ],
  1: [{ time: "11:00", title: "1:1 with Jonas", meta: "30 min" }],
  3: [
    { time: "10:00", title: "Q3 planning", meta: "2 h" },
    { time: "13:00", title: "Lunch with Priya", meta: "Café Nord" },
    { time: "16:30", title: "Deploy window", meta: "web@4f2a1c" },
  ],
  5: [{ time: "09:00", title: "Launch week kickoff", meta: "All hands" }],
  8: [{ time: "10:00", title: "Hiring sync", meta: "30 min" }],
  10: [{ time: "14:00", title: "Board prep", meta: "1 h" }],
};

const noop = () => () => {};
let todayMs = 0;
const getToday = () => {
  if (!todayMs) {
    const n = new Date();
    todayMs = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }
  return todayMs;
};
const offsetOf = (d: Date, today: number) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today) / 86_400_000);

// A phone-style agenda: swipe or use the arrows to change week, and the dots
// come from the same events listed below. Adding one grows a dot on the strip.
export default function Demo() {
  const today = useSyncExternalStore(noop, getToday, () => 0);
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<Date | null>(null);
  const [added, setAdded] = useState<Record<number, Event[]>>({});
  const eventsOn = (offset: number) => [...(agenda[offset] ?? []), ...(added[offset] ?? [])];

  const current = selected ?? (today ? new Date(today) : null);
  const offset = current && today ? offsetOf(current, today) : 0;
  const events = eventsOn(offset);

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3 rounded-2xl border border-line p-3 sm:p-4">
      <WeekStrip value={selected} onValueChange={setSelected} markers={(d) => (today ? eventsOn(offsetOf(d, today)).length : 0)} />

      <div className="min-h-[148px] border-t border-line pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={offset}
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.18, ease: ease.out }}
          >
            {events.length ? (
              <ul className="flex flex-col">
                {events.map((e, i) => (
                  <li key={i} className="flex h-10 items-center gap-3 rounded-lg px-1">
                    <span className="w-11 shrink-0 font-mono text-[12px] text-fg-3 tabular">{e.time}</span>
                    <span className="h-5 w-px shrink-0 bg-line-2" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{e.title}</span>
                    <span className="shrink-0 text-[12px] text-fg-3">{e.meta}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-[120px] flex-col items-center justify-center gap-2.5">
                <p className="text-[13px] text-fg-3">Nothing scheduled</p>
                <button
                  type="button"
                  onClick={() => setAdded((a) => ({ ...a, [offset]: [...(a[offset] ?? []), { time: "12:00", title: "Focus time", meta: "1 h" }] }))}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-raised pl-2 pr-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                >
                  <Plus size={14} />
                  Block focus time
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
