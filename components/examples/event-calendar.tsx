"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { EventCalendar, type CalendarEvent } from "@/components/ui/event-calendar";

// Today only exists in the browser; the server render shows the loading grid.
const subscribe = () => () => {};
const useTodayKey = () => useSyncExternalStore(subscribe, () => new Date().toDateString(), () => null);

function teamCalendar(todayKey: string): CalendarEvent[] {
  const t = new Date(todayKey);
  const at = (day: number, h = 0, m = 0) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + day, h, m);
  const timed = (id: string, title: string, day: number, h: number, m: number, mins: number, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id,
    title,
    start: at(day, h, m),
    end: new Date(at(day, h, m).getTime() + mins * 60000),
    ...extra,
  });
  return [
    { id: "offsite", title: "Design offsite", start: at(-2), end: at(1), allDay: true, location: "Lisbon studio" },
    { id: "oncall", title: "On call: Priya", start: at(4), end: at(11), allDay: true },
    { id: "launch", title: "Billing v2 launch", start: at(8), end: at(9), allDay: true, tone: "success", description: "Feature flag flips at 10:00 for all workspaces." },
    { id: "close", title: "Q3 books close", start: at(12), end: at(13), allDay: true, tone: "danger" },
    timed("standup", "Standup", 0, 9, 30, 15, { location: "Zoom" }),
    timed("review", "Design review: onboarding", 0, 11, 0, 60, { location: "Room 4 · Atlas", description: "Walk through the new empty states and the invite flow." }),
    timed("lunch", "Lunch with Maya", 0, 12, 30, 60, { status: "tentative" }),
    timed("hiring", "Hiring sync", 0, 15, 0, 30),
    timed("retro", "Sprint retro", 0, 16, 30, 45, { location: "Zoom" }),
    timed("one", "1:1 with Jordan", 1, 10, 0, 30, { status: "canceled" }),
    timed("pricing", "Pricing page crit", 2, 14, 0, 45),
    timed("roadmap", "Roadmap planning", 3, 13, 0, 90, { location: "Room 2 · Juniper" }),
    timed("incident", "Incident review: API latency", 5, 10, 0, 60, { tone: "warning" }),
    timed("demo", "Customer demo: Northwind", 7, 15, 0, 45),
    timed("board", "Board prep", 9, 9, 0, 120),
    timed("allhands", "All hands", -4, 16, 0, 60),
    timed("interview", "Interview: staff engineer", -6, 11, 0, 60),
  ];
}

export default function Demo() {
  const todayKey = useTodayKey();
  const initial = useMemo(() => (todayKey ? teamCalendar(todayKey) : []), [todayKey]);
  const [added, setAdded] = useState<CalendarEvent[]>([]);
  const events = useMemo(() => [...initial, ...added], [initial, added]);

  return (
    <EventCalendar
      events={events}
      onEventsChange={(next) => setAdded(next.filter((e) => !initial.includes(e)))}
      loading={!todayKey}
      className="h-[460px] w-full max-w-[780px] sm:h-[540px]"
    />
  );
}
