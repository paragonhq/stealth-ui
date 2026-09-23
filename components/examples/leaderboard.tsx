"use client";
import { useEffect, useRef, useState } from "react";
import { Leaderboard, type LeaderboardEntry } from "@/components/ui/leaderboard";

// A sales team's month. Deals land on their own while the board is on screen; you can log one too.
const initial: LeaderboardEntry[] = [
  { id: "maya", name: "Maya Okafor", meta: "Enterprise · EMEA", score: 184200 },
  { id: "tom", name: "Tomás Herrera", meta: "Mid-market · LATAM", score: 171500 },
  { id: "priya", name: "Priya Raman", meta: "Enterprise · APAC", score: 166900 },
  { id: "jonas", name: "Jonas Lindqvist", meta: "Mid-market · Nordics", score: 142300 },
  { id: "aiko", name: "Aiko Tanaka", meta: "SMB · Japan", score: 128800 },
  { id: "sam", name: "Sam Whitfield", meta: "SMB · North America", score: 117600 },
  { id: "you", name: "Alex Moreau", meta: "Mid-market · France", score: 98400 },
  { id: "lena", name: "Lena Brandt", meta: "SMB · DACH", score: 91200 },
];

const usd = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const;

export default function Demo() {
  const [entries, setEntries] = useState(initial);
  const root = useRef<HTMLDivElement>(null);

  // Someone closes a deal every few seconds, only while the board is visible.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let visible = false;
    let timer = 0;
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const tick = () => {
      window.clearTimeout(timer);
      if (!visible || document.hidden) return;
      timer = window.setTimeout(() => {
        setEntries((list) => {
          const others = list.filter((e) => e.id !== "you");
          const pick = others[Math.floor(rand() * others.length)];
          const deal = Math.round((6000 + rand() * 22000) / 100) * 100;
          return list.map((e) => (e.id === pick.id ? { ...e, score: e.score + deal } : e));
        });
        tick();
      }, 2600);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      tick();
    });
    io.observe(node);
    document.addEventListener("visibilitychange", tick);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const logDeal = () => setEntries((list) => list.map((e) => (e.id === "you" ? { ...e, score: e.score + 24500 } : e)));

  return (
    <div ref={root} className="w-full max-w-[460px] rounded-xl border border-line bg-raised p-3 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Closed won, September</span>
          <span className="text-[11.5px] text-fg-3">Updates as deals close</span>
        </div>
        <button
          type="button"
          onClick={logDeal}
          className="h-8 shrink-0 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Log a $24.5k deal
        </button>
      </div>
      <Leaderboard entries={entries} youId="you" limit={5} label="Sales leaderboard, September" format={usd} locale="en-US" scoreLabel="Closed" />
    </div>
  );
}
