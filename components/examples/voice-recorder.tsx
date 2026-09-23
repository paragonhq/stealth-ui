"use client";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/ui/audio-player";
import { VoiceRecorder, type VoiceRecording } from "@/components/ui/voice-recorder";

type Sent = { id: number; url: string; duration: number; peaks: number[] };

// A reply in a design-review thread. Record, pause, listen back, then send: the take
// lands in the thread with the waveform you watched while speaking.
export default function Demo() {
  const [sent, setSent] = useState<Sent[]>([]);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const send = async (rec: VoiceRecording) => {
    // Stand-in for the upload.
    await new Promise((r) => setTimeout(r, 700));
    const url = URL.createObjectURL(rec.blob);
    urls.current.push(url);
    setSent((s) => [...s, { id: Date.now(), url, duration: rec.duration, peaks: rec.peaks }].slice(-2));
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[11px] font-medium text-fg-2 ring-1 ring-line-2">
          JO
        </span>
        <div className="min-w-0 rounded-2xl rounded-tl-md border border-line bg-raised px-3 py-2">
          <p className="text-[12px] text-fg-3">
            <span className="font-medium text-fg-2">Jonas Ortiz</span> · 10:12
          </p>
          <p className="text-[13px] leading-[1.45] text-fg">Can you talk me through the new onboarding flow? Easier than typing it out.</p>
        </div>
      </div>

      {sent.map((m) => (
        <div key={m.id} className="ml-10 rounded-2xl rounded-br-md border border-line-2 bg-hover py-2 pl-2 pr-3">
          <AudioPlayer src={m.url} peaks={m.peaks} duration={m.duration} label="Your voice message" variant="bare" />
        </div>
      ))}

      <VoiceRecorder onSend={send} maxDuration={60} placeholder="Reply with a voice message" className="mt-1" />
    </div>
  );
}
