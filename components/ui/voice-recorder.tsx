"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/ui/audio-player";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ the recording lifecycle */

export type RecorderPhase = "idle" | "requesting" | "recording" | "paused" | "review" | "sending" | "denied" | "unavailable" | "error";

export type VoiceRecording = {
  blob: Blob;
  mimeType: string;
  /** Seconds, measured while recording (MediaRecorder files often report no duration). */
  duration: number;
  /** Loudness per slice, 0–1, ready for a waveform. */
  peaks: number[];
};

const TICK = 80; // ms between level samples: ~12 bars a second
const MIME = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

function resample(values: number[], count: number) {
  if (!values.length) return [];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.floor((i * values.length) / count);
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / count));
    out.push(Math.max(...values.slice(a, b)));
  }
  return out;
}

/**
 * Microphone to Blob, without the markup: permission, levels, pause, a max length,
 * and cleanup of every track, context and timer. Levels are sampled from Web Audio
 * so the waveform you review is the one you watched while speaking.
 */
export function useVoiceRecorder({ maxDuration = 120 }: { maxDuration?: number } = {}) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [recording, setRecording] = useState<(VoiceRecording & { url: string }) | null>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<number>(undefined);
  const chunks = useRef<Blob[]>([]);
  const history = useRef<number[]>([]);
  const clock = useRef({ banked: 0, since: 0 });
  const urlRef = useRef<string | null>(null);

  const release = useCallback(() => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (rec.current && rec.current.state !== "inactive") {
        rec.current.onstop = null;
        rec.current.stop();
      }
      release();
      revoke();
    },
    [release, revoke],
  );

  const now = () => clock.current.banked + (clock.current.since ? performance.now() - clock.current.since : 0);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r || r.state === "inactive") return;
    clock.current.banked = now();
    clock.current.since = 0;
    window.clearInterval(timer.current);
    r.stop();
  }, []);

  const sample = useCallback(
    (analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>) => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // Speech sits around 0.02–0.2 RMS; a square-root curve spreads it over the bar height.
      const level = Math.min(1, Math.sqrt(rms) * 1.9);
      history.current.push(level);
      setLevels(history.current.slice(-160));
      const t = now() / 1000;
      setElapsed(t);
      if (t >= maxDuration) stop();
    },
    [maxDuration, stop],
  );

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("unavailable");
      return;
    }
    revoke();
    setRecording(null);
    setPhase("requesting");
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const name = (err as DOMException)?.name;
      setPhase(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" || name === "NotSupportedError" ? "unavailable" : "error");
      return;
    }
    stream.current = s;
    const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const r = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
    rec.current = r;
    chunks.current = [];
    history.current = [];
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    r.onstop = () => {
      release();
      const type = r.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      const duration = clock.current.banked / 1000;
      if (duration < 0.5 || !blob.size) {
        // Too short to be a message: treat it as a slip of the finger.
        setPhase("idle");
        return;
      }
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setRecording({ blob, mimeType: type, duration, peaks: resample(history.current, 64), url });
      setPhase("review");
    };

    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    ctx.current = ac;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(s).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    clock.current = { banked: 0, since: performance.now() };
    setElapsed(0);
    setLevels([]);
    r.start(250);
    setPhase("recording");
    timer.current = window.setInterval(() => sample(analyser, buf), TICK);

    // A microphone unplugged mid-take ends the take rather than recording silence.
    s.getAudioTracks()[0]?.addEventListener("ended", () => stop());
  }, [release, revoke, sample, stop]);

  const pause = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== "recording") return;
    r.pause();
    clock.current.banked = now();
    clock.current.since = 0;
    window.clearInterval(timer.current);
    setPhase("paused");
  }, []);

  const resume = useCallback(() => {
    const r = rec.current;
    const ac = ctx.current;
    if (!r || r.state !== "paused" || !ac || !stream.current) return;
    r.resume();
    clock.current.since = performance.now();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(stream.current).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    timer.current = window.setInterval(() => sample(analyser, buf), TICK);
    setPhase("recording");
  }, [sample]);

  const discard = useCallback(() => {
    const r = rec.current;
    if (r && r.state !== "inactive") {
      r.onstop = null;
      r.stop();
    }
    release();
    revoke();
    rec.current = null;
    setRecording(null);
    setLevels([]);
    setElapsed(0);
    setPhase("idle");
  }, [release, revoke]);

  const reset = useCallback(() => setPhase("idle"), []);

  return { phase, setPhase, elapsed, levels, recording, start, pause, resume, stop, discard, reset, maxDuration };
}

/* ------------------------------------------------------------------ component */

export type VoiceRecorderProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Called with the finished take. Return a promise to keep the send button busy until it settles; a rejection keeps the take for another try. */
  onSend: (recording: VoiceRecording) => void | Promise<void>;
  /** Seconds. Recording stops into review on its own when it gets there. */
  maxDuration?: number;
  /** The line shown at rest. */
  placeholder?: string;
  disabled?: boolean;
};

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({ onSend, maxDuration = 120, placeholder = "Record a voice message", disabled, className, ...rest }: VoiceRecorderProps) {
  const reduce = !!useReducedMotion();
  const r = useVoiceRecorder({ maxDuration });
  const [sendError, setSendError] = useState(false);
  const [announce, setAnnounce] = useState("");
  const primary = useRef<HTMLButtonElement>(null);
  const { phase } = r;

  const live = phase === "recording" || phase === "paused";
  const blocked = phase === "denied" || phase === "unavailable" || phase === "error";
  const left = maxDuration - r.elapsed;
  const nearEnd = live && left <= 10;

  // Say each change of state once, in words.
  useEffect(() => {
    const words: Partial<Record<RecorderPhase, string>> = {
      recording: "Recording",
      paused: "Recording paused",
      review: "Recording stopped. Review before sending.",
      denied: "Microphone access is blocked",
      unavailable: "Recording isn’t available here",
      error: "Couldn’t start recording",
    };
    const t = window.setTimeout(() => setAnnounce(words[phase] ?? ""), 0);
    return () => window.clearTimeout(t);
  }, [phase]);

  // If the person unblocks the microphone in site settings, come back to life without a reload.
  useEffect(() => {
    if (phase !== "denied" || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (status?.state !== "denied") r.reset();
    };
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener("change", onChange);
      })
      .catch(() => {});
    return () => status?.removeEventListener("change", onChange);
  }, [phase, r]);

  const send = async () => {
    if (!r.recording) return;
    const { url: _url, ...take } = r.recording;
    void _url;
    setSendError(false);
    r.setPhase("sending");
    try {
      await onSend(take);
      r.discard();
      setAnnounce("Voice message sent");
    } catch {
      r.setPhase("review");
      setSendError(true);
    }
  };

  const onPrimary = () => {
    if (phase === "idle" || blocked) return void r.start();
    if (live) return r.stop();
    if (phase === "review") return void send();
  };

  const primaryLabel = live ? "Stop recording" : phase === "review" || phase === "sending" ? "Send voice message" : blocked ? "Try again" : "Record voice message";
  // The resting target is the same either way, so server and client render the same style.
  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" },
  };

  return (
    <div
      role="group"
      aria-label="Voice message"
      data-state={phase}
      className={cn(
        "relative flex min-h-12 min-w-0 items-center gap-1 rounded-xl border bg-raised px-1.5 shadow-[var(--shadow)] transition-[border-color] duration-200",
        live ? "border-line-2" : blocked ? "border-danger/30" : "border-line",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...rest}
    >
      {/* Discard lives on the left once there's something to throw away. */}
      <AnimatePresence initial={false}>
        {(live || phase === "review" || phase === "sending") && (
          <motion.div
            key="discard"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 32 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, width: 0, transition: { duration: 0.14 } }}
            transition={reduce ? { duration: 0.12 } : { ...spring.snappy }}
            className="shrink-0"
          >
            <IconButton label={live ? "Cancel recording" : "Delete recording"} onClick={r.discard} disabled={phase === "sending"} tone="danger">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 4.5h10M6.5 4.5V3.25h3V4.5M4.5 4.5l.6 8.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.1M6.75 7v4M9.25 7v4" />
              </svg>
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The middle: one region whose content changes with the phase, in place. */}
      <div className="relative flex min-w-0 flex-1 items-center self-stretch">
        <AnimatePresence initial={false} mode="popLayout">
          {(phase === "idle" || phase === "requesting") && (
            <motion.p key="idle" {...swap} transition={{ duration: 0.18, ease: ease.out }} className="truncate pl-2 text-[13px] text-fg-3">
              {phase === "requesting" ? "Waiting for the microphone…" : placeholder}
            </motion.p>
          )}

          {live && (
            <motion.div key="live" {...swap} transition={{ duration: 0.2, ease: ease.out }} className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-1">
              <span className="flex shrink-0 items-center gap-2">
                <span aria-hidden className="relative grid size-2.5 place-items-center">
                  {phase === "recording" ? (
                    <>
                      <span className="absolute inset-0 animate-ping-soft rounded-full bg-danger motion-reduce:hidden" />
                      <span className="relative size-2.5 rounded-full bg-danger" />
                    </>
                  ) : (
                    <span className="relative size-2.5 rounded-[2px] border-x-[3px] border-fg-3" />
                  )}
                </span>
                <span className={cn("tabular font-mono text-[12px] transition-colors duration-200", nearEnd ? "text-warning" : phase === "paused" ? "text-fg-3" : "text-fg")}>
                  {nearEnd ? `${formatClock(left)} left` : formatClock(r.elapsed)}
                </span>
              </span>
              <LevelStrip levels={r.levels} paused={phase === "paused"} reduce={reduce} />
            </motion.div>
          )}

          {(phase === "review" || phase === "sending") && r.recording && (
            <motion.div key="review" {...swap} transition={{ duration: 0.22, ease: ease.out }} className="flex min-w-0 flex-1 flex-col justify-center">
              <AudioPlayer
                src={r.recording.url}
                peaks={r.recording.peaks}
                duration={r.recording.duration}
                label="Your recording"
                variant="bare"
                rates={[1]}
                bars={40}
                playStyle="soft"
                className="gap-2.5"
              />
            </motion.div>
          )}

          {blocked && (
            <motion.div key={phase} {...swap} transition={{ duration: 0.2, ease: ease.out }} role="alert" className="flex min-w-0 items-center gap-2.5 py-1.5 pl-1.5">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="2" width="4" height="7.5" rx="2" />
                  <path d="M3.75 7.5a4.25 4.25 0 0 0 8.5 0M8 11.75v2.25M2.5 2.5l11 11" />
                </svg>
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[12.5px] font-medium text-fg">
                  {phase === "denied" ? "Microphone access is blocked" : phase === "unavailable" ? "No microphone available" : "Couldn’t start recording"}
                </span>
                {/* The hint is what to do next: it wraps rather than truncates on a narrow screen. */}
                <span className="block text-[12px] leading-[1.35] text-fg-3 [text-wrap:pretty]">
                  {phase === "denied"
                    ? "Allow it in your browser’s site settings, then try again."
                    : phase === "unavailable"
                      ? "Connect a microphone, or use a secure (https) page."
                      : "Check your microphone, then try again."}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {sendError && phase === "review" && (
        <span role="alert" className="pointer-events-none absolute -top-6 right-1 text-[12px] text-danger">
          Couldn’t send. Try again.
        </span>
      )}

      {/* Pause / resume sits beside the primary while a take is live. */}
      <AnimatePresence initial={false}>
        {live && (
          <motion.div
            key="pause"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 32 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, width: 0, transition: { duration: 0.14 } }}
            transition={reduce ? { duration: 0.12 } : { ...spring.snappy }}
            className="shrink-0"
          >
            <IconButton label={phase === "paused" ? "Resume recording" : "Pause recording"} onClick={phase === "paused" ? r.resume : r.pause}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={phase}
                  className="grid place-items-center"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  transition={reduce ? { duration: 0.1 } : spring.pop}
                >
                  {phase === "paused" ? (
                    <span className="size-2.5 rounded-full bg-danger" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                      <path d="M5.25 3.5v9M10.75 3.5v9" />
                    </svg>
                  )}
                </motion.span>
              </AnimatePresence>
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One primary button whose meaning moves with the take: record, stop, send. */}
      <button
        ref={primary}
        type="button"
        onClick={onPrimary}
        disabled={disabled || phase === "requesting" || phase === "sending"}
        aria-label={primaryLabel}
        aria-busy={phase === "sending" || phase === "requesting" || undefined}
        className={cn(
          "relative grid size-8 shrink-0 place-items-center rounded-full outline-none",
          "transition-[background-color,color,scale] duration-150 ease-out-quart active:scale-[0.92] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden disabled:cursor-default",
          blocked ? "h-8 w-auto rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg hover:bg-hover" : "bg-fg text-frame hover:bg-fg/90",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={blocked ? "retry" : live ? "stop" : phase === "review" || phase === "sending" ? "send" : "mic"}
            className="grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            animate={{ opacity: phase === "sending" ? 0 : 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            {blocked ? (
              "Try again"
            ) : live ? (
              <span className="size-2.5 rounded-[3px] bg-current" />
            ) : phase === "review" || phase === "sending" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 13V3M4 7l4-4 4 4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="6" y="2" width="4" height="7.5" rx="2" />
                <path d="M3.75 7.5a4.25 4.25 0 0 0 8.5 0M8 11.75v2.25" />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
        {(phase === "sending" || phase === "requesting") && (
          <svg aria-hidden viewBox="0 0 16 16" className="absolute size-4 animate-spin [animation-duration:0.8s]">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
            <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

// The newest level enters at the right edge; older ones step left. Empty slots show a quiet baseline.
function LevelStrip({ levels, paused, reduce }: { levels: number[]; paused: boolean; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(40);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSlots(Math.max(8, Math.floor(e.contentRect.width / 4))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown = levels.slice(-slots);
  const offset = levels.length - shown.length;
  const pad = slots - shown.length;
  return (
    <div ref={ref} aria-hidden className={cn("flex h-7 min-w-0 flex-1 items-center justify-between transition-opacity duration-200", paused && "opacity-45")}>
      {Array.from({ length: pad }, (_, i) => (
        <span key={`pad-${i}`} className="h-[3px] w-[2px] shrink-0 rounded-full bg-fg/15" />
      ))}
      {shown.map((l, i) => (
        <motion.span
          key={offset + i}
          className="w-[2px] shrink-0 rounded-full bg-fg"
          style={{ height: `${Math.max(12, Math.round(l * 100))}%`, originY: 0.5 }}
          initial={reduce ? false : { scaleY: 0.2, opacity: 0.4 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.16, ease: ease.out }}
        />
      ))}
    </div>
  );
}

function IconButton({ label, onClick, disabled, tone, children }: { label: string; onClick: () => void; disabled?: boolean; tone?: "danger"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative grid size-8 place-items-center rounded-lg text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 disabled:opacity-50",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
        tone === "danger" ? "hover:text-danger" : "hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
