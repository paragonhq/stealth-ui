"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Agenda, type AgendaEvent } from "@/components/ui/agenda";

// The demo's schedule is built around the moment it mounts, so one call is live,
// one is minutes away (Join counting down) and one turns prominent a few seconds in.
let mountedAt = 0;
const subscribe = () => () => {};
const getBase = () => (mountedAt ||= Math.floor(Date.now() / 1000) * 1000);
const useBase = () => useSyncExternalStore(subscribe, getBase, () => null);

function schedule(base: number): AgendaEvent[] {
  const m = (mins: number) => new Date(base + mins * 60000);
  const day = (offset: number, h = 0, min = 0) => {
    const d = new Date(base);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, h, min);
  };
  const meet = (slug: string) => `https://example.com/meet/${slug}`;
  return [
    { id: "standup", title: "Standup", start: m(-190), end: m(-175), meetingUrl: meet("standup"), detail: "Platform team" },
    { id: "review", title: "Design review: onboarding", start: m(-110), end: m(-50), location: "Room 4 · Atlas" },
    { id: "pairing", title: "Pairing: search ranking", start: m(-20), end: m(25), meetingUrl: meet("pairing"), detail: "Priya Raman" },
    { id: "northwind", title: "Customer call: Northwind", start: m(4.5), end: m(34.5), meetingUrl: meet("northwind"), detail: "Dana Whitfield, Leo Park" },
    { id: "interview", title: "Interview: staff engineer", start: m(5.35), end: m(50.35), meetingUrl: meet("interview"), detail: "Panel with Sam, Maya" },
    { id: "roadmap", title: "Roadmap sync", start: m(150), end: m(195), location: "Room 2 · Juniper" },
    { id: "launch", title: "Billing v2 launch", start: day(1), end: day(2), allDay: true, tone: "success" },
    { id: "standup-2", title: "Standup", start: day(1, 9, 30), end: day(1, 9, 45), meetingUrl: meet("standup"), detail: "Platform team" },
    { id: "jordan", title: "1:1 with Jordan", start: day(1, 11), end: day(1, 11, 30), status: "tentative", meetingUrl: meet("jordan") },
    { id: "incident", title: "Incident review: API latency", start: day(1, 15), end: day(1, 16), tone: "warning", meetingUrl: meet("incident") },
    { id: "offsite", title: "Design offsite", start: day(2), end: day(5), allDay: true, location: "Lisbon studio" },
    { id: "crit", title: "Pricing page crit", start: day(2, 14), end: day(2, 14, 45), status: "canceled" },
  ];
}

export default function Demo() {
  const base = useBase();
  // Replaying the demo starts the clock again.
  useEffect(() => () => void (mountedAt = 0), []);
  const events = useMemo(() => (base ? schedule(base) : []), [base]);

  return <Agenda title="Up next" events={events} loading={!base} className="h-[460px] w-full max-w-[400px] sm:h-[500px]" />;
}
