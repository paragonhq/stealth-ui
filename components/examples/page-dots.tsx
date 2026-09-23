"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { PageDots } from "@/components/ui/page-dots";

const updates = [
  { tag: "New", title: "Usage alerts", body: "Get an email when a project reaches 80% of its monthly quota." },
  { tag: "Improved", title: "Faster cold starts", body: "Functions in eu-west now boot in under 120 ms at the 95th percentile." },
  { tag: "New", title: "Branch previews", body: "Every pull request gets its own URL, torn down when it merges." },
  { tag: "Fixed", title: "Invoice rounding", body: "Annual plans no longer show a one-cent difference on the first invoice." },
];

const photos = ["Living room", "Kitchen", "Balcony", "Bedroom", "Bathroom", "Study", "Hallway", "Garden", "Street view", "Floor plan", "Building", "Neighborhood"];

function Arrow({ dir, onClick, label, disabled }: { dir: 1 | -1; onClick: () => void; label: string; disabled: boolean }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 disabled:pointer-events-none disabled:opacity-40 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92]"
    >
      <Icon size={14} />
    </button>
  );
}

export default function Demo() {
  const reduce = useReducedMotion();
  const [slide, setSlide] = useState(0);
  const [photo, setPhoto] = useState(0);
  const u = updates[slide];

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      {/* What's new: autoplays, holds on hover, and draws the time left into the active pill. */}
      <section aria-roledescription="carousel" aria-label="What’s new" className="flex flex-col gap-4 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <div className="relative h-[76px]">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={slide}
              className="absolute inset-0 flex flex-col gap-1"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12, filter: "blur(2px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8, filter: "blur(2px)", transition: { duration: 0.14 } }}
              transition={{ duration: 0.28, ease: ease.out }}
            >
              <span className="font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase">{u.tag}</span>
              <h3 className="text-[14px] font-medium tracking-[-0.015em]">{u.title}</h3>
              <p className="text-[12.5px] text-fg-2 text-pretty">{u.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between">
          <PageDots count={updates.length} value={slide} onValueChange={setSlide} autoplay={4500} aria-label="Updates" getLabel={(i, n) => `Update ${i + 1} of ${n}`} />
          <span className="text-[12px] text-fg-3 tabular">
            {slide + 1} / {updates.length}
          </span>
        </div>
      </section>

      {/* A long gallery: 12 photos, 7 dots at a time, on a chip over the image. */}
      <section aria-roledescription="carousel" aria-label="Listing photos" className="flex flex-col gap-3">
        <div className="relative grid h-44 place-items-center overflow-hidden rounded-xl border border-line bg-hover">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={photo}
              className="text-[13px] text-fg-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2 }}
            >
              {photos[photo]}
            </motion.span>
          </AnimatePresence>
          <PageDots
            count={photos.length}
            value={photo}
            onValueChange={setPhoto}
            variant="contained"
            size="sm"
            aria-label="Photos"
            getLabel={(i, n) => `${photos[i]}, photo ${i + 1} of ${n}`}
            className="absolute bottom-3 left-1/2 -translate-x-1/2"
          />
        </div>
        <div className="flex items-center justify-between">
          <Arrow dir={-1} label="Previous photo" disabled={photo === 0} onClick={() => setPhoto((p) => Math.max(p - 1, 0))} />
          <span className="text-[12px] text-fg-3 tabular">
            {photo + 1} of {photos.length}
          </span>
          <Arrow dir={1} label="Next photo" disabled={photo === photos.length - 1} onClick={() => setPhoto((p) => Math.min(p + 1, photos.length - 1))} />
        </div>
      </section>
    </div>
  );
}
