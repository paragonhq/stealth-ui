"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Refresh, Sparkle } from "@/lib/icons";
import { ShimmerText } from "@/components/ui/shimmer-text";

const steps = [
  "Thinking…",
  "Searching the workspace…",
  "Reading q3-retention.csv…",
  "Comparing 3 quarters…",
  "Writing the answer…",
];

// An assistant turn working through its steps. The status crossfades from one
// step to the next and settles into a plain record when it's done.
export default function Demo() {
  const [step, setStep] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const done = step >= steps.length;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (done || !onScreen) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 1800 : 2400);
    return () => window.clearTimeout(t);
  }, [step, done, onScreen]);

  return (
    <div ref={root} className="flex w-full max-w-[420px] flex-col gap-4">
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-fg/[0.06] px-3.5 py-2 text-[13px] leading-5 text-fg">
        How did churn in Q3 compare with the two quarters before it?
      </div>

      <div className="flex items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-2 bg-raised text-fg-2">
          <Sparkle size={12} />
        </span>
        <ShimmerText role="status" active={!done} className="text-[13px]">
          {done ? "Worked for 12s" : steps[step]}
        </ShimmerText>
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-raised p-1.5">
        <ToolRow label="Ran 128 tests" done />
        <ToolRow label="Building the preview…" />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4 tabular">
          {done ? "Done" : `Step ${step + 1} of ${steps.length}`}
        </span>
        <button
          type="button"
          onClick={() => setStep((s) => (s >= steps.length ? 0 : s + 1))}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
        >
          {done ? <Refresh size={14} className="text-fg-3" /> : <ArrowRight size={14} className="text-fg-3" />}
          <span className="grid">
            <span className={done ? "invisible col-start-1 row-start-1" : "col-start-1 row-start-1"}>Next step</span>
            <span className={done ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"}>Replay</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function ToolRow({ label, done = false }: { label: string; done?: boolean }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-lg px-2 text-[12.5px]">
      <span className="grid size-4 place-items-center text-fg-3">
        {done ? <Check size={14} className="text-success" /> : <span className="size-1.5 rounded-full bg-fg-3" />}
      </span>
      <ShimmerText active={!done} className={done ? "text-fg" : undefined}>
        {label}
      </ShimmerText>
      <span className="ml-auto font-mono text-2xs text-fg-4 tabular">{done ? "4.2s" : "running"}</span>
    </div>
  );
}
