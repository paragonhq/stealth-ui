"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CharLimitRing, countCharacters } from "@/components/ui/char-limit-ring";

const LIMIT = 280;
const draft =
  "Shipped: branch previews now spin up in under 40 seconds, down from four minutes. Every pull request gets its own URL, seeded database and logs. Thanks to the platform team for three weeks of profiling and one very long Thursday. Try it and tell us what breaks.";

// A post composer: the ring sits beside the send button and takes over from a count when it matters.
export default function Demo() {
  const [text, setText] = useState(draft);
  const [bio, setBio] = useState("Design engineer at Northwind. Types and trains.");
  const count = countCharacters(text);
  const over = count > LIMIT;

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-5">
      <div
        className={cn(
          "flex flex-col rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150",
          "focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8",
          over && "border-danger/60 focus-within:border-danger focus-within:ring-danger/15",
        )}
      >
        <label htmlFor="post" className="sr-only">
          Post
        </label>
        <textarea
          id="post"
          rows={5}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          aria-describedby="post-count"
          aria-invalid={over || undefined}
          placeholder="What did you ship?"
          className="block w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-base leading-6 text-fg outline-none placeholder:text-fg-4 sm:text-[13.5px] sm:leading-[22px]"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-2 pl-3.5">
          <span className="min-w-0 truncate text-[12px] text-fg-3">Visible to everyone at Northwind</span>
          <div className="flex shrink-0 items-center gap-2">
            <CharLimitRing id="post-count" count={count} limit={LIMIT} />
            <span aria-hidden className="h-5 w-px bg-line-2" />
            <button
              type="button"
              disabled={over || count === 0}
              className={cn(
                "inline-flex h-8 items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,opacity,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              Post
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-[12.5px] font-medium text-fg">
          Bio
        </label>
        <div className="flex h-9 items-center gap-1 rounded-lg border border-line-2 bg-raised pr-1 pl-3 shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8">
          <input
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.currentTarget.value)}
            aria-describedby="bio-count"
            className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none sm:text-[13px]"
          />
          <CharLimitRing id="bio-count" size="sm" count={countCharacters(bio)} limit={80} />
        </div>
      </div>
    </div>
  );
}
