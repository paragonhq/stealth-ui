"use client";
import { useState } from "react";
import { File, X } from "@/lib/icons";
import { PresenceStack, type PresencePerson } from "@/components/ui/presence-stack";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=96&h=96&fit=crop&crop=faces&q=70`;

const team: PresencePerson[] = [
  { id: "maya", name: "Maya Okafor", src: photo("1494790108377-be9c29b29330"), meta: "Editing Pricing" },
  { id: "jon", name: "Jon Park", src: photo("1507003211169-0a1dd7228f2d"), meta: "Viewing" },
  { id: "theo", name: "Theo Nakamura", meta: "Idle 4m", idle: true },
  { id: "lena", name: "Lena Fischer", src: photo("1438761681033-6461ffad8d80"), meta: "Commenting" },
  { id: "priya", name: "Priya Raman", src: photo("1580489944761-15a19d654956"), meta: "Viewing" },
  { id: "marcus", name: "Marcus Webb", src: photo("1500648767791-00dcc994a43e"), meta: "Viewing" },
  { id: "sofia", name: "Sofia Alvarez", meta: "Viewing" },
  { id: "kwame", name: "Kwame Asante", src: photo("1506794778202-cad84cf45f1d"), meta: "Viewing" },
];

const fileViewers = team.slice(3, 8);

const button =
  "inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

export default function Demo() {
  const [people, setPeople] = useState(team.slice(0, 4));
  const [following, setFollowing] = useState<string | null>(null);
  // Whoever you follow can leave; following ends with them.
  const followed = people.find((p) => p.id === following);

  // Newest first, so an arrival is always a face you can see; the last one folds into the count.
  const join = () => setPeople((ps) => [team.find((t) => !ps.some((p) => p.id === t.id))!, ...ps]);
  // Someone from the middle leaves, so the faces either side close ranks.
  const leave = () => setPeople((ps) => ps.filter((_, i) => i !== Math.min(1, ps.length - 1)));

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-4">
      <div
        data-following={followed ? "" : undefined}
        className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-240 ease-out-quart data-following:border-fg-3"
      >
        <div className="flex h-12 items-center gap-3 border-b border-line pl-3.5 pr-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Q3 pricing proposal</p>
            <p className="truncate text-[11.5px] text-fg-3">Edited 2m ago</p>
          </div>
          <PresenceStack
            people={people}
            max={4}
            activeId={followed?.id ?? null}
            onPersonClick={(p) => setFollowing((id) => (id === p.id ? null : p.id))}
          />
        </div>
        <div className="flex h-9 items-center justify-between gap-2 border-b border-line bg-frame/60 px-3.5 text-[12px]">
          {followed ? (
            <>
              <span className="truncate text-fg">
                Following <span className="font-medium">{followed.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setFollowing(null)}
                className="-mr-1.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.96] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
              >
                <X size={14} />
                Stop
              </button>
            </>
          ) : (
            <span className="truncate text-fg-3">Select a face to follow their view</span>
          )}
        </div>
        <div className="flex flex-col gap-2 px-3.5 py-3.5 text-[12.5px] leading-5 text-fg-2">
          <p>
            <span className="font-medium text-fg">Pricing.</span> Move Team to $18 per seat, billed yearly, and keep the free tier at 3 editors.
          </p>
          <p className="text-fg-3">Open question: do we grandfather accounts created before June?</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-raised py-2 pl-3 pr-2.5">
        <File size={16} className="shrink-0 text-fg-3" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">q3-forecast.xlsx</span>
        <PresenceStack people={fileViewers} max={3} size="sm" label="In this file" />
      </div>

      <div className="flex items-center justify-center gap-2">
        <button type="button" className={button} onClick={join} disabled={people.length >= team.length}>
          Someone joins
        </button>
        <button type="button" className={button} onClick={leave} disabled={people.length <= 1}>
          Someone leaves
        </button>
      </div>
    </div>
  );
}
