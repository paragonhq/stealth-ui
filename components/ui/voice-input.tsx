"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Mic, Warning, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Engine: where the audio, the level and the words come from
 * -----------------------------------------------------------------------------------------------*/

export type VoiceError = "denied" | "unavailable" | "no-speech" | "failed";

export type VoiceEvents = {
  lang?: string;
  /** Input loudness, 0–1. Call it as often as you have it; the bars sample it. */
  onLevel: (level: number) => void;
  /** The transcript so far. `final` is false while the last words may still change. */
  onTranscript: (text: string, final: boolean) => void;
  /** After `stop()`: the finished transcript, and the recording when there is one. */
  onEnd: (result: { text: string; audio?: Blob }) => void;
  onError: (error: VoiceError) => void;
};

export type VoiceSession = { stop: () => void; cancel: () => void };

/** Resolves once the microphone is open; rejects with a VoiceError when it can't be. */
export type VoiceEngine = (events: VoiceEvents) => Promise<VoiceSession>;

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

/**
 * The built-in engine: the microphone for levels and a recording, and the
 * browser's own speech recognition for live words where it exists. Pass
 * `transcribe` to VoiceInput to send the recording to your own service instead.
 */
export const browserVoiceEngine: VoiceEngine = async (ev) => {
  if (!navigator.mediaDevices?.getUserMedia) throw "unavailable" satisfies VoiceError;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    throw (name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable") satisfies VoiceError;
  }

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    // Speech sits around 0.02–0.15 RMS; stretch it so a normal voice fills the bars.
    ev.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 7));
    raf = requestAnimationFrame(tick);
  };
  tick();

  const chunks: Blob[] = [];
  const recorder = typeof MediaRecorder !== "undefined" ? new MediaRecorder(stream) : null;
  if (recorder) {
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start();
  }

  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const rec = SR ? new SR() : null;
  let finalText = "";
  let interim = "";
  if (rec) {
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = ev.lang ?? document.documentElement.lang ?? "en-US";
    rec.onresult = (e) => {
      finalText = "";
      interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      ev.onTranscript(`${finalText}${interim}`.trim(), !interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") ev.onError("denied");
    };
    try {
      rec.start();
    } catch {
      /* Already started or unsupported; levels and recording still work. */
    }
  }

  const release = () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    stop() {
      cancelAnimationFrame(raf);
      const audio = new Promise<Blob | undefined>((resolve) => {
        if (!recorder || recorder.state === "inactive") return resolve(undefined);
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
        recorder.stop();
      });
      // Recognition delivers its last final result just before it ends; don't wait forever for it.
      const words = new Promise<void>((resolve) => {
        if (!rec) return resolve();
        const t = window.setTimeout(resolve, 1500);
        rec.onend = () => (window.clearTimeout(t), resolve());
        rec.stop();
      });
      void Promise.all([audio, words]).then(([blob]) => {
        release();
        ev.onEnd({ text: `${finalText} ${interim}`.trim(), audio: blob });
      });
    },
    cancel() {
      rec?.abort();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
};

/* -------------------------------------------------------------------------------------------------
 * useVoiceInput: the state machine on its own
 * -----------------------------------------------------------------------------------------------*/

export type VoiceState = "idle" | "requesting" | "listening" | "transcribing" | "error";

export type UseVoiceInputOptions = {
  engine?: VoiceEngine;
  lang?: string;
  /** Turn the recording into text yourself. When set, it replaces the engine's live words at the end. */
  transcribe?: (audio: Blob) => Promise<string>;
  /** Seconds before listening stops on its own. */
  maxDuration?: number;
  onTranscript?: (text: string) => void;
  onError?: (error: VoiceError) => void;
};

export function useVoiceInput({ engine = browserVoiceEngine, lang, transcribe, maxDuration = 120, onTranscript, onError }: UseVoiceInputOptions = {}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceError | null>(null);
  const [transcript, setTranscript] = useState({ text: "", final: true });
  const [elapsed, setElapsed] = useState(0);
  const phase = useRef<VoiceState>("idle");
  const session = useRef<VoiceSession | null>(null);
  const run = useRef(0);
  const levels = useRef(new Set<(level: number) => void>());
  const latest = useRef({ transcribe, onTranscript, onError });
  useEffect(() => {
    latest.current = { transcribe, onTranscript, onError };
  });

  const go = (next: VoiceState) => {
    phase.current = next;
    setState(next);
  };
  const fail = useCallback((e: VoiceError) => {
    session.current?.cancel();
    session.current = null;
    run.current++;
    phase.current = "error";
    setState("error");
    setError(e);
    latest.current.onError?.(e);
  }, []);

  const start = async () => {
    if (phase.current !== "idle" && phase.current !== "error") return;
    const id = ++run.current;
    const live = () => run.current === id;
    setError(null);
    setTranscript({ text: "", final: true });
    setElapsed(0);
    go("requesting");
    try {
      const s = await engine({
        lang,
        onLevel: (l) => live() && levels.current.forEach((fn) => fn(l)),
        onTranscript: (text, final) => live() && setTranscript({ text, final }),
        onError: (e) => live() && fail(e),
        onEnd: async ({ text, audio }) => {
          if (!live()) return;
          session.current = null;
          let result = text;
          const { transcribe: own } = latest.current;
          if (own && audio) {
            try {
              result = await own(audio);
            } catch {
              if (live()) fail("failed");
              return;
            }
          }
          if (!live()) return;
          if (!result.trim()) return fail("no-speech");
          setTranscript({ text: result.trim(), final: true });
          go("idle");
          latest.current.onTranscript?.(result.trim());
        },
      });
      if (!live()) return s.cancel();
      session.current = s;
      go("listening");
    } catch (e) {
      if (live()) fail(typeof e === "string" ? (e as VoiceError) : "unavailable");
    }
  };

  const stop = useCallback(() => {
    if (phase.current !== "listening") return;
    phase.current = "transcribing";
    setState("transcribing");
    session.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    run.current++;
    session.current?.cancel();
    session.current = null;
    phase.current = "idle";
    setState("idle");
    setError(null);
  }, []);

  // The clock, and the ceiling on how long one take can run.
  useEffect(() => {
    if (state !== "listening") return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setElapsed(s);
      if (s >= maxDuration) stop();
    }, 200);
    return () => window.clearInterval(id);
  }, [state, maxDuration, stop]);

  // Never leave a microphone open behind an unmounted component.
  useEffect(
    () => () => {
      run.current++;
      session.current?.cancel();
    },
    [],
  );

  const subscribeLevel = useCallback((fn: (level: number) => void) => {
    levels.current.add(fn);
    return () => void levels.current.delete(fn);
  }, []);

  return {
    state,
    error,
    transcript,
    elapsed,
    start,
    stop,
    cancel,
    subscribeLevel,
  };
}

/* -------------------------------------------------------------------------------------------------
 * VoiceInput
 * -----------------------------------------------------------------------------------------------*/

export type VoiceInputProps = Omit<React.ComponentProps<"div">, "onError"> &
  UseVoiceInputOptions & {
    /** The mic button's accessible name and tooltip. */
    label?: string;
    /** Where the live transcript floats. */
    side?: "top" | "bottom";
    disabled?: boolean;
  };

const errors: Record<VoiceError, { short: string; hint: string; retry: boolean }> = {
  denied: {
    short: "Microphone blocked",
    hint: "Allow microphone access for this site in your browser’s settings, then try again.",
    retry: true,
  },
  unavailable: {
    short: "No microphone",
    hint: "Connect a microphone, or check that this page is allowed to use one.",
    retry: true,
  },
  "no-speech": {
    short: "Didn’t catch that",
    hint: "Nothing was heard. Speak a little closer to the microphone.",
    retry: true,
  },
  failed: {
    short: "Couldn’t transcribe",
    hint: "The recording didn’t turn into text. Try again in a moment.",
    retry: true,
  },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const iconButton = cn(
  "relative grid shrink-0 place-items-center rounded-full outline-none",
  "transition-[background-color,color,scale,opacity] duration-150 ease-out active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "disabled:pointer-events-none disabled:opacity-50",
  // Drawn small, touched at 44px.
  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
);

export function VoiceInput({
  engine,
  lang,
  transcribe,
  maxDuration = 120,
  onTranscript,
  onError,
  label = "Dictate",
  side = "top",
  disabled = false,
  className,
  ...rest
}: VoiceInputProps) {
  const reduce = !!useReducedMotion();
  const voice = useVoiceInput({
    engine,
    lang,
    transcribe,
    maxDuration,
    onTranscript,
    onError,
  });
  const { state, error, transcript, elapsed } = voice;
  const root = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const open = state !== "idle";
  const ending = maxDuration - elapsed <= 10;

  // Whether the last press came from a key (Enter/Space give a click with detail 0).
  const keyboard = useRef(false);
  // Room to the left of the pill's right edge, so the floating caption never runs off screen.
  const [room, setRoom] = useState<number>();
  const press = (fn: () => void) => (e: React.MouseEvent) => {
    keyboard.current = e.detail === 0;
    const r = root.current?.getBoundingClientRect();
    if (r) setRoom(Math.max(160, r.right - 28));
    fn();
  };

  // Keep focus on the control that now does the job, but only if focus was
  // already ours: the host may have moved it (e.g. into the field it filled).
  // After a pointer press it moves quietly, without a ring.
  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body && !root.current?.contains(active)) return;
    const target = state === "idle" ? micRef : state === "listening" ? doneRef : state === "error" ? retryRef : cancelRef;
    target.current?.focus({
      preventScroll: true,
      focusVisible: keyboard.current,
    } as FocusOptions);
  }, [state]);

  // Escape cancels from anywhere while the microphone is open, not only from inside the pill.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      keyboard.current = true;
      voice.cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, voice.cancel]);

  const spoken =
    state === "requesting"
      ? "Waiting for microphone access"
      : state === "listening"
        ? "Listening"
        : state === "transcribing"
          ? "Transcribing"
          : state === "error" && error
            ? errors[error].short
            : "";

  const caption =
    state === "error" && error
      ? { kind: "hint" as const, text: errors[error].hint }
      : state === "requesting"
        ? {
            kind: "hint" as const,
            text: "Allow the microphone when your browser asks.",
          }
        : (state === "listening" || state === "transcribing") && transcript.text
          ? { kind: "words" as const, text: transcript.text }
          : null;

  const enter = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" };
  const shown = { opacity: 1, scale: 1, filter: "blur(0px)" };
  const leave = reduce
    ? { opacity: 0 }
    : {
        opacity: 0,
        scale: 0.9,
        filter: "blur(2px)",
        transition: { duration: 0.1 },
      };

  return (
    <div ref={root} data-state={state} className={cn("relative inline-flex shrink-0", className)} {...rest}>
      {/* Live words float beside the pill, newest at the edge; the start fades out. */}
      <AnimatePresence>
        {caption && (
          <motion.div
            key={caption.kind}
            aria-hidden={caption.kind === "words"}
            style={room ? ({ "--room": `${room}px` } as React.CSSProperties) : undefined}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: side === "top" ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className={cn(
              "pointer-events-none absolute right-0 z-(--z-popover) w-max max-w-[min(18rem,var(--room,calc(100vw-2rem)))] rounded-xl border border-line-2 bg-raised px-3 py-2 shadow-pop",
              side === "top" ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-2 origin-top-right",
            )}
          >
            {caption.kind === "hint" ? (
              <p className="text-pretty text-[12px] leading-[1.45] text-fg-2">{caption.text}</p>
            ) : (
              <p className="flex justify-end overflow-hidden whitespace-nowrap text-[13px] leading-5 text-fg [mask-image:linear-gradient(to_right,transparent,black_28px)]">
                <span className={cn("transition-colors duration-200", !transcript.final && state === "listening" && "text-fg-2")}>{caption.text}</span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The mic button grows into the pill from where it sits; content is pinned to the right edge. */}
      <motion.div
        initial={false}
        animate={{ width: open ? "auto" : 32 }}
        transition={reduce ? { duration: 0 } : open ? spring.snappy : { duration: 0.2, ease: ease.inOut }}
        className={cn(
          "flex h-8 items-center justify-end overflow-hidden rounded-full border transition-[background-color,border-color,box-shadow] duration-200",
          open ? "border-line-2 bg-raised shadow-[var(--shadow)]" : "border-transparent",
          state === "error" && "border-danger/30",
        )}
      >
        {/* Both faces share one grid cell pinned right, so the one leaving is clipped by the shrinking pill instead of jumping. */}
        <span className="grid shrink-0 [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:justify-self-end">
          <AnimatePresence initial={false}>
            {!open ? (
              <motion.span key="mic" initial={enter} animate={shown} exit={leave} transition={reduce ? { duration: 0.12 } : spring.pop} className="flex">
                <button
                  ref={micRef}
                  type="button"
                  aria-label={label}
                  title={label}
                  disabled={disabled}
                  onClick={press(() => void voice.start())}
                  className={cn(iconButton, "group/mic size-[30px] text-fg-2 hover:bg-hover hover:text-fg")}
                >
                  <Mic className="transition-transform duration-200 ease-out group-hover/mic:-translate-y-px" />
                </button>
              </motion.span>
            ) : (
              <motion.div
                key="pill"
                role="group"
                aria-label="Voice input"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2, ease: ease.out }}
                className="flex shrink-0 items-center gap-1.5 py-0.5 pl-0.5 pr-0.5"
              >
                {state === "error" && error ? (
                  <>
                    <span className="flex items-center gap-1.5 pl-2 text-[12px] font-medium text-danger">
                      <Warning size={14} />
                      <span className="whitespace-nowrap">{errors[error].short}</span>
                    </span>
                    <button
                      ref={retryRef}
                      type="button"
                      onClick={press(() => void voice.start())}
                      className={cn(iconButton, "h-[26px] rounded-full px-2.5 text-[12px] font-medium text-fg hover:bg-hover")}
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={press(voice.cancel)}
                      className={cn(iconButton, "size-[26px] text-fg-3 hover:bg-hover hover:text-fg")}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      ref={cancelRef}
                      type="button"
                      aria-label="Cancel dictation"
                      aria-keyshortcuts="Escape"
                      onClick={press(voice.cancel)}
                      className={cn(iconButton, "size-[26px] text-fg-3 hover:bg-hover hover:text-fg")}
                    >
                      <X size={14} />
                    </button>

                    <span className="relative grid h-5 w-[108px] place-items-center">
                      <LevelBars subscribe={voice.subscribeLevel} live={state === "listening"} reduce={reduce} />
                      <AnimatePresence initial={false}>
                        {state !== "listening" && (
                          <motion.span
                            key={state}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                            transition={{
                              duration: 0.18,
                              ease: ease.out,
                              delay: reduce ? 0 : 0.1,
                            }}
                            className="absolute inset-0 grid place-items-center whitespace-nowrap text-[11.5px] text-fg-3"
                          >
                            <span className={cn(state === "requesting" && "animate-pulse-soft")}>{state === "requesting" ? "Waiting for access" : "Transcribing…"}</span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>

                    <span
                      aria-hidden
                      className={cn(
                        "tabular w-8 text-right font-mono text-[11px] transition-colors duration-200",
                        state === "listening" ? (ending ? "text-warning" : "text-fg-2") : "text-fg-4",
                      )}
                    >
                      {fmt(elapsed)}
                    </span>

                    <button
                      ref={doneRef}
                      type="button"
                      aria-label={state === "transcribing" ? "Transcribing" : "Finish dictation"}
                      aria-busy={state === "transcribing" || undefined}
                      disabled={state === "requesting"}
                      onClick={press(voice.stop)}
                      className={cn(iconButton, "size-[26px] bg-fg text-frame hover:bg-fg/90", state === "transcribing" && "pointer-events-none")}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {state === "transcribing" ? (
                          <motion.svg
                            key="spin"
                            initial={enter}
                            animate={shown}
                            exit={leave}
                            transition={reduce ? { duration: 0.12 } : spring.pop}
                            width={14}
                            height={14}
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden
                          >
                            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.6} />
                            <path
                              d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5"
                              stroke="currentColor"
                              strokeWidth={1.6}
                              strokeLinecap="round"
                              className="origin-center animate-spin-slow motion-reduce:animate-none"
                            />
                          </motion.svg>
                        ) : (
                          <motion.span key="check" initial={enter} animate={shown} exit={leave} transition={reduce ? { duration: 0.12 } : spring.pop} className="grid">
                            <Check size={14} strokeWidth={1.8} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </span>
      </motion.div>

      <span role="status" aria-live="polite" className="sr-only">
        {spoken}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * LevelBars
 * -----------------------------------------------------------------------------------------------*/

const BARS = 22;

/**
 * A short scrolling history of input level: the newest bar on the right follows
 * the voice live, and every 50ms it becomes history. Written straight to the DOM
 * on animation frames, so a loud room never re-renders React.
 */
function LevelBars({ subscribe, live, reduce }: { subscribe: (fn: (l: number) => void) => () => void; live: boolean; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = Array.from(el.children) as HTMLElement[];
    const history = new Array<number>(BARS).fill(0);
    let level = 0;
    let peak = 0;
    let last = performance.now();
    let raf = 0;
    const off = subscribe((l) => {
      level = l;
      peak = Math.max(peak, l);
    });

    const draw = (now: number) => {
      if (!live) {
        history.fill(0);
      } else if (reduce) {
        // No scrolling: every bar shows the current level, shaped like a hill, updated gently.
        if (now - last > 120) {
          last = now;
          for (let i = 0; i < BARS; i++) history[i] = peak * (0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / BARS));
          peak = level;
        }
      } else {
        if (now - last > 50) {
          last = now;
          history.shift();
          history.push(peak);
          peak = level;
        }
        history[BARS - 1] = Math.max(history[BARS - 1] * 0.85, level);
      }
      for (let i = 0; i < BARS; i++) bars[i].style.transform = `scaleY(${0.14 + Math.min(1, history[i]) * 0.86})`;
      if (live) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [subscribe, live, reduce]);

  return (
    <span ref={ref} aria-hidden className={cn("flex h-5 items-center gap-[2px] transition-opacity duration-200", !live && "opacity-0")}>
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-full w-[2.5px] rounded-full bg-fg transition-transform duration-100 ease-linear",
            // Older bars dim toward the left, so the eye reads time.
            i < 6 ? "opacity-40" : i < 12 ? "opacity-70" : "opacity-100",
            !live && "duration-300 ease-out-expo",
          )}
          style={{ transform: "scaleY(0.14)" }}
        />
      ))}
    </span>
  );
}
