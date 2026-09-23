"use client";
import { useRef, useState } from "react";
import { LoadMore } from "@/components/ui/load-more";

type Event = { id: number; who: string; initials: string; action: string; target: string; when: string };

const people = [
  ["Maya Okafor", "MO"],
  ["Jonas Berg", "JB"],
  ["Priya Raman", "PR"],
  ["Tomás Ferreira", "TF"],
  ["Lena Vogel", "LV"],
] as const;
const actions = [
  ["rotated the API key", "prod-ingest"],
  ["invited", "sam@northwind.dev"],
  ["changed the plan to", "Team, annual"],
  ["deployed", "acme-web to production"],
  ["removed", "legacy-webhook"],
  ["updated billing email to", "finance@northwind.dev"],
  ["enabled SSO for", "northwind.dev"],
  ["exported", "q3-forecast.xlsx"],
  ["archived the project", "Checkout v1"],
] as const;
const whens = ["4m", "18m", "42m", "1h", "2h", "3h", "5h", "Yesterday", "Yesterday", "Mon", "Mon", "Sun", "Sat", "Sat", "Fri", "12 Sep", "11 Sep", "9 Sep"];

const TOTAL = 18;
const all: Event[] = Array.from({ length: TOTAL }, (_, i) => {
  const [who, initials] = people[(i * 3) % people.length];
  const [action, target] = actions[(i * 5) % actions.length];
  return { id: i + 1, who, initials, action, target, when: whens[i] };
});

const PAGE = 5;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A workspace audit log. The second page fails once so the retry can be seen;
// the fourth page is the last, and the button hands over to the end marker.
export default function Demo() {
  const [events, setEvents] = useState(() => all.slice(0, PAGE));
  const pages = useRef(0);

  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[13.5px] font-medium tracking-[-0.012em] text-fg">Audit log</p>
        <p className="font-mono text-[11px] text-fg-3">northwind</p>
      </div>
      <div className="max-h-[340px] overflow-y-auto overscroll-contain px-2 py-2">
        <LoadMore
          listLabel="Audit log"
          total={TOTAL}
          hasMore={events.length < TOTAL}
          className="pb-2"
          onLoadMore={async () => {
            await wait(900);
            if (pages.current++ === 1) throw new Error("Network");
            setEvents((e) => all.slice(0, e.length + PAGE));
          }}
        >
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-hover">
              <span aria-hidden className="mt-px grid size-6 shrink-0 place-items-center rounded-full border border-line bg-frame text-[10px] font-medium text-fg-2">
                {e.initials}
              </span>
              <p className="min-w-0 flex-1 text-[12.5px] leading-[18px] text-fg-2">
                <span className="font-medium text-fg">{e.who}</span> {e.action} <span className="text-fg">{e.target}</span>
              </p>
              <time className="shrink-0 pt-px font-mono text-[11px] leading-[18px] text-fg-3">{e.when}</time>
            </div>
          ))}
        </LoadMore>
      </div>
    </div>
  );
}
