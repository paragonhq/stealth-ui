"use client";
import { useRef, useState } from "react";
import { LikeButton } from "@/components/ui/like-button";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A changelog post and its replies. Go offline to watch a like roll back.
export default function Demo() {
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offlineRef = useRef(false);

  const save = async () => {
    await wait(600);
    if (offlineRef.current) throw new Error("offline");
  };

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <article className="p-4">
        <div className="flex items-center gap-2 text-[12px] text-fg-3">
          <span className="grid size-5 place-items-center rounded-full bg-hover text-[9.5px] font-medium text-fg-2">EL</span>
          <span className="text-fg-2">Elif Lindqvist</span>
          <span aria-hidden>·</span>
          <time dateTime="2026-09-21">Yesterday</time>
        </div>
        <h3 className="mt-2 text-[14px] font-medium tracking-[-0.015em] text-fg">Branch previews for every pull request</h3>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-fg-2">
          Each PR now gets its own URL, rebuilt on every push and torn down on merge.
        </p>
        <div className="-ml-2.5 mt-3 flex items-center gap-1">
          <LikeButton count={128} onSave={save} onError={() => setError("Couldn’t save your like. You’re offline.")} />
          <span className="px-2 text-[12px] text-fg-3">
            {error ? <span className="text-danger">{error}</span> : "14 replies"}
          </span>
        </div>
      </article>

      <ul className="border-t border-line">
        {[
          { who: "Tomasz Wierzbicki", initials: "TW", text: "The teardown on merge is the part I needed.", count: 9, liked: true },
          { who: "Aiyana Brooks", initials: "AB", text: "Do previews inherit production env vars?", count: 0, liked: false },
        ].map((c) => (
          <li key={c.who} className="flex gap-2.5 border-b border-line px-4 py-3 last:border-b-0">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[9.5px] font-medium text-fg-2">{c.initials}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-fg">{c.who}</p>
              <p className="text-[12.5px] leading-[1.5] text-fg-2">{c.text}</p>
            </div>
            <LikeButton size="sm" className="-mr-2 self-start" count={c.count} defaultLiked={c.liked} onSave={save} label={`Like ${c.who.split(" ")[0]}’s reply`} />
          </li>
        ))}
      </ul>

      <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-line bg-frame/50 px-4 py-2.5 text-[12px] text-fg-3">
        <span>Simulate being offline</span>
        <input
          type="checkbox"
          checked={offline}
          onChange={(e) => {
            offlineRef.current = e.target.checked;
            setOffline(e.target.checked);
            setError(null);
          }}
          className="size-3.5 accent-fg"
        />
      </label>
    </div>
  );
}
