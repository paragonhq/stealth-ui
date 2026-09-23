"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { formatTime, MediaScrubber } from "@/components/ui/media-scrubber";

const DURATION = 724;
const CHAPTERS = [
  { start: 0, title: "Intro" },
  { start: 48, title: "Connecting a repository" },
  { start: 205, title: "Preview deployments" },
  { start: 402, title: "Rollbacks and aliases" },
  { start: 610, title: "Questions" },
];

// A recorded walkthrough: playback ticks forward, the buffer runs ahead of it,
// and both pause while the demo is off screen or the tab is hidden.
export default function Demo() {
  const [time, setTime] = useState(131);
  // Buffered ranges, as media.buffered reports them. Seeking past the buffer starts a new one.
  const [buffered, setBuffered] = useState<Array<[number, number]>>([[0, 190]]);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setTime((t) => {
        const next = Math.min(t + 0.25, DURATION);
        if (next >= DURATION) setPlaying(false);
        return next;
      });
      setBuffered((ranges) => ranges.map(([a, b]) => [a, Math.min(DURATION, b + 0.6)] as [number, number]));
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, visible]);

  const chapter = CHAPTERS.findLast((c) => time >= c.start)?.title;

  return (
    <div ref={root} className="w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause" : "Play"}
        className="group/poster relative grid aspect-[16/9] w-full place-items-center bg-hover outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-fg-3"
      >
        <div className="absolute left-4 top-3.5 text-left">
          <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Shipping with previews</p>
          <p className="text-[11.5px] text-fg-3">Platform onboarding · Session 3</p>
        </div>
        <span
          className={cn(
            "grid size-11 place-items-center rounded-full border border-line-2 bg-raised text-fg",
            "transition-[scale,opacity] duration-150 ease-out group-hover/poster:scale-[1.04] group-active/poster:scale-[0.94]",
            playing && "opacity-0 group-hover/poster:opacity-100",
          )}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
        </span>
      </button>

      <div className="px-3 pb-3 pt-2">
        <MediaScrubber
          value={time}
          onValueChange={setTime}
          onValueCommitted={(t) =>
            setBuffered((ranges) => (ranges.some(([a, b]) => t >= a && t <= b) ? ranges : [...ranges, [t, Math.min(DURATION, t + 4)]]))
          }
          duration={DURATION}
          buffered={buffered}
          chapters={CHAPTERS}
          aria-label="Seek video"
        />
        <div className="mt-1 flex items-center gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="-ml-1 grid size-7 place-items-center rounded-md text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            {playing ? <Pause size={14} /> : <Play size={14} className="translate-x-px" />}
          </button>
          <span className="tabular text-fg">{formatTime(time)}</span>
          <span className="tabular text-fg-4">/ {formatTime(DURATION)}</span>
          <span className="ml-auto min-w-0 truncate text-fg-3">{chapter}</span>
        </div>
      </div>
    </div>
  );
}
