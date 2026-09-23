"use client";
import { useEffect, useState } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";

type File = { name: string; mb: number; speed: number; wait: number; failAt?: number };
const files: File[] = [
  { name: "q3-forecast.xlsx", mb: 5.8, speed: 7, wait: 1 },
  { name: "brand-guidelines.pdf", mb: 12.4, speed: 4, wait: 3, failAt: 38 },
  { name: "team-offsite.jpg", mb: 2.1, speed: 11, wait: 5 },
];
type Item = { v: number | null; failed: boolean; retried: boolean };
const fresh = (): Item[] => files.map(() => ({ v: null, failed: false, retried: false }));

// Three uploads with a ring each, and one ring for the batch. One upload fails
// partway so the error and the retry can be seen; the batch finishes into a tick.
export default function Demo() {
  const [items, setItems] = useState<Item[]>(fresh);
  const [tick, setTick] = useState(0);
  const running = items.some((it) => !it.failed && (it.v ?? 0) < 100);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setItems((prev) =>
        prev.map((it, i) => {
          const f = files[i];
          if (it.failed || (it.v ?? 0) >= 100) return it;
          if (it.v === null) return { ...it, v: tick >= f.wait ? 0 : null };
          const next = Math.min(100, it.v + f.speed);
          if (f.failAt && !it.retried && next >= f.failAt) return { ...it, v: f.failAt, failed: true };
          return { ...it, v: next };
        }),
      );
    }, 320);
    return () => window.clearInterval(id);
  }, [running, tick]);

  const total = files.reduce((s, f) => s + f.mb, 0);
  const sent = items.reduce((s, it, i) => s + ((it.v ?? 0) / 100) * files[i].mb, 0);
  const done = items.every((it) => it.v === 100);
  const failed = items.filter((it) => it.failed).length;
  const left = files.length - items.filter((it) => it.v === 100).length;

  return (
    <div className="w-full max-w-[380px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center gap-4 border-b border-line p-4">
        <ProgressRing size="lg" value={(sent / total) * 100} error={failed > 0 && !running} aria-label="All uploads" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[14px] font-medium leading-[20px] tracking-[-0.01em] text-fg">
            {done ? "3 files uploaded" : failed ? `${failed} upload failed` : `Uploading ${left} ${left === 1 ? "file" : "files"}`}
          </p>
          <p className="tabular text-[12px] leading-[18px] text-fg-3">
            {sent.toFixed(1)} of {total.toFixed(1)} MB
          </p>
        </div>
        {done && (
          <button
            type="button"
            onClick={() => { setTick(0); setItems(fresh()); }}
            className="h-7 shrink-0 rounded-md border border-line-2 px-2.5 text-[12px] font-medium text-fg outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
          >
            Upload again
          </button>
        )}
      </div>

      <ul className="flex flex-col py-1.5" aria-label="Files">
        {files.map((f, i) => {
          const it = items[i];
          return (
            <li key={f.name} className="flex h-11 items-center gap-3 px-4">
              <ProgressRing size="sm" value={it.v} error={it.failed} aria-label={f.name} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] leading-[18px] text-fg">{f.name}</span>
                <span className={it.failed ? "truncate text-[12px] leading-[16px] text-danger" : "tabular text-[12px] leading-[16px] text-fg-3"}>
                  {it.failed ? "Connection closed at 38%" : it.v === null ? "Waiting" : it.v === 100 ? `${f.mb} MB` : `${Math.round(it.v)}%`}
                </span>
              </div>
              {it.failed && (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.map((p, j) => (j === i ? { ...p, failed: false, retried: true } : p)))}
                  className="h-7 shrink-0 rounded-md border border-line-2 px-2.5 text-[12px] font-medium text-fg outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
                >
                  Retry
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
