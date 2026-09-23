"use client";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

// Where each spinner earns its place: a build that's running, a person typing,
// an index being built, and an action you trigger yourself.
export default function Demo() {
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    timer.current = window.setTimeout(() => setRefreshing(false), 1600);
  };

  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-11 items-center justify-between border-b border-line pl-4 pr-2">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Activity</p>
        <button
          type="button"
          onClick={refresh}
          aria-label={refreshing ? "Refreshing activity" : "Refresh activity"}
          aria-busy={refreshing || undefined}
          className="relative grid size-8 place-items-center rounded-lg text-fg-2 outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92] active:duration-75 before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden"
        >
          {/* The spinner takes the icon's exact 16px slot, so the button never changes shape. */}
          {refreshing ? (
            <Spinner label="" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
            </svg>
          )}
        </button>
      </div>

      <ul className="flex flex-col py-1.5" aria-label="Activity" aria-busy={refreshing || undefined}>
        <Row
          icon={<Spinner label="Building" className="text-fg-2" />}
          title="stealth-web"
          meta={<span className="font-mono text-[11px]">Building · main · 4f2a91c</span>}
          trail="0:42"
        />
        <Row
          icon={<span className="grid size-5 place-items-center rounded-full bg-line-2 text-[9.5px] font-medium text-fg-2">MO</span>}
          title="Maya Okafor"
          meta={
            <span className="inline-flex items-center gap-1.5">
              <Spinner variant="dots" size="sm" label="Maya is typing" className="text-fg-3" />
              typing a reply
            </span>
          }
          trail="now"
        />
        <Row
          icon={<Spinner variant="grid" label="Indexing" className="text-fg-2" />}
          title="Indexing workspace"
          meta={<span>2,418 files · search works on what’s done</span>}
          trail="68%"
        />
      </ul>
    </div>
  );
}

function Row({ icon, title, meta, trail }: { icon: React.ReactNode; title: string; meta: React.ReactNode; trail: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] text-fg">{title}</span>
        <span className="truncate text-[12px] leading-[18px] text-fg-3">{meta}</span>
      </div>
      <span className="tabular shrink-0 text-[12px] text-fg-4">{trail}</span>
    </li>
  );
}
