"use client";
import { useEffect, useRef, useState } from "react";
import { File } from "@/lib/icons";
import { AvatarGroup, type AvatarGroupPerson } from "@/components/ui/avatar-group";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=96&h=96&fit=crop&crop=faces&q=70`;

const everyone: AvatarGroupPerson[] = [
  { name: "Maya Okafor", src: photo("1494790108377-be9c29b29330"), status: "online", meta: "Editing" },
  { name: "Jon Park", src: photo("1507003211169-0a1dd7228f2d"), status: "online", meta: "Viewing" },
  { name: "Lena Fischer", src: photo("1438761681033-6461ffad8d80"), status: "online", meta: "Viewing" },
  { name: "Theo Nakamura", status: "away", meta: "Idle 4m" },
  { name: "Priya Raman", src: photo("1580489944761-15a19d654956"), status: "online", meta: "Viewing" },
  { name: "Marcus Webb", src: photo("1500648767791-00dcc994a43e"), status: "online", meta: "Viewing" },
  { name: "Sofia Alvarez", status: "online", meta: "Viewing" },
];

const guests: AvatarGroupPerson[] = [
  { name: "Ines Duarte", src: photo("1534528741775-53994a69daeb"), status: "online", meta: "Viewing" },
  { name: "Kwame Asante", src: photo("1506794778202-cad84cf45f1d"), status: "online", meta: "Viewing" },
];

const reviewers: AvatarGroupPerson[] = [
  { name: "Lena Fischer", src: photo("1438761681033-6461ffad8d80"), meta: "Approved" },
  { name: "Jon Park", src: photo("1507003211169-0a1dd7228f2d"), meta: "Requested changes" },
  { name: "Theo Nakamura", meta: "Pending" },
];

// People drift in and out of a shared spreadsheet. Pauses while the demo is off screen.
function useLivePresence() {
  const ref = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState(everyone.slice(0, 6));
  useEffect(() => {
    let visible = false;
    let step = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      step++;
      setPeople((list) => {
        const guest = guests.find((g) => !list.includes(g));
        const here = list.filter((p) => guests.includes(p));
        // Alternate: a guest arrives at the front, then the longest-present guest leaves.
        if (step % 2 === 1 && guest) return [guest, ...list];
        if (here.length) return list.filter((p) => p !== here[here.length - 1]);
        return list;
      });
    }, 2600);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, []);
  return { ref, people };
}

export default function Demo() {
  const { ref, people } = useLivePresence();
  return (
    <div ref={ref} className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex h-12 items-center gap-3 rounded-xl border border-line bg-raised pl-3 pr-2.5 shadow-[var(--shadow)]">
        <File size={16} className="shrink-0 text-fg-3" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">q3-forecast.xlsx</p>
          <p className="truncate text-[11.5px] text-fg-3">Finance · Edited just now</p>
        </div>
        <AvatarGroup people={people} label="Viewing now" size="md" max={4} />
      </div>

      <div className="flex h-11 items-center gap-3 rounded-xl border border-line bg-raised pl-3 pr-3 shadow-[var(--shadow)]">
        <span className="shrink-0 rounded-md bg-fg/[0.06] px-1.5 py-0.5 font-mono text-2xs text-fg-2">#482</span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-fg">Move billing webhooks to the queue</p>
        <AvatarGroup people={reviewers} label="Reviewers" size="xs" />
      </div>
    </div>
  );
}
