"use client";
import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { Check, File, Folder, Image, Mic, Pause, Play, Upload, X } from "@/lib/icons";
import { DynamicIsland, DynamicIslandRing } from "@/components/ui/dynamic-island";

type Activity = "timer" | "upload" | "call" | "none";
const SESSION = 25 * 60;
const FILE_MB = 6.6;

const mmss = (s: number) => [Math.floor(s / 60), s % 60] as const;

function Clock({ seconds, className }: { seconds: number; className?: string }) {
  const [m, s] = mmss(seconds);
  return (
    <span className={cn("inline-flex items-baseline tabular", className)}>
      <NumberFlow value={m} format={{ minimumIntegerDigits: 2 }} />
      <span className="px-px">:</span>
      <NumberFlow value={s} format={{ minimumIntegerDigits: 2 }} trend={-1} />
    </span>
  );
}

function Waveform({ live }: { live: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="flex h-3.5 items-center gap-[2px]">
      {[0.5, 0.9, 0.65, 1, 0.55].map((h, i) => (
        <motion.span
          key={i}
          className="w-[2.5px] origin-center rounded-full bg-success"
          style={{ height: 14 }}
          initial={false}
          animate={live && !reduce ? { scaleY: [h * 0.4, h, h * 0.55] } : { scaleY: h * 0.6 }}
          transition={live && !reduce ? { duration: 0.8, repeat: Infinity, repeatType: "mirror", delay: i * 0.11, ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </span>
  );
}

const roundButton =
  "grid size-10 place-items-center rounded-full outline-none transition-[background-color,scale] duration-150 active:scale-[0.92] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

// A files app with one live activity at a time in the island at the top.
export default function Demo() {
  const [activity, setActivity] = useState<Activity>("upload");
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(SESSION - 47);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0.18);
  const [callFor, setCallFor] = useState(252);
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);

  // Everything live ticks only while the demo is on screen and the tab is visible.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (activity === "timer" && !paused) setLeft((s) => Math.max(0, s - 1));
      if (activity === "call") setCallFor((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible, activity, paused]);
  useEffect(() => {
    if (!visible || activity !== "upload" || progress >= 1) return;
    const id = window.setTimeout(() => setProgress((p) => Math.min(1, p + 0.035)), 420);
    return () => window.clearTimeout(id);
  }, [visible, activity, progress]);

  const choose = (a: Activity) => {
    setOpen(false);
    setActivity(a);
    if (a === "upload") setProgress(0.18);
  };
  // Ending the activity from inside the island removes it, so the keyboard needs somewhere to land.
  const end = () => {
    const inside = frame.current?.contains(document.activeElement);
    choose("none");
    if (inside) (controls.current?.lastElementChild as HTMLElement | null)?.focus();
  };

  const done = progress >= 1;
  const pct = Math.round(progress * 100);
  const secondsLeft = Math.ceil(((1 - progress) / 0.035) * 0.42);

  let compact: React.ReactNode = null;
  let detail: React.ReactNode = null;
  let label = "";

  if (activity === "timer") {
    label = `Focus timer, ${mmss(left)[0]} min ${mmss(left)[1]} s left${paused ? ", paused" : ""}`;
    compact = (
      <>
        <DynamicIslandRing value={left / SESSION} tone={paused ? "text-fg-3" : "text-warning"} />
        <Clock seconds={left} className={cn("pr-1.5 text-[13px] font-medium", paused ? "text-fg-3" : "text-warning")} />
      </>
    );
    detail = (
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-fg-3">Deep work · Q3 planning</p>
          <Clock seconds={left} className="mt-0.5 text-[32px] font-medium leading-none tracking-[-0.02em] text-fg" />
        </div>
        <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume timer" : "Pause timer"} className={cn(roundButton, "bg-warning-soft text-warning hover:bg-warning/20")}>
          {paused ? <Play /> : <Pause />}
        </button>
        <button type="button" onClick={end} aria-label="Stop timer" className={cn(roundButton, "bg-hover text-fg-2 hover:bg-line-2 hover:text-fg")}>
          <X />
        </button>
      </div>
    );
  }

  if (activity === "upload") {
    label = done ? "Upload complete: q3-forecast.xlsx" : `Uploading q3-forecast.xlsx, ${pct}%`;
    compact = (
      <>
        <DynamicIslandRing value={progress} tone={done ? "text-success" : "text-fg"}>
          {done ? <Check size={10} strokeWidth={2.2} className="text-success" /> : <Upload size={10} strokeWidth={2} className="text-fg-2" />}
        </DynamicIslandRing>
        <span className={cn("pr-1.5 text-[13px] font-medium tabular", done ? "text-success" : "text-fg")}>
          {done ? "Done" : <NumberFlow value={pct} suffix="%" />}
        </span>
      </>
    );
    detail = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-hover text-fg-2">
            <File />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">q3-forecast.xlsx</p>
            <p className="text-[12px] text-fg-3 tabular">
              {done ? `${FILE_MB} MB · Uploaded to Finance` : `${(progress * FILE_MB).toFixed(1)} of ${FILE_MB} MB · ${secondsLeft}s left`}
            </p>
          </div>
          <button
            type="button"
            onClick={end}
            className="h-8 shrink-0 rounded-full bg-hover px-3 text-[12.5px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-line-2 active:scale-[0.96] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            {done ? "Dismiss" : "Cancel"}
          </button>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line-2">
          <motion.div className={cn("h-full rounded-full", done ? "bg-success" : "bg-fg")} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: ease.out }} />
        </div>
      </div>
    );
  }

  if (activity === "call") {
    label = muted ? "Call with Maya Chen, muted" : "Call with Maya Chen";
    compact = (
      <>
        <span className="relative grid size-5 place-items-center rounded-full bg-hover text-[8.5px] font-medium text-fg-2">
          MC
          <span className="absolute -bottom-px -right-px size-[7px] rounded-full bg-success shadow-[0_0_0_1.5px_var(--page)]" />
        </span>
        <span className="flex items-center gap-2 pr-1.5">
          <Waveform live={!muted && visible} />
          <Clock seconds={callFor} className="text-[13px] font-medium text-success" />
        </span>
      </>
    );
    detail = (
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hover text-[12px] font-medium text-fg-2">MC</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">Maya Chen</p>
          <p className="flex items-center gap-1.5 truncate text-[12px] text-fg-3">
            Platform sync · <Clock seconds={callFor} />
          </p>
        </div>
        <button type="button" aria-pressed={muted} onClick={() => setMuted((m) => !m)} aria-label="Mute" className={cn(roundButton, muted ? "bg-fg text-page" : "bg-hover text-fg-2 hover:bg-line-2 hover:text-fg")}>
          <Mic />
        </button>
        <button type="button" onClick={end} aria-label="End call" className={cn(roundButton, "bg-danger text-page hover:bg-danger/90")}>
          <X />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[380px] flex-col items-center gap-3">
      <div ref={frame} className="relative h-[340px] w-full overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
        <DynamicIsland activity={activity} compact={compact} detail={detail} label={label} open={open} onOpenChange={setOpen} />
        <div className="px-4 pt-[68px]">
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Finance · Shared</p>
          <ul className="mt-2 flex flex-col">
            {[
              { icon: Folder, name: "Board decks", meta: "12 files" },
              { icon: File, name: "q2-actuals.xlsx", meta: "2.3 MB · Jul 8" },
              { icon: Image, name: "revenue-chart.png", meta: "840 KB · Aug 21" },
              { icon: File, name: "vendor-contracts.pdf", meta: "11.4 MB · Sep 2" },
              { icon: File, name: "headcount-plan.xlsx", meta: "1.1 MB · Sep 14" },
            ].map((f) => (
              <li key={f.name} className="flex h-11 items-center gap-3 border-b border-line last:border-0">
                <f.icon className="shrink-0 text-fg-3" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{f.name}</span>
                <span className="shrink-0 text-[12px] text-fg-3 tabular">{f.meta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div ref={controls} role="group" aria-label="Live activity" className="flex gap-0.5 rounded-lg bg-hover p-0.5">
        {(["timer", "upload", "call", "none"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={activity === a}
            onClick={() => choose(a)}
            className={cn(
              "h-7 rounded-md px-2.5 text-[12px] capitalize outline-none transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.96] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              activity === a ? "bg-raised text-fg shadow-[var(--shadow),inset_0_0_0_1px_var(--line-2)]" : "text-fg-3 hover:text-fg",
            )}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}
