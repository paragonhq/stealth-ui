"use client";
import { Slider } from "@base-ui/react/slider";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, Pause, Play } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const RATES = [1, 1.5, 2] as const;
export type PlaybackRate = (typeof RATES)[number];

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds + 0.001));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const spoken = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m} minute${m === 1 ? "" : "s"} ${s % 60} second${s % 60 === 1 ? "" : "s"}` : `${s} second${s === 1 ? "" : "s"}`;
};

/** Squeezes any number of loudness samples into `count` bars, loudest-in-bucket, scaled so the peak fills the height. */
export function resamplePeaks(peaks: number[], count: number) {
  if (!peaks.length) return Array.from({ length: count }, () => 0.12);
  const out = Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i / count) * peaks.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * peaks.length));
    let max = 0;
    for (let j = from; j < to && j < peaks.length; j++) max = Math.max(max, Math.abs(peaks[j]));
    return max;
  });
  const top = Math.max(...out, 0.001);
  return out.map((v) => Math.max(0.08, v / top));
}

/** Decodes audio and measures its loudness, for when the server didn't send peaks. */
async function measure(src: string, signal: AbortSignal) {
  const res = await fetch(src, { signal });
  const data = await res.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const audio = await ctx.decodeAudioData(data);
  const channel = audio.getChannelData(0);
  const buckets = 96;
  const size = Math.floor(channel.length / buckets) || 1;
  return Array.from({ length: buckets }, (_, i) => {
    let sum = 0;
    for (let j = i * size; j < (i + 1) * size && j < channel.length; j++) sum += channel[j] * channel[j];
    return Math.sqrt(sum / size);
  });
}

// Only one voice message plays at a time, like every messaging app: starting one pauses the rest.
let playing: HTMLAudioElement | null = null;

export type VoiceMessageProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The audio file. Without it the player waits, disabled, with its waveform drawn. */
  src?: string;
  /** Loudness samples, 0–1, any count. Without them the audio is decoded once to draw the waveform. */
  peaks?: number[];
  /** Seconds. Used until the file reports its own length (recorded WebM often never does). */
  duration?: number;
  /** Your own message: the bubble fills with the foreground color. */
  own?: boolean;
  /** Whether it has been listened to. Unplayed shows a dot beside the time. */
  played?: boolean;
  defaultPlayed?: boolean;
  onPlayedChange?: (played: boolean) => void;
  rate?: PlaybackRate;
  defaultRate?: PlaybackRate;
  onRateChange?: (rate: PlaybackRate) => void;
  /** Number of bars in the waveform. */
  bars?: number;
  /** Names the recording for screen readers: "Voice message from Maya Chen". */
  label?: string;
  /** How much to fetch before play. Metadata keeps a long thread cheap; auto suits local blobs. */
  preload?: "none" | "metadata" | "auto";
};

/**
 * A voice note in a bubble. Play fills the waveform as it goes, the time counts up, the speed
 * cycles 1× · 1.5× · 2×, and dragging or clicking the waveform seeks.
 */
export function VoiceMessage({
  src,
  peaks: peaksProp,
  duration: durationProp,
  own = false,
  played: playedProp,
  defaultPlayed = false,
  onPlayedChange,
  rate: rateProp,
  defaultRate = 1,
  onRateChange,
  bars = 36,
  label = "Voice message",
  preload = "metadata",
  className,
  ...rest
}: VoiceMessageProps) {
  const reduce = !!useReducedMotion();
  const audioRef = useRef<HTMLAudioElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useControllableState({ value: playedProp, defaultValue: defaultPlayed, onChange: onPlayedChange });
  const [rate, setRate] = useControllableState<PlaybackRate>({ value: rateProp, defaultValue: defaultRate, onChange: onRateChange });
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [measured, setMeasured] = useState<number[] | null>(null);

  const duration = fileDuration ?? durationProp ?? 0;
  const progress = duration ? Math.min(1, time / duration) : 0;
  const levels = useMemo(() => resamplePeaks(peaksProp ?? measured ?? [], bars), [peaksProp, measured, bars]);
  const drawn = !!(peaksProp ?? measured);

  /* ----- peaks: decode once when none were given ----- */
  useEffect(() => {
    if (peaksProp || !src) return;
    const abort = new AbortController();
    measure(src, abort.signal)
      .then((p) => setMeasured(p))
      .catch(() => {
        /* A flat waveform is fine; playback doesn't depend on it. */
      });
    return () => abort.abort();
  }, [src, peaksProp]);

  /* ----- the audio element's events ----- */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let raf = 0;
    const tick = () => {
      setTime(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    const onMeta = () => setFileDuration(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null);
    const onPlay = () => {
      setIsPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(raf);
      setTime(a.currentTime);
      if (playing === a) playing = null;
    };
    const onEnded = () => {
      onPause();
      // Back to the start, ready to play again, like a voice note should be.
      a.currentTime = 0;
      setTime(0);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onError = () => {
      setFailed(true);
      setWaiting(false);
    };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("canplay", onPlaying);
    a.addEventListener("error", onError);
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("canplay", onPlaying);
      a.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (failed) {
      setFailed(false);
      a.load();
    }
    if (!a.paused) return a.pause();
    if (playing && playing !== a) playing.pause();
    playing = a;
    a.playbackRate = rate;
    setPlayed(true);
    a.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFailed(true);
    });
  }, [src, failed, rate, setPlayed]);

  const seek = (seconds: number) => {
    const a = audioRef.current;
    const t = Math.max(0, Math.min(duration || 0, seconds));
    if (a) a.currentTime = t;
    setTime(t);
  };

  const cycleRate = () => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]);

  // A spinner that flashes for 80ms reads as a glitch: buffering shows only after 150ms.
  const [showWait, setShowWait] = useState(false);
  useEffect(() => {
    if (!waiting || !isPlaying) {
      const t = window.setTimeout(() => setShowWait(false), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setShowWait(true), 150);
    return () => window.clearTimeout(t);
  }, [waiting, isPlaying]);

  const state = failed ? "error" : !src ? "loading" : isPlaying ? "playing" : "paused";
  const shownTime = isPlaying || scrubbing || time > 0 ? time : duration;

  return (
    <div
      data-own={own || undefined}
      data-state={state}
      data-bubble
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex w-fit max-w-full select-none items-center gap-2.5 rounded-[20px] py-2 pl-2 pr-3",
        own ? "bg-fg text-frame" : "bg-fg/[0.07] text-fg",
        className,
      )}
      {...rest}
    >
      <audio ref={audioRef} src={src} preload={preload} className="hidden" />

      {/* Play and pause, with a ring that turns only if the audio stalls for more than 150ms. */}
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-label={failed ? "Retry playing voice message" : isPlaying ? "Pause voice message" : "Play voice message"}
        className={cn(
          "relative grid size-9 shrink-0 place-items-center rounded-full outline-none",
          "transition-[background-color,scale,opacity] duration-150 ease-out active:scale-[0.92] active:duration-75 disabled:opacity-50",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2",
          own ? "bg-frame text-fg hover:bg-frame/90 focus-visible:outline-frame/60" : "bg-fg text-frame hover:bg-fg/90 focus-visible:outline-fg-3",
          failed && (own ? "text-danger" : "bg-danger text-frame hover:bg-danger/90"),
          "before:absolute before:-inset-1 before:rounded-full before:content-[''] pointer-fine:before:hidden",
        )}
      >
        <span className="relative grid size-4 place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={failed ? "error" : isPlaying ? "pause" : "play"}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)", transition: { duration: 0.1 } }}
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {failed ? <Alert /> : isPlaying ? <Pause /> : <Play className="translate-x-px" />}
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence>
          {showWait && (
            <motion.svg
              key="wait"
              aria-hidden
              viewBox="0 0 40 40"
              className="pointer-events-none absolute -inset-1 size-[calc(100%+8px)] motion-safe:animate-spin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="30 90" className={own ? "text-frame" : "text-fg"} />
            </motion.svg>
          )}
        </AnimatePresence>
      </button>

      <div className="flex min-w-0 flex-col gap-1">
        {/* The waveform is the seek bar: click or drag anywhere on it, or use the arrow keys. */}
        <Slider.Root
          value={time}
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          largeStep={5}
          disabled={!src || !duration || failed}
          onValueChange={(v) => {
            setScrubbing(true);
            seek(v as number);
          }}
          onValueCommitted={() => setScrubbing(false)}
          className="group/wave relative"
        >
          <Slider.Control
            ref={controlRef}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--hover", `${Math.max(0, Math.min(1, (e.clientX - box.left) / box.width))}`);
            }}
            className={cn(
              "relative flex h-7 cursor-pointer touch-none items-center rounded-md outline-none",
              "data-disabled:cursor-default",
              // A keyboard focus ring around the whole waveform, since the thumb itself is a hairline.
              "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2",
              own ? "has-[:focus-visible]:outline-frame/50" : "has-[:focus-visible]:outline-fg-3",
            )}
            style={{ width: bars * 5 - 2 }}
          >
            <Waveform key={drawn ? "drawn" : "flat"} levels={levels} className="opacity-35" animateIn={drawn && !peaksProp && !reduce} />
            {/* Where the pointer is, a lighter preview of the fill, so you can aim before you click. */}
            <Waveform
              levels={levels}
              className="absolute inset-0 opacity-0 transition-opacity duration-150 pointer-fine:group-hover/wave:opacity-60 group-data-dragging/wave:opacity-0!"
              style={{ clipPath: "inset(0 calc((1 - var(--hover, 0)) * 100%) 0 0)" }}
            />
            <Waveform levels={levels} className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }} />
            <Slider.Track className="absolute inset-0" style={{ position: "absolute", inset: 0 }}>
              <Slider.Thumb
                aria-label={`Seek ${label.toLowerCase()}`}
                getAriaValueText={() => `${spoken(time)} of ${spoken(duration)}`}
                onKeyDown={(e) => {
                  // Arrows step a second at a time; Space plays and pauses without leaving the waveform.
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    seek(time + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 5 : 1));
                  } else if (e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }}
                className={cn(
                  "top-1/2 h-5 w-[3px] rounded-full outline-none",
                  own ? "bg-frame" : "bg-fg",
                  "opacity-0 transition-[opacity,scale] duration-150 ease-out",
                  "group-hover/wave:opacity-100 has-[:focus-visible]:opacity-100 data-dragging:scale-y-110 data-dragging:opacity-100",
                  "motion-reduce:transition-none",
                )}
              />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>

        <div className="flex h-5 items-center justify-between gap-3">
          <span className={cn("flex items-center gap-1.5 text-[11px] leading-4 tabular", own ? "text-frame/70" : "text-fg-3", failed && (own ? "text-frame" : "text-danger"))}>
            <span aria-hidden>{failed ? "Couldn’t play. Tap to retry" : clock(shownTime)}</span>
            <AnimatePresence initial={false}>
              {!played && !failed && (
                <motion.span
                  key="dot"
                  aria-hidden
                  className={cn("size-1.5 rounded-full", own ? "bg-frame" : "bg-fg")}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.2, transition: { duration: 0.2, ease: ease.in } }}
                />
              )}
            </AnimatePresence>
            <span className="sr-only">{`${spoken(duration)}${played ? "" : ", not played yet"}`}</span>
          </span>

          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Playback speed ${rate}×. Change speed`}
            className={cn(
              "relative grid h-5 min-w-8 place-items-center rounded-full px-1.5 text-[10.5px] font-medium leading-none tabular outline-none",
              "transition-[background-color,scale] duration-150 ease-out active:scale-[0.92] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1",
              own ? "bg-frame/15 hover:bg-frame/25 focus-visible:outline-frame/60" : "bg-fg/[0.08] hover:bg-fg/[0.14] focus-visible:outline-fg-3",
              "before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            {/* Every rate sits in one cell so the pill never changes width. */}
            <span className="grid overflow-hidden">
              {RATES.map((r) => (
                <span key={r} aria-hidden className="invisible col-start-1 row-start-1">
                  {r}×
                </span>
              ))}
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={rate}
                  aria-hidden
                  className="col-start-1 row-start-1 text-center"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.1 } }}
                  transition={reduce ? { duration: 0.12 } : spring.snappy}
                >
                  {rate}×
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Waveform({ levels, className, style, animateIn = false }: { levels: number[]; className?: string; style?: React.CSSProperties; animateIn?: boolean }) {
  return (
    <span aria-hidden className={cn("pointer-events-none flex h-full w-full items-center gap-[2px]", className)} style={style}>
      {levels.map((l, i) => (
        <motion.span
          key={i}
          className="w-[3px] shrink-0 rounded-full bg-current"
          style={{ height: `${Math.round(4 + l * 20)}px` }}
          // When peaks arrive after decoding, the bars grow into place from a flat line, left to right.
          initial={animateIn ? { scaleY: 0.25 } : false}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.24, ease: ease.out, delay: animateIn ? Math.min(i, 30) * 0.008 : 0 }}
        />
      ))}
    </span>
  );
}
