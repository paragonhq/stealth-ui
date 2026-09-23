"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { WeekGrid, type CalendarEvent } from "@/components/ui/week-grid";

// Today only exists in the browser; the server render shows the loading grid.
const subscribe = () => () => {};
const useTodayKey = () => useSyncExternalStore(subscribe, () => new Date().toDateString(), () => null);

function teamWeek(todayKey: string): CalendarEvent[] {
  const t = new Date(todayKey);
  const at = (day: number, h: number, m = 0) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + day, h, m);
  const ev = (id: string, title: string, day: number, h: number, m: number, mins: number, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id,
    title,
    start: at(day, h, m),
    end: new Date(at(day, h, m).getTime() + mins * 60000),
    ...extra,
  });
  return [
    { id: "offsite", title: "Design offsite", start: at(-2, 0), end: at(1, 0), allDay: true, location: "Lisbon studio" },
    { id: "launch", title: "Billing v2 launch", start: at(2, 0), end: at(3, 0), allDay: true, tone: "success" },
    ev("standup-0", "Standup", 0, 9, 30, 15, { location: "Zoom" }),
    ev("standup-1", "Standup", 1, 9, 30, 15, { location: "Zoom" }),
    ev("standup-2", "Standup", 2, 9, 30, 15, { location: "Zoom" }),
    ev("standup--1", "Standup", -1, 9, 30, 15, { location: "Zoom" }),
    ev("review", "Design review: onboarding", 0, 11, 0, 60, { location: "Room 4 · Atlas", description: "Walk through the new empty states and the invite flow." }),
    ev("debrief", "Interview debrief", 0, 11, 30, 30),
    ev("lunch", "Lunch with Maya", 0, 12, 30, 60, { status: "tentative" }),
    ev("focus", "Focus: pricing copy", 0, 14, 0, 90),
    ev("hiring", "Hiring sync", 0, 14, 30, 30),
    ev("retro", "Sprint retro", 0, 16, 30, 45, { location: "Zoom" }),
    ev("deploy", "Deploy window", 1, 23, 0, 120, { tone: "warning", description: "API and worker fleet. Keep the status page open." }),
    ev("pairing", "Pairing: search ranking", 1, 13, 0, 120),
    ev("one", "1:1 with Jordan", 1, 10, 0, 30, { status: "canceled" }),
    ev("crit", "Pricing page crit", 2, 14, 0, 45),
    ev("roadmap", "Roadmap planning", 3, 10, 0, 90, { location: "Room 2 · Juniper" }),
    ev("incident", "Incident review: API latency", -1, 15, 0, 60, { tone: "danger" }),
    ev("allhands", "All hands", -2, 16, 0, 60),
    ev("coffee", "Coffee with Sam", 4, 8, 30, 30),
  ];
}

export default function Demo() {
  const todayKey = useTodayKey();
  const [state, setState] = useState<{ key: string; events: CalendarEvent[] } | null>(null);
  // Seed once per day; afterwards the grid's moves and creations are kept.
  const seed = useMemo(() => (todayKey ? teamWeek(todayKey) : []), [todayKey]);
  const events = state && state.key === todayKey ? state.events : seed;

  return (
    <WeekGrid
      events={events}
      onEventsChange={(next) => todayKey && setState({ key: todayKey, events: next })}
      loading={!todayKey}
      className="h-[480px] w-full max-w-[800px] sm:h-[540px]"
    />
  );
}
