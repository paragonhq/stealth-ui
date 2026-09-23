"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Refresh } from "@/lib/icons";
import { Avatar, AvatarPresence, presenceLabel, type Presence } from "@/components/ui/avatar";

const photo = (id: string, bust: number) => `https://images.unsplash.com/photo-${id}?w=160&h=160&fit=crop&crop=faces&q=70${bust ? `&v=${bust}` : ""}`;

// An image that can't be decoded: the browser reports an error without a network request.
const broken = "data:image/png;base64,AAAA";

const team = [
  { name: "Jon Park", role: "Engineering", photo: "1507003211169-0a1dd7228f2d", status: "online" as Presence },
  { name: "Priya Raman", role: "Product", photo: null, status: "busy" as Presence, broken: true },
  { name: "Theo Nakamura", role: "Support", photo: null, status: "offline" as Presence },
  { name: "Lena Fischer", role: "Design", photo: "1438761681033-6461ffad8d80", status: "away" as Presence },
];

const statuses: Presence[] = ["online", "away", "busy", "offline"];

// A profile header with a presence picker, and a member list whose photos you can reload.
export default function Demo() {
  const [status, setStatus] = useState<Presence>("online");
  const [bust, setBust] = useState(0);

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="flex items-center gap-3.5 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <Avatar key={`me-${bust}`} name="Maya Okafor" src={photo("1494790108377-be9c29b29330", bust)} size="xl" status={status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Maya Okafor</p>
          <p className="truncate text-[12px] text-fg-3">Design engineer · Lisbon</p>
          <div role="group" aria-label="Your status" className="mt-2 flex flex-wrap gap-1">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "relative inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-fg-3",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[background-color,color,scale] duration-150 hover:text-fg-2 active:scale-[0.95] active:duration-75",
                  "aria-pressed:bg-fg/[0.07] aria-pressed:text-fg",
                  "before:absolute before:-inset-x-0.5 before:-inset-y-2.5 before:content-[''] pointer-fine:before:hidden",
                )}
              >
                <AvatarPresence status={s} size={7} />
                {presenceLabel[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-11 items-center gap-2.5 border-b border-line pl-3 pr-1.5">
          <Avatar name="Northwind" shape="square" size="sm" alt="" tone={4} />
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
            Northwind <span className="font-normal text-fg-3">· 5 members</span>
          </p>
          <button
            type="button"
            onClick={() => setBust(Date.now())}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
            )}
          >
            <Refresh size={14} />
            Reload photos
          </button>
        </div>
        <ul className="flex flex-col py-1">
          {team.map((p) => (
            <li key={p.name} className="flex h-11 items-center gap-3 px-3">
              <Avatar
                key={`${p.name}-${bust}`}
                name={p.name}
                alt=""
                src={p.photo ? photo(p.photo, bust) : p.broken ? broken : undefined}
                status={p.status}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{p.name}</span>
              <span className="shrink-0 text-[12px] text-fg-3">{p.role}</span>
            </li>
          ))}
          <li className="flex h-11 items-center gap-3 px-3" aria-busy>
            <Avatar loading />
            <span className="h-2.5 w-28 rounded-full bg-fg/[0.06]" />
            <span className="ml-auto h-2.5 w-14 rounded-full bg-fg/[0.06]" />
          </li>
        </ul>
      </div>
    </div>
  );
}
