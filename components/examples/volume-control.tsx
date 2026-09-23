"use client";
import { useState } from "react";
import { VolumeControl } from "@/components/ui/volume-control";

// Two places volume lives: a player bar with room for a track, and a call
// toolbar where it tucks into a popover.
export default function Demo() {
  const [volume, setVolume] = useState(64);
  const [muted, setMuted] = useState(false);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised p-3 shadow-[var(--shadow)]">
        <div className="flex items-center gap-3">
          <div aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-hover font-mono text-[11px] text-fg-3">
            42
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">Designing for latency</p>
            <p className="truncate text-[12px] text-fg-3">Interface Hours · 38:12</p>
          </div>
        </div>
        <div className="mt-3 -ml-2">
          <VolumeControl value={volume} onValueChange={setVolume} muted={muted} onMutedChange={setMuted} showValue />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised py-2 pl-3 pr-2 shadow-[var(--shadow)]">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-fg">Design review</p>
          <p className="truncate text-[12px] text-fg-3">4 people · 12:40</p>
        </div>
        <VolumeControl variant="popover" label="Call volume" defaultValue={80} />
      </div>

      <p className="text-center text-[12px] text-fg-4">Scroll over either to adjust · M to mute</p>
    </div>
  );
}
