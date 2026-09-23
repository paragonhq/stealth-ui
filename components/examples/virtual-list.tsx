"use client";
import { useState } from "react";
import { VirtualList } from "@/components/ui/virtual-list";

type Event = { id: string; actor: string; action: string; detail?: string; at: number; day: string };

const people = ["Priya Raman", "Marcus Oyelaran", "Lena Fischer", "Sam Whitaker", "Aiko Tanaka", "Diego Alvarez", "Noor Haddad", "Tom Brennan", "Ines Duarte", "Kwame Mensah"];
const actions: [string, string?][] = [
  ["signed in", "Chrome on macOS · 81.2.69.160"],
  ["rotated API key prod-eu-2"],
  ["deployed atlas-web to production", "Commit 4f2a9c1 · “Fix invoice rounding for JPY”"],
  ["invited ana@northwind.io as Member"],
  ["changed the role of ana@northwind.io to Admin"],
  ["exported q3-forecast.xlsx"],
  ["enabled SSO enforcement for the workspace", "Members without SSO will be signed out at their next request"],
  ["revoked a session", "Safari on iOS · 172.16.4.21"],
  ["deleted branch fix/billing-email"],
  ["updated the billing email"],
  ["created webhook https://hooks.northwind.io/audit"],
];

// Deterministic, so the server and the browser render the same 10,000 rows.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7);
let clock = Date.UTC(2026, 8, 22, 18, 4);
const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const events: Event[] = Array.from({ length: 10_000 }, (_, i) => {
  const [action, detail] = actions[Math.floor(rand() * actions.length)];
  clock -= Math.floor(2 + rand() * 38) * 60_000;
  return { id: `evt_${(10_000 - i).toString(36)}`, actor: people[Math.floor(rand() * people.length)], action, detail: rand() < 0.7 ? detail : undefined, at: clock, day: day.format(clock) };
});
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const count = new Intl.NumberFormat("en-US");
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

// Stable functions: the list re-derives its rows only when these or the items change.
const keyOf = (e: Event) => e.id;
const dayOf = (e: Event) => e.day;
const actorOf = (e: Event) => e.actor;

// An audit log: 10,000 events, grouped by day, rows that wrap when there is detail.
export default function Demo() {
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [selected, setSelected] = useState<Event | null>(null);

  return (
    <div className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-3.5 py-3">
        <h3 id="audit-title" className="text-[14px] font-medium tracking-[-0.015em] text-fg">
          Audit log
        </h3>
        <span className="text-[12px] text-fg-3 tabular">{count.format(events.length)} events</span>
      </div>

      <VirtualList
        aria-labelledby="audit-title"
        className="h-[320px]"
        items={events}
        getKey={keyOf}
        estimateHeight={44}
        groupBy={dayOf}
        getTextValue={actorOf}
        onValueChange={(_, e) => setSelected(e)}
        onRangeChange={(a, b) => setRange([a, b])}
        renderItem={(e) => (
          <div className="flex gap-2.5 py-2 pl-3.5">
            <span aria-hidden className="mt-px grid size-5 shrink-0 place-items-center rounded-full border border-line-2 bg-hover font-mono text-[9px] text-fg-2">
              {initials(e.actor)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[13px] leading-5 text-fg-2 [overflow-wrap:anywhere]">
                <span className="font-medium text-fg">{e.actor}</span> {e.action}
              </p>
              {e.detail && <p className="truncate text-[12px] leading-4 text-fg-3">{e.detail}</p>}
            </div>
            <time dateTime={new Date(e.at).toISOString()} className="shrink-0 pt-0.5 font-mono text-[11px] leading-4 text-fg-3 tabular">
              {time.format(e.at)}
            </time>
          </div>
        )}
      />

      <div className="flex h-9 items-center justify-between gap-3 border-t border-line px-3.5 text-[11.5px] text-fg-3">
        <span className="min-w-0 truncate tabular">
          {selected ? (
            <>
              Selected <span className="font-mono text-fg-2">{selected.id}</span>
            </>
          ) : (
            <>
              {count.format(range[0] + 1)}–{count.format(range[1] + 1)} of {count.format(events.length)}
            </>
          )}
        </span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <kbd className="rounded border border-line-2 px-1 font-mono text-[10px] text-fg-2">↑↓</kbd>
          <span>move</span>
          <kbd className="ml-1.5 rounded border border-line-2 px-1 font-mono text-[10px] text-fg-2">a–z</kbd>
          <span>jump to a name</span>
        </span>
      </div>
    </div>
  );
}
