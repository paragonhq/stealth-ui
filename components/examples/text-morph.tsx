"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Eye, File, Globe } from "@/lib/icons";
import { ease, spring, swap } from "@/lib/motion";
import { TextMorph } from "@/components/ui/text-morph";

type Stage = "draft" | "publishing" | "published" | "live";

const button: Record<Stage, string> = { draft: "Publish", publishing: "Publishing", published: "Published", live: "Unpublish" };
const status: Record<Stage, string> = { draft: "Draft", publishing: "Publishing", published: "Live", live: "Live" };

// A document's publish control. Every label on it shares "ublish", so the
// letters slide while the button resizes around them; the status pill and the
// watch toggle morph the same way.
export default function Demo() {
  const [stage, setStage] = useState<Stage>("draft");
  const [watching, setWatching] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const act = () => {
    if (stage === "draft") {
      setStage("publishing");
      later(1400, () => setStage("published"));
      later(2900, () => setStage("live"));
    } else if (stage === "live") setStage("draft");
  };
  const busy = stage === "publishing";
  const primary = stage !== "live";

  return (
    <div className="flex w-full max-w-[420px] flex-col rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-3">
          <File />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Q3 pricing update</h3>
          <p className="text-[12px] text-fg-3 text-pretty sm:truncate">Edited by Maya Chen · 4 min ago</p>
        </div>
        <span
          data-stage={stage}
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[12px] font-medium transition-colors duration-200",
            stage === "draft" && "border-line-2 text-fg-2",
            stage === "publishing" && "border-transparent bg-info-soft text-info",
            (stage === "published" || stage === "live") && "border-transparent bg-success-soft text-success",
          )}
        >
          <span className={cn("size-1.5 rounded-full bg-current", busy && "animate-pulse-soft")} />
          <TextMorph aria-live="polite">{status[stage]}</TextMorph>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
        <button
          type="button"
          data-on={watching || undefined}
          onClick={() => setWatching((w) => !w)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 data-on:text-fg"
        >
          <Eye size={15} className={cn("transition-colors", watching ? "text-fg" : "text-fg-3")} />
          <TextMorph>{watching ? "Watching" : "Watch"}</TextMorph>
        </button>

        <button
          type="button"
          onClick={act}
          aria-busy={busy || undefined}
          aria-disabled={stage === "published" || busy || undefined}
          data-variant={primary ? "primary" : "secondary"}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium outline-none",
            "transition-[background-color,border-color,color,scale] duration-200 active:scale-[0.97] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "aria-disabled:pointer-events-none",
            primary ? "border-fg bg-fg text-frame hover:bg-fg/90" : "border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
          )}
        >
          <StageIcon stage={stage} />
          <TextMorph>{button[stage]}</TextMorph>
        </button>
      </div>
    </div>
  );
}

function StageIcon({ stage }: { stage: Stage }) {
  const reduce = useReducedMotion();
  const icon = stage === "publishing" ? "spin" : stage === "published" ? "check" : stage === "live" ? "none" : "globe";
  return (
    <motion.span
      initial={false}
      animate={{ width: icon === "none" ? 0 : 16, marginRight: icon === "none" ? -8 : 0 }}
      transition={reduce ? { duration: 0 } : spring.soft}
      className="relative grid h-4 shrink-0 place-items-center"
    >
      <AnimatePresence initial={false}>
        {icon !== "none" && (
          <motion.span
            key={icon}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : swap.initial}
            animate={swap.animate}
            exit={reduce ? { opacity: 0 } : swap.exit}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            {icon === "globe" && <Globe size={15} />}
            {icon === "spin" && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden className="animate-spin-slow">
                <circle cx="8" cy="8" r="5.75" opacity="0.25" />
                <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
              </svg>
            )}
            {icon === "check" && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: ease.out, delay: 0.05 }} />
              </svg>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}
