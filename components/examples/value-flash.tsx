"use client";
import { useEffect, useRef, useState } from "react";
import { ValueFlash } from "@/components/ui/value-flash";

type Row = { symbol: string; name: string; price: number | null; decimals: number; every: number; step: number };

const initial: Row[] = [
  // Bitcoin's feed ticks ten times a second; the component shows it at most every 400ms.
  { symbol: "BTC-USD", name: "Bitcoin", price: 64218.5, decimals: 2, every: 100, step: 6 },
  { symbol: "ETH-USD", name: "Ether", price: 3121.84, decimals: 2, every: 1300, step: 1.6 },
  { symbol: "EUR-USD", name: "Euro / US dollar", price: 1.0842, decimals: 4, every: 2100, step: 0.0003 },
  { symbol: "XAU-USD", name: "Gold spot", price: null, decimals: 2, every: 1700, step: 0.9 },
];

export default function Demo() {
  const [rows, setRows] = useState(initial);
  const [live, setLive] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  // Each symbol ticks on its own clock while the card is visible, the tab is in front, and the feed is live.
  useEffect(() => {
    const node = root.current;
    if (!node || !live) return;
    let visible = false;
    const timers: number[] = [];
    const stop = () => timers.splice(0).forEach((t) => window.clearInterval(t));
    const start = () => {
      stop();
      if (!visible || document.hidden) return;
      initial.forEach((r, i) => {
        timers.push(
          window.setInterval(() => {
            setRows((all) =>
              all.map((row, j) => {
                if (j !== i) return row;
                const base = row.price ?? 2338.4; // gold's first quote arrives on its first tick
                const next = base + (Math.random() - 0.48) * row.step * 2;
                return { ...row, price: Math.round(next * 10 ** row.decimals) / 10 ** row.decimals };
              }),
            );
          }, r.every),
        );
      });
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      start();
    });
    io.observe(node);
    document.addEventListener("visibilitychange", start);
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [live]);

  return (
    <div ref={root} className="w-full max-w-[380px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 pl-4 pr-2.5">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Watchlist</span>
          <span className={live ? "font-mono text-2xs uppercase tracking-[0.08em] text-success" : "font-mono text-2xs uppercase tracking-[0.08em] text-fg-3"}>
            {live ? "Live" : "Paused"}
          </span>
        </span>
        <button
          type="button"
          aria-pressed={!live}
          onClick={() => setLive((l) => !l)}
          className="grid h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          {/* Both labels share one cell so the button never changes width. */}
          <span aria-hidden className="invisible col-start-1 row-start-1">Resume feed</span>
          <span className="col-start-1 row-start-1 self-center">{live ? "Pause feed" : "Resume feed"}</span>
        </button>
      </div>
      <ul aria-label="Prices" className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.symbol} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-[12px] text-fg">{r.symbol}</span>
              <span className="truncate text-[12px] text-fg-3">{r.name}</span>
            </span>
            <ValueFlash value={r.price} decimals={r.decimals} stale={!live} arrow={r.symbol === "EUR-USD" ? "last" : "flash"} />
          </li>
        ))}
      </ul>
    </div>
  );
}
