"use client";
import { useEffect, useRef, useState } from "react";
import { type LogLevel, type LogLine, LogViewer } from "@/components/ui/log-viewer";

// An API service's runtime logs, streaming. Deterministic, so the first paint
// matches the server; new lines arrive only while the demo is on screen.
const pool: [LogLevel, string, string][] = [
  ["info", "api", "GET /v1/invoices?status=open 200 in 42ms"],
  ["debug", "cache", "hit invoices:acct_91f2 (ttl 58s)"],
  ["info", "api", "POST /v1/invoices/inv_3104/finalize 200 in 118ms"],
  ["info", "worker", "picked up job send-receipts#4412 (queue depth 3)"],
  ["debug", "db", "pool: 7 active, 13 idle, 0 waiting"],
  ["warn", "db", "slow query invoices_by_account took 812ms (threshold 500ms)"],
  ["info", "api", "GET /v1/customers/cus_88a1 200 in 23ms"],
  ["error", "api", "POST /v1/charges 502 upstream payments-gateway timed out after 10000ms, retrying in 2s (attempt 1 of 3)"],
  ["info", "worker", "send-receipts#4412 done: 18 sent, 0 bounced in 1.4s"],
  ["debug", "edge", "fra1 → iad1 failover check ok (p95 38ms)"],
  ["warn", "api", "rate limit at 82% for key pk_live_…4f2a"],
  ["info", "api", "GET /v1/health 200 in 3ms"],
];

const base = Date.UTC(2026, 8, 22, 12, 3, 12, 408);
const make = (i: number, time: number): LogLine => {
  const [level, source, message] = pool[(i * 7 + 3) % pool.length];
  return { id: i, time, level, message, source };
};
const seed = Array.from({ length: 36 }, (_, i) => make(i, base + i * 731 + ((i * 97) % 300)));

export default function Demo() {
  const [lines, setLines] = useState(seed);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer = 0;
    let visible = false;
    let n = seed.length;
    let time = seed[seed.length - 1].time as number;
    const tick = () => {
      if (visible && !document.hidden) {
        const i = n++;
        time += 380 + ((i * 131) % 700);
        const line = make(i, time);
        setLines((prev) => [...prev.slice(-399), line]);
      }
      timer = window.setTimeout(tick, 450 + ((n * 211) % 900));
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    timer = window.setTimeout(tick, 900);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className="w-full max-w-[560px]">
      <LogViewer lines={lines} streaming label="api-prod logs" height={300} />
    </div>
  );
}
