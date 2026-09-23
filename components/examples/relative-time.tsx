"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { ease } from "@/lib/motion";
import { RelativeTime, type RelativeTimeFormat } from "@/components/ui/relative-time";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// The feed is anchored to when the page opened, on the client only, so the
// server and the first client render agree.
let opened = 0;
const noop = () => () => {};
const getOpened = () => opened || (opened = Date.now());

type Entry = { id: string; who: string; initials: string; what: React.ReactNode; offset: number };

const seed: Entry[] = [
  { id: "deploy", who: "Maya Chen", initials: "MC", what: <>deployed <b>web@4f2a1c</b> to production</>, offset: 0 },
  { id: "comment", who: "Jonas Weber", initials: "JW", what: <>commented on <b>q3-forecast.xlsx</b></>, offset: -4 * MIN },
  { id: "invoice", who: "Stripe", initials: "S", what: <>marked invoice <b>INV-2041</b> as paid</>, offset: -3 * HOUR },
  { id: "join", who: "Priya Nair", initials: "PN", what: <>joined <b>Design</b></>, offset: -2 * DAY },
  { id: "ssl", who: "Certificates", initials: "SSL", what: <>renew for <b>app.northwind.io</b></>, offset: 12 * DAY },
];

const formats: RelativeTimeFormat[] = ["long", "short", "narrow"];

// A team activity feed: one row ticks live from "now", the future one flips to
// a date past a week, and hovering any time shows the full date and zone.
export default function Demo() {
  const base = useSyncExternalStore(noop, getOpened, () => 0);
  const reduce = useReducedMotion();
  const [format, setFormat] = useState<RelativeTimeFormat>("long");
  const [posted, setPosted] = useState<{ id: string; at: number }[]>([]);

  const rows = [
    ...posted.map((p) => ({ id: p.id, who: "You", initials: "Y", what: <>pinned the <b>release notes</b></>, at: p.at })),
    ...seed.map((e) => ({ ...e, at: base + e.offset })),
  ].slice(0, 5);

  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h3 className="text-[13px] font-medium text-fg">Activity</h3>
        <div role="group" aria-label="Time format" className="flex rounded-lg border border-line bg-raised p-0.5">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className="h-6 rounded-md px-2 text-[12px] capitalize text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:text-fg active:scale-[0.96] aria-pressed:bg-fg/8 aria-pressed:text-fg focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col py-1.5">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li
              key={r.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.26, ease: ease.out }}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-raised text-[10px] font-medium tracking-[0.02em] text-fg-2">
                {r.initials}
              </span>
              <p className="min-w-0 flex-1 truncate text-[12.5px] text-fg-2 [&_b]:font-medium [&_b]:text-fg">
                <span className="text-fg">{r.who}</span> {r.what}
              </p>
              <span className="min-w-[4.5rem] shrink-0 text-right text-[12px] text-fg-3">
                {base > 0 && <RelativeTime date={r.at} format={format} />}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
        <p className="min-w-0 truncate text-[12px] text-fg-3">Times update live</p>
        <button
          type="button"
          onClick={() => setPosted((p) => [{ id: `pin-${Date.now()}`, at: Date.now() }, ...p])}
          className="h-7 shrink-0 whitespace-nowrap rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          Pin release notes
        </button>
      </div>
    </div>
  );
}
