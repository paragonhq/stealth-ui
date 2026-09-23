"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { FollowButton } from "@/components/ui/follow-button";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=160&h=160&fit=crop&crop=faces&q=70`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const suggested = [
  { id: "jon", name: "Jon Park", role: "Platform, Northwind", src: photo("1507003211169-0a1dd7228f2d"), fails: false },
  { id: "lena", name: "Lena Fischer", role: "Research lead", src: photo("1438761681033-6461ffad8d80"), fails: true },
];

export default function Demo() {
  const [followers, setFollowers] = useState(1204);

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- demo photo */}
          <img src={photo("1494790108377-be9c29b29330")} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full bg-hover object-cover" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Maya Okafor</p>
            <p className="truncate text-[12px] text-fg-3">Design systems at Northwind</p>
          </div>
          <FollowButton
            name="Maya Okafor"
            onFollowingChange={(f) => setFollowers((n) => n + (f ? 1 : -1))}
            onSave={() => wait(600)}
          />
        </div>
        <div className="flex items-baseline gap-5 text-[12px] text-fg-3">
          <span className="inline-flex items-baseline gap-1">
            <NumberFlow value={followers} locales="en-US" className="font-medium text-fg tabular" />
            followers
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="font-medium text-fg tabular">318</span>
            following
          </span>
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-line bg-raised p-1.5 shadow-[var(--shadow)]">
        <p className="px-2 pb-1 pt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Suggested</p>
        {suggested.map((p) => (
          <div key={p.id} className="flex h-12 items-center gap-2.5 rounded-lg px-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- demo photo */}
            <img src={p.src} alt="" width={28} height={28} className="size-7 shrink-0 rounded-full bg-hover object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-fg">{p.name}</p>
              <p className="truncate text-[11.5px] text-fg-3">{p.fails ? "Saving fails here" : p.role}</p>
            </div>
            <FollowButton
              size="sm"
              name={p.name}
              defaultFollowing={p.id === "jon"}
              onSave={() => (p.fails ? wait(700).then(() => Promise.reject(new Error("Network"))) : wait(500))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
