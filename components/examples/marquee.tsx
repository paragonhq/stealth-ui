"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Pause, Play } from "@/lib/icons";
import { spring, swap } from "@/lib/motion";
import { Marquee } from "@/components/ui/marquee";

// Simple geometric marks so the wordmarks read as logos without being anyone's.
const marks = [
  <circle key="c" cx="8" cy="8" r="5.5" />,
  <path key="t" d="M8 2.5 13.5 13h-11z" />,
  <rect key="s" x="3" y="3" width="10" height="10" rx="2.5" />,
  <path key="d" d="M8 2.5 13.5 8 8 13.5 2.5 8z" />,
  <path key="h" d="M3 3h4v10H3zM9 3h4v10H9z" />,
  <path key="r" d="M3 13V6a3 3 0 0 1 3-3h7v7a3 3 0 0 1-3 3z" />,
];
const customers = ["Northwind", "Halcyon", "Lumen", "Parcel", "Quartz", "Meridian", "Arcadia", "Fieldnote"];

const quotes = [
  { body: "Previews cut our review time in half.", who: "Priya Raman", org: "Halcyon" },
  { body: "We stopped arguing about staging.", who: "Tom Okafor", org: "Parcel" },
  { body: "Rollbacks take one click and four seconds.", who: "Ines Duarte", org: "Quartz" },
  { body: "The build cache paid for itself in a week.", who: "Sam Whitfield", org: "Lumen" },
];

// A customer strip under a pricing page: logos drift left, quotes drift right.
// Hover or press either row and it eases to a stop; tab into a logo and it
// holds still; the pause control stops both for good.
export default function Demo() {
  const [paused, setPaused] = useState(false);

  return (
    <section aria-labelledby="customers-title" className="flex w-full max-w-[520px] flex-col gap-4 overflow-hidden rounded-xl border border-line-2 bg-raised py-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id="customers-title" className="text-[14px] font-medium tracking-[-0.015em] text-fg">Shipping on Stealth</h3>
          <p className="text-[12px] text-fg-3"><span className="tabular text-fg-2">1,240</span> teams deploy every day</p>
        </div>
        {/* With reduced motion the rows don't move and become scrollable, so there is nothing to pause. */}
        <button
            type="button"
            aria-pressed={paused}
            aria-label="Pause scrolling"
            onClick={() => setPaused((p) => !p)}
            className="relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 motion-reduce:hidden text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 before:absolute before:-inset-2 before:content-[''] hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.96] active:duration-75 pointer-fine:before:hidden"
          >
            <span className="relative grid size-3.5 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span key={paused ? "play" : "pause"} className="absolute inset-0 grid place-items-center" initial={swap.initial} animate={swap.animate} exit={swap.exit} transition={spring.pop}>
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="grid">
              <span aria-hidden className="invisible col-start-1 row-start-1">Resume</span>
              <span className="col-start-1 row-start-1">{paused ? "Resume" : "Pause"}</span>
            </span>
          </button>
      </div>

      <Marquee aria-label="Customers" paused={paused} speed={36} gap={28} fade={48} className="py-1">
        {customers.map((name, i) => (
          <a
            key={name}
            href={`#customers/${name.toLowerCase()}`}
            className="flex h-8 shrink-0 items-center gap-2 rounded-md px-1.5 text-[15px] font-medium tracking-[-0.02em] text-fg-3 outline-none transition-colors duration-150 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
              {marks[i % marks.length]}
            </svg>
            {name}
          </a>
        ))}
      </Marquee>

      <Marquee aria-label="What customers say" paused={paused} reverse speed={24} gap={10} fade={48}>
        {quotes.map((q) => (
          <figure key={q.who} className="flex w-[232px] shrink-0 flex-col gap-2 rounded-lg border border-line bg-frame p-3">
            <blockquote className="text-[12.5px] leading-snug text-fg text-pretty">“{q.body}”</blockquote>
            <figcaption className="truncate text-[11.5px] text-fg-3">
              {q.who} · {q.org}
            </figcaption>
          </figure>
        ))}
      </Marquee>
    </section>
  );
}
