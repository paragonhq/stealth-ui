"use client";
import { AudioPlayer } from "@/components/ui/audio-player";

// Stored with the upload, the way a server would: 64 loudness values for a one-minute note.
const MAYA_PEAKS = [
  0.96, 0.65, 0.56, 0.48, 0.32, 1, 0.85, 0.68, 1, 0.51, 0.68, 0.62, 0.45, 0.54, 0.54, 0.72, 0.44, 0.35, 0.46, 0.45, 0.51, 0.46,
  0.58, 0.3, 0.43, 0.29, 0.41, 0.46, 0.72, 0.4, 1, 0.47, 0.32, 0.42, 0.81, 0.76, 0.63, 0.65, 1, 0.72, 0.52, 0.66, 0.47, 0.65,
  0.8, 0.84, 0.88, 0.4, 0.25, 0.45, 0.94, 0.84, 0.52, 0.38, 0.91, 0.64, 1, 0.59, 0.68, 0.55, 0.52, 0.45, 0.96, 0.41,
];

const NOTE_A = "https://upload.wikimedia.org/wikipedia/commons/5/5e/Interview_of_I._Salamov.ogg";
const NOTE_B = "https://upload.wikimedia.org/wikipedia/commons/f/f6/Interview_of_D._Kovalchuk.ogg";

// Two voice notes in a thread. Nothing downloads until a note is played (the first
// brings stored peaks; the second decodes its own). Starting one pauses the other.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4">
      <div className="flex items-end gap-2.5">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[11px] font-medium text-fg-2 ring-1 ring-line-2">
          MC
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="px-1 text-[12px] text-fg-3">
            <span className="font-medium text-fg-2">Maya Chen</span> · 9:41
          </p>
          <div className="rounded-2xl rounded-bl-md border border-line bg-raised py-2 pl-2 pr-3 shadow-[var(--shadow)]">
            <AudioPlayer src={NOTE_A} peaks={MAYA_PEAKS} duration={58.8} preload="none" label="Voice message from Maya Chen" variant="bare" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 pl-10">
        <p className="px-1 text-[12px] text-fg-3">You · 9:44</p>
        <div className="w-full rounded-2xl rounded-br-md border border-line-2 bg-hover py-2 pl-2 pr-3">
          <AudioPlayer src={NOTE_B} duration={133.2} preload="none" label="Your voice message" variant="bare" />
        </div>
      </div>
    </div>
  );
}
