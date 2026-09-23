"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Check } from "@/lib/icons";
import { spring } from "@/lib/motion";
import {
  SnapCarousel,
  SnapCarouselCounter,
  SnapCarouselDots,
  SnapCarouselNext,
  SnapCarouselPrevious,
  SnapCarouselSlide,
  SnapCarouselViewport,
} from "@/components/ui/snap-carousel";

const line = "rounded-full bg-fg-4/60";

const templates = [
  {
    id: "changelog",
    name: "Changelog",
    meta: "6 blocks",
    art: (
      <div className="flex h-full flex-col justify-center gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-fg-3" />
            <div className="flex flex-1 flex-col gap-1.5">
              <span className={`${line} h-1.5 w-1/3`} />
              <span className={`${line} h-1 w-4/5 opacity-60`} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "pricing",
    name: "Pricing page",
    meta: "9 blocks",
    art: (
      <div className="grid h-full grid-cols-3 items-end gap-2 p-4">
        {[0.62, 0.86, 0.62].map((h, i) => (
          <div key={i} className={`flex flex-col gap-1.5 rounded-md border p-2 ${i === 1 ? "border-fg-4 bg-hover" : "border-line-2"}`} style={{ height: `${h * 100}%` }}>
            <span className={`${line} h-1 w-2/3`} />
            <span className={`${line} h-1.5 w-1/2 bg-fg-3/70`} />
            <span className={`${line} mt-auto h-2 w-full ${i === 1 ? "bg-fg-2" : ""}`} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "docs",
    name: "Docs site",
    meta: "14 blocks",
    art: (
      <div className="flex h-full gap-3 p-4">
        <div className="flex w-1/4 flex-col gap-1.5 border-r border-line-2 pr-2">
          {[70, 90, 55, 80, 60].map((w, i) => (
            <span key={i} className={`${line} h-1 ${i === 1 ? "bg-fg-3" : ""}`} style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className={`${line} mb-1 h-2 w-1/2 bg-fg-3/70`} />
          {[95, 88, 92, 60].map((w, i) => (
            <span key={i} className={`${line} h-1 opacity-60`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "status",
    name: "Status page",
    meta: "4 blocks",
    art: (
      <div className="flex h-full flex-col justify-center gap-3 p-4">
        {[0, 1].map((r) => (
          <div key={r} className="flex flex-col gap-1.5">
            <span className={`${line} h-1 w-1/3`} />
            <div className="flex gap-[2px]">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className={`h-4 flex-1 rounded-[1px] ${r === 1 && i === 17 ? "bg-warning" : "bg-success/70"}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "invoice",
    name: "Invoice",
    meta: "5 blocks",
    art: (
      <div className="flex h-full flex-col gap-2 p-4">
        <div className="flex justify-between">
          <span className={`${line} h-2 w-1/4 bg-fg-3/70`} />
          <span className={`${line} h-1 w-1/5`} />
        </div>
        <div className="mt-1 flex flex-col gap-1.5 border-y border-line-2 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between">
              <span className={`${line} h-1 w-2/5 opacity-60`} />
              <span className={`${line} h-1 w-1/6 opacity-60`} />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <span className={`${line} h-1.5 w-1/4 bg-fg-3/70`} />
        </div>
      </div>
    ),
  },
  {
    id: "onboarding",
    name: "Onboarding checklist",
    meta: "7 blocks",
    art: (
      <div className="flex h-full flex-col justify-center gap-2 p-4">
        {[true, true, false, false].map((done, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`grid size-2.5 place-items-center rounded-[3px] border ${done ? "border-fg-3 bg-fg-3" : "border-fg-4"}`} />
            <span className={`${line} h-1 ${done ? "opacity-40" : ""}`} style={{ width: `${[60, 45, 70, 50][i]}%` }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "blog",
    name: "Blog post",
    meta: "8 blocks",
    art: (
      <div className="flex h-full flex-col gap-2 p-4">
        <div className="h-1/2 rounded-md border border-line-2 bg-hover" />
        <span className={`${line} h-1.5 w-3/5 bg-fg-3/70`} />
        <span className={`${line} h-1 w-11/12 opacity-60`} />
      </div>
    ),
  },
];

// A template gallery: a row people browse, then pick one from.
export default function Demo() {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState("changelog");

  return (
    <SnapCarousel label="Templates" className="w-full max-w-[520px] [--gutter:4px] [--slide-gap:12px] [--slide-size:188px] sm:[--slide-size:200px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h3 className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Start from a template</h3>
          <SnapCarouselCounter />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <SnapCarouselPrevious size="sm" />
          <SnapCarouselNext size="sm" />
        </div>
      </div>

      <SnapCarouselViewport className="-mx-1 -my-2 py-2">
        {templates.map((t, i) => {
          const on = picked === t.id;
          return (
            <SnapCarouselSlide key={t.id} aria-label={`${i + 1} of ${templates.length}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(t.id)}
                className="group/card flex w-full flex-col gap-2.5 rounded-lg text-left outline-none transition-[scale] duration-150 ease-out focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.98] in-data-dragging:scale-100!"
              >
                <div
                  className={`relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-raised shadow-[var(--shadow)] transition-[border-color] duration-150 ${
                    on ? "border-fg-3" : "border-line-2 group-hover/card:border-fg-4"
                  }`}
                >
                  {t.art}
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.span
                        key="check"
                        className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-fg text-frame"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
                        transition={reduce ? { duration: 0.12 } : spring.pop}
                      >
                        <Check size={12} strokeWidth={1.8} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex min-w-0 items-baseline justify-between gap-2 px-0.5">
                  <span className="truncate text-[13px] font-medium text-fg">{t.name}</span>
                  <span className="shrink-0 text-[11.5px] text-fg-3 tabular">{t.meta}</span>
                </div>
              </button>
            </SnapCarouselSlide>
          );
        })}
      </SnapCarouselViewport>

      <SnapCarouselDots className="mt-3 justify-center" />
    </SnapCarousel>
  );
}
