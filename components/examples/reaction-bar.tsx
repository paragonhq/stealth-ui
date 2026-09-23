"use client";
import { useState } from "react";
import { ReactionBar, type Reaction } from "@/components/ui/reaction-bar";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=96&h=96&fit=crop&crop=faces&q=70`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const launch: Reaction[] = [
  { emoji: "🎉", count: 5, reacted: true, people: ["Jon Park", "Lena Fischer", "Priya Raman", "Theo Nakamura"] },
  { emoji: "👀", count: 2, people: ["Jon Park", "Marcus Webb"] },
  { emoji: "🚀", count: 1, people: ["Lena Fischer"] },
];

const question: Reaction[] = [{ emoji: "👍", count: 3, people: ["Maya Okafor", "Priya Raman", "Theo Nakamura"] }];

function Message({ name, src, time, children }: { name: string; src: string; time: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- demo photo */}
      <img src={src} alt="" width={32} height={32} className="size-8 shrink-0 rounded-full bg-hover object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-fg">{name}</span>
          <span className="text-[11.5px] text-fg-4 tabular">{time}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

export default function Demo() {
  const [offline, setOffline] = useState(false);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="flex flex-col gap-5 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <Message name="Maya Okafor" src={photo("1494790108377-be9c29b29330")} time="10:42">
          <p className="text-[13px] leading-5 text-fg-2">New onboarding flow is live for 10% of signups. Activation is up 6 points in the first hour.</p>
          <ReactionBar className="mt-1.5" defaultValue={launch} onReact={() => (offline ? wait(500).then(() => Promise.reject(new Error("Offline"))) : wait(300))} />
        </Message>
        <Message name="Jon Park" src={photo("1507003211169-0a1dd7228f2d")} time="10:47">
          <p className="text-[13px] leading-5 text-fg-2">Can we hold the rollout to 25% until the billing fix ships?</p>
          <ReactionBar className="mt-1.5" size="sm" defaultValue={question} onReact={() => (offline ? wait(500).then(() => Promise.reject(new Error("Offline"))) : wait(300))} />
        </Message>
      </div>
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[12px] text-fg-3">{offline ? "Offline: reactions will roll back" : "Online: reactions save in 300ms"}</p>
        <button
          type="button"
          aria-pressed={offline}
          onClick={() => setOffline((o) => !o)}
          className="inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          {offline ? "Go online" : "Go offline"}
        </button>
      </div>
    </div>
  );
}
