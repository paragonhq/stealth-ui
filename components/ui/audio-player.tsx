"use client";
import { Slider } from "@base-ui/react/slider";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

/* ------------------------------------------------------------------ waveform data */

/**
 * Decodes audio and returns `count` loudness values between 0 and 1 (RMS per slice,
 * normalized to the 95th percentile so one spike doesn't flatten everything else).
 * Do this once on the server or at upload and store the numbers; this runs in the
 * browser too, for recordings that have none yet. Remote files need CORS.
 */
export async function computePeaks(source: string | Blob | ArrayBuffer, count = 64, signal?: AbortSignal): Promise<number[]> {
  const buffer =
    source instanceof ArrayBuffer ? source : source instanceof Blob ? await source.arrayBuffer() : await (await fetch(source, { signal })).arrayBuffer();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  // An offline context decodes without asking for the speakers.
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const audio = await ctx.decodeAudioData(buffer);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  const size = Math.max(1, Math.floor(audio.length / count));
  const rms: number[] = [];
  for (let b = 0; b < count; b++) {
    let sum = 0;
    const start = b * size;
    const end = Math.min(audio.length, start + size);
    for (let i = start; i < end; i++) {
      let s = 0;
      for (const ch of channels) s += ch[i];
      s /= channels.length;
      sum += s * s;
    }
    rms.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(0.95 * (sorted.length - 1))] || 1;
  return rms.map((v) => Math.min(1, Math.round((v / ref) * 100) / 100));
}

/** Fit any number of peaks to `count` bars: the loudest value wins when shrinking, neighbors blend when growing. */
function resample(peaks: number[], count: number) {
  if (!peaks.length) return Array.from({ length: count }, () => 0);
  if (peaks.length === count) return peaks;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (peaks.length > count) {
      const a = Math.floor((i * peaks.length) / count);
      const b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / count));
      out.push(Math.max(...peaks.slice(a, b)));
    } else {
      const x = (i * (peaks.length - 1)) / Math.max(1, count - 1);
      const lo = Math.floor(x);
      const hi = Math.min(peaks.length - 1, lo + 1);
      out.push(peaks[lo] + (peaks[hi] - peaks[lo]) * (x - lo));
    }
  }
  return out;
}

type PeaksStatus = "ready" | "loading" | "unavailable";

// One decode per file per page, however many players (or effect re-runs) ask for it.
const decodes = new Map<string, Promise<number[]>>();
const decodeOnce = (src: string) => {
  let p = decodes.get(src);
  if (!p) {
    p = computePeaks(src, 128);
    decodes.set(src, p);
    p.catch(() => decodes.delete(src));
  }
  return p;
};

/** Peaks you pass win; otherwise they're decoded from `src` once and shared. */
export function useWaveform(src: string, peaks: number[] | undefined, count: number) {
  const [decoded, setDecoded] = useState<{ src: string; peaks: number[] | null } | null>(null);
  useEffect(() => {
    if (peaks) return;
    let live = true;
    decodeOnce(src).then(
      (p) => live && setDecoded({ src, peaks: p }),
      () => live && setDecoded({ src, peaks: null }),
    );
    return () => {
      live = false;
    };
  }, [src, peaks]);

  const mine = decoded?.src === src ? decoded : null;
  const status: PeaksStatus = peaks ? "ready" : !mine ? "loading" : mine.peaks ? "ready" : "unavailable";
  const values = useMemo(() => {
    if (peaks) return resample(peaks, count);
    if (mine?.peaks) return resample(mine.peaks, count);
    // No data: a quiet, even line that still reads as "audio".
    return Array.from({ length: count }, (_, i) => 0.22 + 0.08 * Math.sin(i * 1.7));
  }, [peaks, mine, count]);
  return { peaks: values, status, animateIn: !peaks && status === "ready" };
}

/* ------------------------------------------------------------------ media state */

const noop = () => {};

function useMediaValue<T extends string | number | boolean>(el: HTMLMediaElement | null, events: string, read: (el: HTMLMediaElement) => T, fallback: T): T {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!el) return noop;
      const list = events.split(" ");
      list.forEach((e) => el.addEventListener(e, cb));
      return () => list.forEach((e) => el.removeEventListener(e, cb));
    },
    [el, events],
  );
  return useSyncExternalStore(subscribe, () => (el ? read(el) : fallback), () => fallback);
}

/** currentTime every frame while playing, so the fill glides through each bar instead of jumping. */
function useSmoothTime(el: HTMLMediaElement | null) {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!el) return noop;
      let raf = 0;
      const loop = () => {
        cb();
        raf = requestAnimationFrame(loop);
      };
      const sync = () => {
        cancelAnimationFrame(raf);
        cb();
        if (!el.paused && !el.ended) raf = requestAnimationFrame(loop);
      };
      const events = ["play", "playing", "pause", "ended", "seeked", "timeupdate", "emptied"];
      events.forEach((e) => el.addEventListener(e, sync));
      sync();
      return () => {
        cancelAnimationFrame(raf);
        events.forEach((e) => el.removeEventListener(e, sync));
      };
    },
    [el],
  );
  return useSyncExternalStore(subscribe, () => el?.currentTime ?? 0, () => 0);
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function speakTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m} minute${m === 1 ? "" : "s"} ${s % 60} second${s % 60 === 1 ? "" : "s"}` : `${s} second${s === 1 ? "" : "s"}`;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

// Only one player speaks at a time: starting one pauses the rest on the page.
const PLAY_EVENT = "stealth-audio-play";

/* ------------------------------------------------------------------ component */

export type AudioPlayerProps = Omit<React.ComponentProps<"div">, "children"> & {
  src: string;
  /** Loudness per slice, 0–1, any length. Computed from `src` when missing (needs CORS). */
  peaks?: number[];
  /** Number of bars drawn. */
  bars?: number;
  /** Known length in seconds, shown before the file's metadata arrives. */
  duration?: number;
  /** Accessible name, e.g. "Voice message from Maya". */
  label?: string;
  /** Speeds the chip cycles through. Pass one value to hide the chip. */
  rates?: number[];
  /** Pause every other player on the page when this one starts. */
  exclusive?: boolean;
  /** `soft` quiets the play button when something else on the row is the primary action (a Send button). */
  playStyle?: "solid" | "soft";
  /** `card` brings its own surface; `bare` sits inside yours (a chat bubble, a row). */
  variant?: "card" | "bare";
  preload?: "none" | "metadata" | "auto";
  onEnded?: () => void;
  audioRef?: React.Ref<HTMLAudioElement>;
};

export function AudioPlayer({
  src,
  peaks: peaksProp,
  bars = 48,
  duration: durationProp,
  label = "Audio",
  rates = [1, 1.5, 2],
  exclusive = true,
  variant = "card",
  playStyle = "solid",
  preload = "metadata",
  onEnded,
  audioRef,
  className,
  ...rest
}: AudioPlayerProps) {
  const reduce = !!useReducedMotion();
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const media = useRef<HTMLAudioElement | null>(null);
  const attach = useCallback(
    (el: HTMLAudioElement | null) => {
      media.current = el;
      setAudio(el);
      assignRef(audioRef, el);
    },
    [audioRef],
  );

  const paused = useMediaValue(audio, "play pause ended emptied", (a) => a.paused, true);
  const metaDuration = useMediaValue(audio, "loadedmetadata durationchange emptied", (a) => (Number.isFinite(a.duration) ? a.duration : 0), 0);
  const rate = useMediaValue(audio, "ratechange", (a) => a.playbackRate, 1);
  const networkWaiting = useMediaValue(audio, "play waiting playing canplay pause seeked emptied error", (a) => !a.paused && a.readyState < 3, false);
  const time = useSmoothTime(audio);
  const duration = metaDuration || durationProp || 0;

  // Bars keep a 2px width and at least ~2.5px of air: a narrow player draws fewer, never a solid block.
  const [fit, setFit] = useState(bars);
  const waveRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFit(Math.max(12, Math.min(bars, Math.floor(entry.contentRect.width / 4.5)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bars]);
  const { peaks, status, animateIn } = useWaveform(src, peaksProp, fit);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  // A seek before the file has loaded is remembered by the element but fires no events; show it anyway.
  const [pending, setPending] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [rewinding, setRewinding] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const rewindTimer = useRef<number>(undefined);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  });

  useEffect(() => {
    const t = window.setTimeout(() => setWaiting(networkWaiting), networkWaiting ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [networkWaiting]);

  useEffect(() => {
    const el = media.current;
    if (!el) return;
    const onError = () => setFailed(true);
    const onPlay = () => {
      setStarted(true);
      if (exclusive) window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: el }));
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== el && !el.paused) el.pause();
    };
    const onEnd = () => {
      // A finished message rewinds to the start, so the next press plays it again.
      window.clearTimeout(rewindTimer.current);
      setRewinding(true);
      el.currentTime = 0;
      rewindTimer.current = window.setTimeout(() => setRewinding(false), 420);
      onEndedRef.current?.();
    };
    el.addEventListener("error", onError);
    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onEnd);
    const clearPending = () => setPending(null);
    el.addEventListener("seeked", clearPending);
    el.addEventListener("emptied", clearPending);
    window.addEventListener(PLAY_EVENT, onOther);
    if (el.error) onError();
    return () => {
      el.removeEventListener("error", onError);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("seeked", clearPending);
      el.removeEventListener("emptied", clearPending);
      window.removeEventListener(PLAY_EVENT, onOther);
    };
  }, [exclusive]);

  useEffect(() => () => window.clearTimeout(rewindTimer.current), []);

  const toggle = useCallback(() => {
    const el = media.current;
    if (!el) return;
    if (el.paused) el.play().catch(noop);
    else el.pause();
  }, []);

  const retry = useCallback(() => {
    const el = media.current;
    if (!el) return;
    setFailed(false);
    el.load();
  }, []);

  const cycleRate = useCallback(() => {
    const el = media.current;
    if (!el) return;
    const i = rates.indexOf(el.playbackRate);
    el.playbackRate = rates[(i + 1) % rates.length] ?? 1;
  }, [rates]);

  const seek = (el: HTMLAudioElement, t: number) => {
    el.currentTime = t;
    if (el.readyState === 0) setPending(t);
  };

  const shownTime = drag ?? (hover !== null ? hover : null);
  const now = pending ?? time;
  const progress = duration ? Math.min(1, (drag ?? now) / duration) : 0;
  const readout = shownTime !== null ? shownTime : started || now > 0 ? now : duration;

  return (
    <div
      role="group"
      aria-label={label}
      data-state={failed ? "error" : paused ? "paused" : "playing"}
      data-variant={variant}
      className={cn(
        "flex min-w-0 items-center gap-3",
        variant === "card" && "rounded-xl border border-line bg-raised py-2 pl-2 pr-3 shadow-[var(--shadow)]",
        className,
      )}
      {...rest}
    >
      <audio ref={attach} src={src} preload={preload} />

      <PlayButton soft={playStyle === "soft"} paused={paused} failed={failed} waiting={waiting && !failed} reduce={reduce} onToggle={toggle} onRetry={retry} label={label} />

      <div ref={waveRef} className="relative h-8 min-w-0 flex-1">
        {failed ? (
          <p role="alert" className="flex h-full items-center truncate text-[12.5px] text-danger">
            Couldn’t load this recording
          </p>
        ) : (
          <Slider.Root
            value={duration ? Math.min(drag ?? now, duration) : 0}
            min={0}
            max={duration || 1}
            step={0.01}
            disabled={!duration}
            onValueChange={(v, details) => {
              const el = media.current;
              if (!el || !duration) return;
              if (details.reason === "keyboard") {
                details.cancel();
                const key = (details.event as KeyboardEvent).key;
                const jump = key === "PageUp" || key === "PageDown" ? 15 : 5;
                const dir = key === "ArrowRight" || key === "ArrowUp" || key === "PageUp" ? 1 : key === "Home" ? -Infinity : key === "End" ? Infinity : -1;
                seek(el, Math.min(duration - 0.05, Math.max(0, (pending ?? el.currentTime) + dir * jump)));
                return;
              }
              setDrag(v);
            }}
            onValueCommitted={(v, details) => {
              const el = media.current;
              if (!el || details.reason === "keyboard") return;
              seek(el, Math.min(v, duration - 0.05));
              setDrag(null);
            }}
            className="group/wave h-full"
          >
            <Slider.Control
              onPointerMove={(e) => {
                if (e.pointerType !== "mouse" || !duration) return;
                const r = e.currentTarget.getBoundingClientRect();
                setHover(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
              }}
              onPointerLeave={() => setHover(null)}
              className={cn(
                "relative h-full w-full cursor-pointer touch-none rounded-md data-disabled:cursor-default",
                "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-3",
              )}
            >
              <Slider.Track className="absolute inset-0 h-full w-full">
                <Bars peaks={peaks} tone="rest" animateIn={animateIn && !reduce} dim={status === "loading"} />
                {hover !== null && drag === null && (
                  <div aria-hidden className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - (hover / (duration || 1)) * 100}% 0 0)` }}>
                    <Bars peaks={peaks} tone="hover" />
                  </div>
                )}
                <div
                  aria-hidden
                  className={cn("absolute inset-0", rewinding && "transition-[clip-path] duration-[400ms] ease-in-out-quart motion-reduce:transition-none")}
                  style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }}
                >
                  <Bars peaks={peaks} tone="played" />
                </div>
                <Slider.Thumb
                  aria-label={`Seek ${label}`}
                  getAriaValueText={(_, v) => `${speakTime(v)} of ${speakTime(duration)}`}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "k") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle();
                    }
                  }}
                  // The playhead: only drawn while it's being moved or focused, otherwise the fill edge says it all.
                  className="h-full w-0.5 rounded-full bg-fg opacity-0 transition-opacity duration-150 data-dragging:opacity-100 has-[:focus-visible]:opacity-100"
                />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        )}
      </div>

      <span className={cn("tabular grid shrink-0 text-right font-mono text-[11.5px] transition-colors duration-150", shownTime !== null ? "text-fg" : "text-fg-2")}>
        {/* Reserve the widest value so nothing shifts as the digits change. */}
        <span aria-hidden className="invisible col-start-1 row-start-1">{formatTime(duration).replace(/\d/g, "0")}</span>
        <span className="col-start-1 row-start-1" aria-hidden>{formatTime(readout)}</span>
        <span className="sr-only">{duration ? `${formatTime(time)} of ${formatTime(duration)}` : ""}</span>
      </span>

      {rates.length > 1 && <RateChip rate={rate} rates={rates} reduce={reduce} disabled={failed} onPress={cycleRate} />}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

const Bars = memo(function Bars({ peaks, tone, animateIn = false, dim = false }: { peaks: number[]; tone: "rest" | "hover" | "played"; animateIn?: boolean; dim?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-between" aria-hidden>
      {peaks.map((p, i) => (
        <motion.span
          key={i}
          className={cn(
            "w-[2px] shrink-0 rounded-full transition-[background-color,opacity] duration-200",
            tone === "played" ? "bg-fg" : tone === "hover" ? "bg-fg/45" : "bg-fg/20",
            dim && "opacity-60",
          )}
          style={{ height: `${Math.max(10, Math.round(p * 100))}%`, originY: 0.5 }}
          // Freshly decoded bars rise from the center line in a quick left-to-right sweep, once.
          initial={animateIn ? { scaleY: 0.15 } : false}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.32, ease: ease.out, delay: animateIn ? i * 0.006 : 0 }}
        />
      ))}
    </div>
  );
});

const PLAY_L = "M4.6 2.9L8.6 5.3L8.6 10.7L4.6 13.1Z";
const PLAY_R = "M8.6 5.3L12.9 8L12.9 8L8.6 10.7Z";
const PAUSE_L = "M4 3L7 3L7 13L4 13Z";
const PAUSE_R = "M9 3L12 3L12 13L9 13Z";

function PlayButton({
  soft,
  paused,
  failed,
  waiting,
  reduce,
  onToggle,
  onRetry,
  label,
}: {
  paused: boolean;
  failed: boolean;
  waiting: boolean;
  reduce: boolean;
  onToggle: () => void;
  onRetry: () => void;
  label: string;
  soft: boolean;
}) {
  const t = reduce ? { duration: 0 } : { duration: 0.2, ease: ease.inOut };
  return (
    <button
      type="button"
      onClick={failed ? onRetry : onToggle}
      aria-label={failed ? `Retry loading ${label}` : paused ? `Play ${label}` : `Pause ${label}`}
      aria-busy={waiting || undefined}
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-full outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out-quart active:scale-[0.92] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
        failed ? "bg-danger-soft text-danger" : soft ? "bg-fg/10 text-fg hover:bg-fg/15" : "bg-fg text-frame hover:bg-fg/90",
      )}
    >
      {failed ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" aria-hidden>
          <motion.path initial={false} animate={{ d: paused ? PLAY_L : PAUSE_L }} transition={t} />
          <motion.path initial={false} animate={{ d: paused ? PLAY_R : PAUSE_R }} transition={t} />
        </svg>
      )}
      {/* Buffering: an arc runs round the button instead of replacing the icon. */}
      <AnimatePresence>
        {waiting && (
          <motion.svg
            key="ring"
            aria-hidden
            viewBox="0 0 40 40"
            className="pointer-events-none absolute -inset-1 size-10 animate-spin text-fg [animation-duration:0.9s]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="28 200" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

function RateChip({ rate, rates, reduce, disabled, onPress }: { rate: number; rates: number[]; reduce: boolean; disabled: boolean; onPress: () => void }) {
  const next = rates[(rates.indexOf(rate) + 1) % rates.length] ?? 1;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={`Playback speed ${rate}×, switch to ${next}×`}
      className={cn(
        "relative grid h-6 shrink-0 place-items-center overflow-hidden rounded-md border border-line-2 px-1.5 font-mono text-[11px] tabular text-fg-2 outline-none",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart hover:border-fg-4 hover:text-fg active:scale-[0.94] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50",
        "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
        rate !== 1 && "border-fg-4 text-fg",
      )}
    >
      {rates.map((r) => (
        <span key={r} aria-hidden className="invisible col-start-1 row-start-1">{`${r}×`}</span>
      ))}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={rate}
          className="col-start-1 row-start-1"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
        >
          {`${rate}×`}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
