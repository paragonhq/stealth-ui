"use client";
import { useRef, useState } from "react";
import { TopLoader, useTopLoader } from "@/components/ui/top-loader";

type Page = { id: string; title: string; ms: number; fails?: boolean; rows: [string, string][] };
const pages: Page[] = [
  { id: "overview", title: "Overview", ms: 700, rows: [["Requests today", "1.2M"], ["Error rate", "0.04%"], ["p95 latency", "182 ms"]] },
  { id: "deployments", title: "Deployments", ms: 1800, rows: [["main · 4f2a91c", "Ready"], ["fix/auth-redirect", "Ready"], ["main · 9be03d7", "Failed"]] },
  { id: "analytics", title: "Analytics", ms: 1100, fails: true, rows: [["Visitors this week", "48,210"], ["Top page", "/pricing"], ["Bounce rate", "38%"]] },
  { id: "settings", title: "Settings", ms: 90, rows: [["Team name", "Northwind"], ["Region", "Frankfurt"], ["Plan", "Business"]] },
];

// A small app with its own loader across the top. Each page answers at a
// different speed: Settings in 90 ms never shows the bar; Analytics fails the
// first time and loads when you try again.
export default function Demo() {
  const loader = useTopLoader();
  const [current, setCurrent] = useState("overview");
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<Page | null>(null);
  const request = useRef(0);
  const analyticsTries = useRef(0);

  const go = (page: Page) => {
    if (page.id === (pending ?? current)) return;
    setFailed(null);
    const id = ++request.current;
    const fails = page.fails && analyticsTries.current++ % 2 === 0;
    setPending(page.id);
    loader
      .track(
        new Promise<void>((resolve, reject) => window.setTimeout(() => (fails ? reject(new Error("timeout")) : resolve()), page.ms)),
      )
      .then(
        () => {
          // Only the latest click wins; an older, slower answer is ignored.
          if (id !== request.current) return;
          setCurrent(page.id);
          setFailed(null);
          setPending(null);
        },
        () => {
          if (id !== request.current) return;
          setFailed(page);
          setPending(null);
        },
      );
  };

  const page = pages.find((p) => p.id === current)!;
  const active = pending ?? current;

  return (
    <div className="relative flex h-[300px] w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <TopLoader loading={loader.loading} error={loader.error} position="absolute" />

      <nav aria-label="App" className="flex w-[132px] shrink-0 flex-col gap-0.5 border-r border-line p-2 max-[400px]:w-[108px]">
        <p className="px-2 pb-2 pt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">Northwind</p>
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(p)}
            aria-current={active === p.id ? "page" : undefined}
            className="flex h-8 items-center rounded-md px-2 text-left text-[13px] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.98] aria-[current=page]:bg-hover aria-[current=page]:text-fg"
          >
            {p.title}
          </button>
        ))}
      </nav>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center border-b border-line px-4">
          <p className="truncate text-[12px] text-fg-3">
            northwind <span className="text-fg-4">/</span> <span className="text-fg">{page.title}</span>
          </p>
        </header>
        <div className="flex flex-col gap-3 p-4">
          {failed && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] leading-[18px] text-danger">
              Couldn’t load {failed.title}. It timed out.{" "}
              <button
                type="button"
                onClick={() => go(failed)}
                className="relative font-medium underline decoration-danger/40 underline-offset-2 outline-none transition-[text-decoration-color] duration-150 hover:decoration-danger focus-visible:rounded-sm focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                Try again
              </button>
            </p>
          )}
          <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg">{page.title}</h3>
          <dl className="flex flex-col">
            {page.rows.map(([k, v]) => (
              <div key={k} className="flex h-9 items-center justify-between gap-3 border-b border-line text-[13px] last:border-b-0">
                <dt className="truncate text-fg-2">{k}</dt>
                <dd className={v === "Failed" ? "shrink-0 text-danger" : "tabular shrink-0 text-fg"}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
    </div>
  );
}
