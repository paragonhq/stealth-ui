"use client";
import { useState } from "react";
import { BookmarkGlyph, HeartGlyph, MuteGlyph, PinGlyph, StarGlyph, ToggleButton } from "@/components/ui/toggle-button";

function Bold() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.75 3h4a2.5 2.5 0 0 1 0 5h-4zM4.75 8h4.75a2.5 2.5 0 0 1 0 5H4.75z" />
    </svg>
  );
}
function Italic() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <path d="M7 3h5M4 13h5M9.5 3l-3 10" />
    </svg>
  );
}

// An article you can like, save and star, and a note editor with formatting,
// a pinned state and a mute for its sounds.
export default function Demo() {
  const [likes, setLikes] = useState(false);
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <article className="rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">Engineering</p>
        <h3 className="mt-1.5 text-balance text-[14px] font-medium tracking-[-0.015em] text-fg">How we cut deploy times in half</h3>
        <p className="mt-0.5 text-[12px] text-fg-3">Maya Chen · 8 min read</p>
        <div className="mt-3.5 flex items-center justify-between">
          <ToggleButton variant="secondary" size="sm" pressed={likes} onPressedChange={setLikes}>
            <HeartGlyph />
            <span>Like</span>
            <span className="tabular font-normal text-fg-3">{likes ? 129 : 128}</span>
          </ToggleButton>
          <div className="flex items-center gap-0.5">
            <ToggleButton label="Save to reading list" tooltip="Save" defaultPressed>
              <BookmarkGlyph />
            </ToggleButton>
            <ToggleButton label="Add to favorites" tooltip="Favorite">
              <StarGlyph />
            </ToggleButton>
          </div>
        </div>
      </article>

      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center gap-0.5 border-b border-line p-1.5">
          <ToggleButton label="Bold" shortcut="⌘ B" size="sm" defaultPressed>
            <Bold />
          </ToggleButton>
          <ToggleButton label="Italic" shortcut="⌘ I" size="sm">
            <Italic />
          </ToggleButton>
          <span aria-hidden className="mx-1.5 h-4 w-px bg-line-2" />
          <ToggleButton size="sm">
            <PinGlyph />
            Pin
          </ToggleButton>
          <ToggleButton label="Mute notification sounds" tooltip="Mute sounds" size="sm" className="ml-auto">
            <MuteGlyph />
          </ToggleButton>
        </div>
        <p className="px-4 py-3 text-[12.5px] leading-[1.55] text-fg-2">
          <strong className="font-medium text-fg">Launch checklist</strong> — freeze the pricing page by Thursday, then hand the copy to legal.
        </p>
      </div>
    </div>
  );
}
