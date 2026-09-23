"use client";
import { useEffect, useRef, useState } from "react";
import { LiveCursors, type LiveCursor } from "@/components/ui/live-cursors";

type Point = { x: number; y: number };
type Sim = { id: string; name: string; at: Point; to: Point; wait: number; stops: Point[]; still: number };

// Where people's attention actually goes on a flow diagram: the frames and the gaps between them.
const frames = [
  { label: "Welcome", x: 0.06, y: 0.14 },
  { label: "Invite", x: 0.39, y: 0.14 },
  { label: "Connect", x: 0.72, y: 0.14 },
  { label: "Plan", x: 0.22, y: 0.58 },
  { label: "Done", x: 0.56, y: 0.58 },
];
const stop = (i: number, dx = 0.1, dy = 0.14): Point => ({ x: frames[i].x + dx, y: frames[i].y + dy });

const TICK = 70; // A realistic presence channel: about 14 updates a second, not every frame.

function start(): Sim[] {
  return [
    { id: "maya", name: "Maya Okafor", at: stop(0), to: stop(1), wait: 0, still: 900, stops: [stop(1), stop(2, 0.14, 0.2), stop(4), stop(3, 0.06, 0.1), stop(0, 0.12, 0.2)] },
    { id: "jon", name: "Jon Park", at: stop(3, 0.16, 0.22), to: stop(3, 0.16, 0.22), wait: 40, still: 5200, stops: [stop(4, 0.08, 0.26), stop(3, 0.16, 0.22)] },
    { id: "priya", name: "Priya Raman", at: stop(2, 0.18, 0.1), to: stop(2, 0.18, 0.1), wait: 12, still: 2600, stops: [stop(2, 0.04, 0.3), stop(1, 0.2, 0.28), stop(2, 0.18, 0.1)] },
  ];
}

export default function Demo() {
  const board = useRef<HTMLDivElement>(null);
  const sims = useRef<Sim[]>(start());
  const [cursors, setCursors] = useState<LiveCursor[]>(() => start().map((s) => ({ id: s.id, name: s.name, ...s.at })));
  const [away, setAway] = useState(false);

  // People move, overshoot a little, and stop to read. Paused off screen and in hidden tabs.
  useEffect(() => {
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (board.current) io.observe(board.current);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      for (const s of sims.current) {
        if (s.wait > 0) {
          s.wait--;
          continue;
        }
        const dx = s.to.x - s.at.x;
        const dy = s.to.y - s.at.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.004) {
          s.to = s.stops[(s.stops.indexOf(s.to) + 1) % s.stops.length] ?? s.stops[0];
          s.wait = Math.round((s.still * (0.7 + Math.random() * 0.6)) / TICK);
          continue;
        }
        const step = Math.min(d, 0.012 + d * 0.16);
        s.at = { x: s.at.x + (dx / d) * step + (Math.random() - 0.5) * 0.003, y: s.at.y + (dy / d) * step + (Math.random() - 0.5) * 0.003 };
      }
      setCursors(sims.current.filter((s) => !(away && s.id === "priya")).map((s) => ({ id: s.id, name: s.name, x: s.at.x, y: s.at.y })));
    }, TICK);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [away]);

  // Send Maya wherever you click, the way a teammate answers "look here".
  const send = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const maya = sims.current[0];
    const point = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    maya.stops = [point, ...start()[0].stops];
    maya.to = point;
    maya.wait = 0;
  };

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-10 items-center justify-between gap-3 border-b border-line px-3.5">
          <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Onboarding flow</span>
          <button
            type="button"
            aria-pressed={away}
            onClick={() => setAway((a) => !a)}
            className="inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            {away ? "Priya rejoins" : "Priya leaves"}
          </button>
        </div>
        <div
          ref={board}
          onPointerDown={send}
          className="relative h-[280px] cursor-crosshair touch-manipulation bg-frame [background-image:radial-gradient(var(--line-2)_1px,transparent_1px)] [background-size:16px_16px]"
        >
          {frames.map((f) => (
            <div
              key={f.label}
              className="absolute flex h-[26%] w-[24%] items-end rounded-lg border border-line-2 bg-raised p-2 text-[11.5px] text-fg-2 shadow-[var(--shadow)]"
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
            >
              <span className="truncate">{f.label}</span>
            </div>
          ))}
          <LiveCursors cursors={cursors} />
        </div>
      </div>
      <p className="text-center text-[12px] text-fg-3">Click the board to send Maya there. Names tuck away when someone stops.</p>
    </div>
  );
}
