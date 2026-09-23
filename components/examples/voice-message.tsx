"use client";
import { useEffect, useState } from "react";
import { VoiceMessage } from "@/components/ui/voice-message";

// The demo makes its own audio: a soft hum shaped into syllables, so there's something to hear
// without shipping a file. The same envelope becomes the waveform, so what you see is what plays.
const RATE = 16000;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function envelope(seconds: number, seed: number) {
  const rand = seeded(seed);
  const points: number[] = [];
  let t = 0.15;
  const frames = Math.round(seconds * 50);
  const env = new Float32Array(frames);
  while (t < seconds - 0.3) {
    const len = 0.12 + rand() * 0.22;
    const loud = 0.35 + rand() * 0.65;
    for (let f = Math.round(t * 50); f < Math.min(frames, Math.round((t + len) * 50)); f++) {
      const x = (f / 50 - t) / len;
      env[f] = Math.max(env[f], loud * Math.sin(Math.PI * x));
    }
    t += len + (rand() < 0.18 ? 0.35 + rand() * 0.4 : 0.03 + rand() * 0.08);
  }
  for (let i = 0; i < 96; i++) {
    const from = Math.floor((i / 96) * frames);
    const to = Math.floor(((i + 1) / 96) * frames);
    let m = 0;
    for (let f = from; f < to; f++) m = Math.max(m, env[f]);
    points.push(m);
  }
  return { env, peaks: points };
}

function wav(seconds: number, env: Float32Array, pitch: number) {
  const n = Math.round(seconds * RATE);
  const buffer = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = env.length ? env[Math.min(env.length - 1, Math.floor(t * 50))] : 0;
    const wobble = pitch * (1 + 0.04 * Math.sin(t * 5.3));
    const s = 0.5 * Math.sin(2 * Math.PI * wobble * t) + 0.25 * Math.sin(4 * Math.PI * wobble * t) + 0.12 * Math.sin(6 * Math.PI * wobble * t);
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * f * 0.5)) * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

const maya = envelope(14, 7);
const you = envelope(6, 21);

export default function Demo() {
  const [urls, setUrls] = useState<{ maya?: string; you?: string }>({});

  useEffect(() => {
    const next = { maya: wav(14, maya.env, 165), you: wav(6, you.env, 120) };
    const t = window.setTimeout(() => setUrls(next), 0);
    return () => {
      window.clearTimeout(t);
      URL.revokeObjectURL(next.maya);
      URL.revokeObjectURL(next.you);
    };
  }, []);

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-1.5">
      <p className="px-1 pb-1 text-[11.5px] text-fg-3">
        <span className="font-medium text-fg-2">Maya Chen</span> · 9:41
      </p>
      <div className="self-start">
        <VoiceMessage src={urls.maya} peaks={maya.peaks} duration={14} preload="auto" label="Voice message from Maya Chen" />
      </div>
      <div className="self-start rounded-2xl bg-fg/[0.07] px-3 py-2 text-[13px] leading-5 text-fg">The EMEA numbers are in the second half.</div>
      <div className="mt-3 self-end">
        <VoiceMessage src={urls.you} peaks={you.peaks} duration={6} own defaultPlayed preload="auto" label="Your voice message" />
      </div>
    </div>
  );
}
