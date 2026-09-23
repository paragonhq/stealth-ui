"use client";
import { Menu } from "@base-ui/react/menu";
import { Slider } from "@base-ui/react/slider";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ media state */

const noop = () => {};
const never = () => noop;

/** Reads one property of a media element and re-reads it when any of `events` fire. */
function useMediaValue<T extends string | number | boolean>(el: HTMLMediaElement | null, events: readonly string[], read: (el: HTMLMediaElement) => T, fallback: T): T {
  const key = events.join(" ");
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!el) return noop;
      const list = key.split(" ");
      list.forEach((e) => el.addEventListener(e, cb));
      return () => list.forEach((e) => el.removeEventListener(e, cb));
    },
    [el, key],
  );
  return useSyncExternalStore(subscribe, () => (el ? read(el) : fallback), () => fallback);
}

const PLAY_EVENTS = ["play", "pause", "ended", "emptied"] as const;
const TIME_EVENTS = ["timeupdate", "seeking", "seeked", "durationchange", "emptied"] as const;
const DURATION_EVENTS = ["loadedmetadata", "durationchange", "emptied"] as const;
const VOLUME_EVENTS = ["volumechange"] as const;
const RATE_EVENTS = ["ratechange"] as const;
const BUFFER_EVENTS = ["progress", "loadedmetadata", "seeked", "emptied"] as const;
const WAIT_EVENTS = ["waiting", "playing", "canplay", "pause", "seeked", "emptied", "error"] as const;

/** currentTime, re-read every frame while playing and `live`, so the scrubber glides instead of stepping at 4Hz. */
function useSmoothTime(el: HTMLMediaElement | null, live: boolean) {
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
        if (live && !el.paused && !el.ended) raf = requestAnimationFrame(loop);
      };
      const events = ["play", "playing", "pause", "ended", "seeked", "seeking", "timeupdate", "durationchange", "emptied"];
      events.forEach((e) => el.addEventListener(e, sync));
      sync();
      return () => {
        cancelAnimationFrame(raf);
        events.forEach((e) => el.removeEventListener(e, sync));
      };
    },
    [el, live],
  );
  return useSyncExternalStore(subscribe, () => el?.currentTime ?? 0, () => 0);
}

const readBuffered = (el: HTMLMediaElement) => {
  let out = "";
  for (let i = 0; i < el.buffered.length; i++) out += `${out ? "," : ""}${el.buffered.start(i).toFixed(2)}-${el.buffered.end(i).toFixed(2)}`;
  return out;
};

const readDuration = (el: HTMLMediaElement) => (Number.isFinite(el.duration) ? el.duration : 0);

/** 72 → "1:12", 3725 → "1:02:05". Negative values get a leading minus for "time remaining". */
export function formatTime(seconds: number, reference = seconds) {
  const sign = seconds < 0 ? "-" : "";
  const s = Math.floor(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return Math.abs(reference) >= 3600 ? `${sign}${h}:${String(m).padStart(2, "0")}:${ss}` : `${sign}${m}:${ss}`;
}

/** Spoken form for screen readers: "1 minute 12 seconds". */
function speakTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [h && `${h} hour${h === 1 ? "" : "s"}`, m && `${m} minute${m === 1 ? "" : "s"}`, `${s % 60} second${s % 60 === 1 ? "" : "s"}`];
  return parts.filter(Boolean).join(" ");
}

const subscribeFullscreen = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};
const canPip = () => typeof document !== "undefined" && !!document.pictureInPictureEnabled;

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/* ------------------------------------------------------------------ types */

export type VideoTrack = {
  src: string;
  /** BCP 47 code, e.g. "en". */
  srcLang: string;
  label: string;
  default?: boolean;
};

export type VideoChapter = { start: number; title: string };

type Bezel = { id: number; icon: React.ReactNode; label?: string; side?: "left" | "right" | "center" };

export type VideoPlayerProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  src: string;
  poster?: string;
  /** Names the player for assistive tech, and shows over the poster before playback. */
  title?: string;
  /** Subtitle tracks (WebVTT). Rendered by the player, above the controls, not by the browser. */
  tracks?: VideoTrack[];
  /** Chapter starts in seconds. The scrubber splits at each one and the hover time names it. */
  chapters?: VideoChapter[];
  /** Length in seconds if you already know it, shown until the file's metadata arrives (useful with preload="none"). */
  duration?: number;
  /** Width / height. Reserved before metadata so nothing jumps. */
  aspectRatio?: number;
  /** Milliseconds of stillness before the controls hide during playback. */
  autoHideDelay?: number;
  playbackRates?: number[];
  defaultPlaybackRate?: number;
  defaultVolume?: number;
  defaultMuted?: boolean;
  /** Keep the subtitles on from the start when a track exists. */
  defaultCaptions?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  /** Anything else for the underlying <video>: crossOrigin, onEnded, onTimeUpdate… */
  videoProps?: Omit<React.ComponentProps<"video">, "src" | "poster" | "controls" | "ref">;
  videoRef?: React.Ref<HTMLVideoElement>;
};

/* ------------------------------------------------------------------ player */

export function VideoPlayer({
  src,
  poster,
  title,
  tracks = [],
  chapters,
  duration: durationProp,
  aspectRatio = 16 / 9,
  autoHideDelay = 2500,
  playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2],
  defaultPlaybackRate = 1,
  defaultVolume = 1,
  defaultMuted = false,
  defaultCaptions = false,
  loop,
  preload = "metadata",
  videoProps,
  videoRef,
  className,
  style,
  onKeyDown,
  ...rest
}: VideoPlayerProps) {
  const reduce = !!useReducedMotion();
  // The element lives twice: in state so subscriptions re-bind when it mounts, and in a
  // ref so event handlers can command it (play, seek, volume) without mutating render state.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const media = useRef<HTMLVideoElement | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);

  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      media.current = el;
      setVideo(el);
      assignRef(videoRef, el);
    },
    [videoRef],
  );

  const paused = useMediaValue(video, PLAY_EVENTS, (v) => v.paused, true);
  const ended = useMediaValue(video, PLAY_EVENTS, (v) => v.ended, false);
  const duration = useMediaValue(video, DURATION_EVENTS, readDuration, 0) || durationProp || 0;
  const volume = useMediaValue(video, VOLUME_EVENTS, (v) => v.volume, defaultVolume);
  const muted = useMediaValue(video, VOLUME_EVENTS, (v) => v.muted, defaultMuted);
  const rate = useMediaValue(video, RATE_EVENTS, (v) => v.playbackRate, defaultPlaybackRate);
  const networkWaiting = useMediaValue(video, WAIT_EVENTS, (v) => !v.paused && v.readyState < 3, false);
  const fullscreen = useSyncExternalStore(subscribeFullscreen, () => !!root && document.fullscreenElement === root, () => false);
  const pipSupported = useSyncExternalStore(never, canPip, () => false);

  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [keyboardInside, setKeyboardInside] = useState(false);
  const [remaining, setRemaining] = useState(false);
  const [captions, setCaptions] = useState(defaultCaptions);
  const [trackIndex, setTrackIndex] = useState(() => Math.max(0, tracks.findIndex((t) => t.default)));
  const [cue, setCue] = useState<string[]>([]);
  const [bezel, setBezel] = useState<Bezel | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [waiting, setWaiting] = useState(false);

  const idleTimer = useRef<number>(undefined);
  const bezelTimer = useRef<number>(undefined);
  const lastTap = useRef<{ t: number; x: number }>({ t: 0, x: 0 });
  const tapTimer = useRef<number>(undefined);
  const bezelId = useRef(0);

  const controlsVisible = !started || paused || ended || failed || active || menuOpen || scrubbing || keyboardInside;

  // Initial media settings, applied once the element exists.
  useEffect(() => {
    const v = media.current;
    if (!v) return;
    v.volume = defaultVolume;
    v.muted = defaultMuted;
    v.playbackRate = defaultPlaybackRate;
    v.defaultPlaybackRate = defaultPlaybackRate;
    // Only for the first element; later prop changes are the user's to make through the controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The browser only flags "waiting" briefly on a fast network; hold the spinner back
  // 250ms so a quick seek never flashes it.
  useEffect(() => {
    if (!networkWaiting) {
      const t = window.setTimeout(() => setWaiting(false), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setWaiting(true), 250);
    return () => window.clearTimeout(t);
  }, [networkWaiting]);

  useEffect(() => {
    const video = media.current;
    if (!video) return;
    const onPlay = () => {
      setStarted(true);
      setFailed(false);
    };
    const onError = () => setFailed(true);
    const onEmptied = () => setStarted(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("error", onError);
    video.addEventListener("emptied", onEmptied);
    // An error that happened before hydration never fires again.
    if (video.error) onError();
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("error", onError);
      video.removeEventListener("emptied", onEmptied);
    };
  }, []);

  // Subtitles: the browser loads cues ("hidden" mode) and we draw them, so they can
  // sit above the controls and move with them instead of hiding underneath.
  useEffect(() => {
    const video = media.current;
    if (!video) return;
    const list = video.textTracks;
    const bind = () => {
      const handlers: Array<() => void> = [];
      for (let i = 0; i < list.length; i++) {
        const track = list[i];
        track.mode = "hidden";
        if (i !== trackIndex) continue;
        const read = () => {
          const lines: string[] = [];
          const activeCues = track.activeCues;
          if (activeCues) for (let c = 0; c < activeCues.length; c++) lines.push(...((activeCues[c] as VTTCue).text ?? "").replace(/<[^>]+>/g, "").split("\n"));
          setCue(lines);
        };
        track.addEventListener("cuechange", read);
        read();
        handlers.push(() => track.removeEventListener("cuechange", read));
      }
      return () => handlers.forEach((h) => h());
    };
    let unbind = bind();
    const rebind = () => {
      unbind();
      unbind = bind();
    };
    list.addEventListener("addtrack", rebind);
    return () => {
      unbind();
      list.removeEventListener("addtrack", rebind);
    };
  }, [video, trackIndex, tracks.length]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(bezelTimer.current);
      window.clearTimeout(tapTimer.current);
    },
    [],
  );

  /* ---------------------------------------------------------------- actions */

  const wake = useCallback(() => {
    setActive(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(false), autoHideDelay);
  }, [autoHideDelay]);

  const flash = useCallback((b: Omit<Bezel, "id">) => {
    window.clearTimeout(bezelTimer.current);
    setBezel({ ...b, id: ++bezelId.current });
    bezelTimer.current = window.setTimeout(() => setBezel(null), 650);
  }, []);

  const say = useCallback((text: string) => {
    // Re-announcing the same words needs the text to change, so toggle a trailing space.
    setAnnouncement((prev) => (prev === text ? `${text} ` : text));
  }, []);

  const togglePlay = useCallback(() => {
    const video = media.current;
    if (!video) return;
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      video.play().catch(() => {
        // Autoplay policy or a decode failure. The error event covers the second; the first needs no noise.
      });
    } else video.pause();
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const video = media.current;
      if (!video || !duration) return;
      video.currentTime = Math.min(duration, Math.max(0, video.currentTime + delta));
    },
    [duration],
  );

  const setVol = useCallback(
    (v: number) => {
      const video = media.current;
      if (!video) return;
      const next = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
      video.volume = next;
      video.muted = next === 0;
    },
    [],
  );

  const toggleMute = useCallback(() => {
    const video = media.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 0.5;
    } else video.muted = true;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = media.current;
    if (!root || !video) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(noop);
    else if (root.requestFullscreen) root.requestFullscreen().catch(noop);
    // iOS Safari only lets the <video> itself go full screen.
    else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.();
  }, [root]);

  const togglePip = useCallback(() => {
    const video = media.current;
    if (!video) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(noop);
    else video.requestPictureInPicture().catch(noop);
  }, []);

  const setRate = useCallback(
    (r: number) => {
      if (media.current) media.current.playbackRate = r;
    },
    [],
  );

  const retry = useCallback(() => {
    const video = media.current;
    if (!video) return;
    setFailed(false);
    video.load();
  }, []);

  /* ---------------------------------------------------------------- keyboard */

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    const video = media.current;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !video) return;
    const target = e.target as HTMLElement;
    // Menus own their keys; sliders own their arrows; buttons own Space and Enter.
    if (target.closest("[role=menu]")) return;
    const onSlider = target instanceof HTMLInputElement && target.type === "range";
    const onButton = target.tagName === "BUTTON";
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = (fn: () => void) => {
      // A focused player owns the keys it handles: page-level shortcuts must not also fire.
      e.preventDefault();
      e.stopPropagation();
      wake();
      fn();
    };
    switch (key) {
      case " ":
        if (onButton) return;
        return act(() => {
          togglePlay();
          flash({ icon: <PlayGlyph paused={!video.paused} /> });
        });
      case "k":
        return act(() => {
          togglePlay();
          flash({ icon: <PlayGlyph paused={!video.paused} /> });
        });
      case "j":
      case "l": {
        const d = key === "j" ? -10 : 10;
        return act(() => {
          seekBy(d);
          flash({ icon: <SeekGlyph dir={d < 0 ? -1 : 1} />, label: `${d > 0 ? "+" : "−"}10s`, side: d < 0 ? "left" : "right" });
        });
      }
      case "ArrowLeft":
      case "ArrowRight": {
        if (onSlider) return;
        const d = key === "ArrowLeft" ? -5 : 5;
        return act(() => {
          seekBy(d);
          flash({ icon: <SeekGlyph dir={d < 0 ? -1 : 1} />, label: `${d > 0 ? "+" : "−"}5s`, side: d < 0 ? "left" : "right" });
        });
      }
      case "ArrowUp":
      case "ArrowDown": {
        if (onSlider) return;
        return act(() => {
          const next = Math.min(1, Math.max(0, (video.muted ? 0 : video.volume) + (key === "ArrowUp" ? 0.1 : -0.1)));
          setVol(next);
          flash({ icon: <VolumeGlyph level={next} muted={next === 0} />, label: `${Math.round(next * 100)}%` });
        });
      }
      case "m":
        return act(() => {
          const willMute = !(video.muted || video.volume === 0);
          toggleMute();
          flash({ icon: <VolumeGlyph level={willMute ? 0 : video.volume} muted={willMute} />, label: willMute ? "Muted" : `${Math.round(video.volume * 100)}%` });
          say(willMute ? "Muted" : "Unmuted");
        });
      case "f":
        return act(toggleFullscreen);
      case "c":
        if (!tracks.length) return;
        return act(() => {
          setCaptions(!captions);
          flash({ icon: <CaptionsGlyph />, label: captions ? "Subtitles off" : "Subtitles on" });
          say(captions ? "Subtitles off" : `Subtitles on, ${tracks[trackIndex]?.label ?? ""}`);
        });
      case "<":
      case ">": {
        const i = playbackRates.indexOf(rate);
        const next = playbackRates[Math.min(playbackRates.length - 1, Math.max(0, (i < 0 ? playbackRates.indexOf(1) : i) + (key === ">" ? 1 : -1)))];
        if (next === undefined) return;
        return act(() => {
          setRate(next);
          flash({ icon: <SpeedGlyph />, label: `${formatRate(next)}` });
          say(`Speed ${formatRate(next)}`);
        });
      }
      case "Home":
      case "End":
        if (onSlider) return;
        return act(() => {
          video.currentTime = key === "Home" ? 0 : duration;
        });
      default:
        if (/^[0-9]$/.test(key) && duration) return act(() => (video.currentTime = (Number(key) / 10) * duration));
    }
  };

  /* ---------------------------------------------------------------- pointer on the picture */

  const onSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || failed) return;
    if (e.pointerType === "mouse") return; // mouse uses click / double-click below
    // Touch: one tap shows or hides the controls; two quick taps on a side seek 10s.
    const now = performance.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const double = now - lastTap.current.t < 300 && Math.abs(x - lastTap.current.x) < 0.2;
    lastTap.current = { t: now, x };
    window.clearTimeout(tapTimer.current);
    if (double && started && (x < 0.35 || x > 0.65)) {
      const d = x < 0.35 ? -10 : 10;
      seekBy(d);
      flash({ icon: <SeekGlyph dir={d < 0 ? -1 : 1} />, label: `${d > 0 ? "+" : "−"}10s`, side: d < 0 ? "left" : "right" });
      lastTap.current = { t: now, x }; // allow triple-tap to keep seeking
      return;
    }
    if (!started) return togglePlay();
    tapTimer.current = window.setTimeout(() => {
      if (controlsVisible && !paused) {
        window.clearTimeout(idleTimer.current);
        setActive(false);
      } else wake();
    }, 180);
  };

  const onSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (failed || (e.nativeEvent as PointerEvent).pointerType === "touch") return;
    togglePlay();
    if (started) flash({ icon: <PlayGlyph paused={paused} /> });
  };

  const trackCount = tracks.length;
  const currentTrack = tracks[trackIndex];
  const showCaption = captions && trackCount > 0 && cue.length > 0;

  return (
    <Tooltip.Provider delay={500} closeDelay={0}>
      <div
        ref={setRoot}
        role="region"
        aria-label={title ?? "Video player"}
        tabIndex={0}
        data-state={failed ? "error" : !started ? "idle" : ended ? "ended" : paused ? "paused" : "playing"}
        data-controls={controlsVisible ? "visible" : "hidden"}
        data-fullscreen={fullscreen ? "" : undefined}
        onKeyDown={handleKey}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") wake();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse" || scrubbing) return;
          window.clearTimeout(idleTimer.current);
          idleTimer.current = window.setTimeout(() => setActive(false), 300);
        }}
        onFocus={(e) => {
          if (e.target !== e.currentTarget && e.target.matches(":focus-visible")) setKeyboardInside(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setKeyboardInside(false);
        }}
        className={cn(
          "@container group/player relative isolate w-full select-none",
          "rounded-xl shadow-[var(--shadow)] data-fullscreen:shadow-none outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "data-fullscreen:rounded-none data-fullscreen:bg-page",
          "data-[controls=hidden]:data-[state=playing]:cursor-none",
          className,
        )}
        style={{ aspectRatio, ...style }}
        {...rest}
      >
        {/* Everything inside is a dark surface in both themes (pictures read best on black), while the
            frame's own shadow and focus ring follow the page. Popups portal in here to inherit it. */}
        <div ref={setLayer} data-theme="dark" className="absolute inset-0 rounded-[inherit] text-fg">
        {/* The picture layer clips to the radius; controls and popups live above it, unclipped. */}
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-page ring-1 ring-line in-data-fullscreen:ring-0">
          <video
            ref={attachVideo}
            src={src}
            poster={poster}
            loop={loop}
            preload={preload}
            playsInline
            {...videoProps}
            className={cn("absolute inset-0 size-full object-contain", videoProps?.className)}
          >
            {tracks.map((t) => (
              <track key={t.src} kind="subtitles" src={t.src} srcLang={t.srcLang} label={t.label} />
            ))}
          </video>

          {/* Scrim, so white controls hold contrast on a bright frame. Fades with the controls. */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-page/85 via-page/35 to-transparent",
              "transition-opacity duration-300 ease-out-quart group-data-[controls=visible]/player:opacity-100 group-data-[controls=hidden]/player:opacity-0 group-data-[controls=visible]/player:duration-150",
            )}
          />
          {title && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-page/70 to-transparent transition-opacity duration-200 ease-out-quart",
                started && "opacity-0",
              )}
            />
          )}
        </div>

        {/* Click / tap surface */}
        <div
          aria-hidden
          className="absolute inset-0"
          onClick={onSurfaceClick}
          onDoubleClick={(e) => {
            if ((e.nativeEvent as PointerEvent).pointerType !== "touch") toggleFullscreen();
          }}
          onPointerUp={onSurfacePointerUp}
        />

        {/* Title over the poster, until the first play */}
        {title && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 flex items-baseline gap-2 p-4 transition-[opacity,translate] duration-200 ease-out-quart @max-[420px]:p-3",
              started && "-translate-y-1 opacity-0",
            )}
          >
            <p className="min-w-0 truncate text-[14px] font-medium tracking-[-0.015em] text-fg">{title}</p>
            {duration > 0 && <span className="tabular shrink-0 font-mono text-[11px] text-fg-2">{formatTime(duration)}</span>}
          </div>
        )}

        <CenterLayer
          reduce={reduce}
          started={started}
          ended={ended}
          failed={failed}
          waiting={waiting && !failed}
          bezel={bezel}
          onPlay={togglePlay}
          onRetry={retry}
        />

        <Captions text={showCaption ? cue : []} lang={currentTrack?.srcLang} lift={!started || !controlsVisible ? "none" : previewing ? "preview" : "controls"} />

        {/* Controls */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-3 pb-2 @max-[420px]:px-2 @max-[420px]:pb-1",
            "transition-[opacity,translate] ease-out-quart motion-reduce:translate-y-0",
            // Before the first play the poster, title and big button speak for themselves.
            started && controlsVisible && !failed ? "translate-y-0 opacity-100 duration-150" : "pointer-events-none translate-y-1 opacity-0 duration-300",
          )}
          // Hidden controls leave the tab order and the accessibility tree until they return.
          inert={!started || failed ? true : undefined}
        >
          <Scrubber
            video={video}
            mediaRef={media}
            duration={duration}
            live={controlsVisible}
            chapters={chapters}
            onScrubbingChange={setScrubbing}
            onPreviewChange={setPreviewing}
          />
          <div className="flex h-9 items-center gap-0.5">
            <ControlButton label={ended ? "Replay" : paused ? "Play" : "Pause"} shortcut="K" container={layer} onClick={togglePlay}>
              {ended ? <ReplayGlyph /> : <PlayGlyph paused={paused} morph={!reduce} />}
            </ControlButton>

            <div className="group/volume flex items-center">
              <ControlButton label={muted || volume === 0 ? "Unmute" : "Mute"} shortcut="M" container={layer} onClick={toggleMute}>
                <VolumeGlyph level={volume} muted={muted || volume === 0} />
              </ControlButton>
              {/* Reveals on hover or keyboard focus; on touch the system volume is the control. */}
              <div className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out-quart group-hover/volume:grid-cols-[1fr] group-focus-within/volume:grid-cols-[1fr] pointer-coarse:hidden @max-[420px]:hidden motion-reduce:transition-none">
                <div className="min-w-0 overflow-hidden">
                  <VolumeSlider value={muted ? 0 : volume} onChange={setVol} />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRemaining((r) => !r)}
              aria-label={remaining ? "Show elapsed time" : "Show time remaining"}
              className="ml-1 grid h-7 place-items-center rounded-md px-1.5 outline-none transition-colors duration-150 hover:bg-fg/10 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
            >
              <TimeReadout video={video} duration={duration} remaining={remaining} />
            </button>

            <span className="flex-1" />

            {trackCount > 0 && (
              <ControlButton
                label={captions ? "Turn off subtitles" : "Turn on subtitles"}
                shortcut="C"
                container={layer}
                pressed={captions}
                onClick={() => {
                  setCaptions((c) => !c);
                  say(captions ? "Subtitles off" : `Subtitles on, ${currentTrack?.label ?? ""}`);
                }}
              >
                <CaptionsGlyph on={captions} />
              </ControlButton>
            )}

            <SettingsMenu
              container={layer}
              rate={rate}
              rates={playbackRates}
              onRate={(r) => {
                setRate(r);
                say(`Speed ${formatRate(r)}`);
              }}
              tracks={tracks}
              trackValue={captions ? String(trackIndex) : "off"}
              onTrack={(v) => {
                if (v === "off") setCaptions(false);
                else {
                  setTrackIndex(Number(v));
                  setCaptions(true);
                }
              }}
              onOpenChange={setMenuOpen}
            />

            {pipSupported && (
              <ControlButton label="Picture in picture" container={layer} onClick={togglePip} className="@max-[420px]:hidden">
                <PipGlyph />
              </ControlButton>
            )}

            <ControlButton label={fullscreen ? "Exit full screen" : "Full screen"} shortcut="F" container={layer} onClick={toggleFullscreen}>
              <FullscreenGlyph on={fullscreen} />
            </ControlButton>
          </div>
        </div>

        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>
    </Tooltip.Provider>
  );
}

/* ------------------------------------------------------------------ center: big play, spinner, bezel, error */

function CenterLayer({
  reduce,
  started,
  ended,
  failed,
  waiting,
  bezel,
  onPlay,
  onRetry,
}: {
  reduce: boolean;
  started: boolean;
  ended: boolean;
  failed: boolean;
  waiting: boolean;
  bezel: Bezel | null;
  onPlay: () => void;
  onRetry: () => void;
}) {
  const bigButton = !failed && (!started || ended);
  return (
    <>
      <AnimatePresence initial={false}>
        {bigButton && (
          <motion.div
            key={ended ? "replay" : "play"}
            className="pointer-events-none absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, transition: { duration: 0.18, ease: ease.out } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            <button
              type="button"
              onClick={onPlay}
              aria-label={ended ? "Replay" : "Play video"}
              className={cn(
                "group/big pointer-events-auto grid size-14 place-items-center rounded-full border border-fg/15 bg-page/55 text-fg shadow-pop backdrop-blur-md @max-[420px]:size-12",
                "outline-none transition-[background-color,scale] duration-150 ease-out-quart hover:bg-page/70 active:scale-[0.94] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-2",
              )}
            >
              <span className="transition-transform duration-200 ease-out-quart group-hover/big:scale-110 motion-reduce:transition-none">
                {ended ? <ReplayGlyph size={22} /> : <PlayGlyph paused size={22} />}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {waiting && (
          <motion.div
            key="wait"
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2 }}
          >
            <span className="grid size-12 place-items-center rounded-full bg-page/50">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="animate-spin text-fg [animation-duration:0.8s]" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One bezel at a time: a new action replaces the old one in place. */}
      <AnimatePresence>
        {bezel && (
          <motion.div
            key={bezel.id}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 grid place-items-center",
              bezel.side === "left" ? "left-0 w-1/3" : bezel.side === "right" ? "right-0 w-1/3" : "inset-x-0",
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.1, transition: { duration: 0.28, ease: ease.out } }}
            transition={reduce ? { duration: 0.1 } : { duration: 0.16, ease: ease.out }}
          >
            <span className="flex flex-col items-center gap-1.5">
              <span className="grid size-12 place-items-center rounded-full bg-page/60 text-fg [&_svg]:size-5">{bezel.icon}</span>
              {bezel.label && <span className="tabular rounded-md bg-page/60 px-1.5 py-0.5 font-mono text-[11px] text-fg">{bezel.label}</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {failed && (
        // The frame behind stays, veiled, so the message reads on any picture.
        <div role="alert" className="absolute inset-0 grid place-items-center rounded-[inherit] bg-page/80 p-6 backdrop-blur-sm">
          <div className="flex max-w-[280px] flex-col items-center gap-3 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
                <circle cx="8" cy="8" r="5.75" />
                <path d="M8 5v3.5" />
                <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-medium text-fg">Couldn’t play this video</p>
              <p className="text-[12px] leading-[1.5] text-fg-2 [text-wrap:balance]">The file didn’t load. Check your connection, then try again.</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ captions */

function Captions({ text, lang, lift }: { text: string[]; lang?: string; lift: "none" | "controls" | "preview" }) {
  return (
    <div
      // Drawn for sighted viewers; the soundtrack is already audible to screen reader users.
      aria-hidden
      lang={lang}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 px-6 pb-4 text-center",
        // Rise above the controls while they show, instead of hiding under them.
        "transition-transform duration-200 ease-in-out-quart motion-reduce:transition-none",
        // …and higher still while the scrubber's time preview is up, so the two never overlap.
        lift === "preview" ? "-translate-y-[120px] @max-[420px]:-translate-y-[110px]" : lift === "controls" ? "-translate-y-[68px] @max-[420px]:-translate-y-[58px]" : "translate-y-0",
      )}
    >
      {text.map((line, i) => (
        <span
          key={`${i}-${line}`}
          className="max-w-[min(90%,560px)] rounded-md bg-page/75 px-2 py-0.5 text-[15px] leading-[1.4] tracking-[-0.005em] text-fg [text-wrap:balance] @max-[420px]:text-[13px] in-data-fullscreen:text-[22px]"
        >
          {line}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ scrubber */

function Scrubber({
  video,
  mediaRef,
  duration,
  live,
  chapters,
  onScrubbingChange,
  onPreviewChange,
}: {
  video: HTMLVideoElement | null;
  mediaRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  live: boolean;
  chapters?: VideoChapter[];
  onScrubbingChange: (v: boolean) => void;
  onPreviewChange: (v: boolean) => void;
}) {
  const time = useSmoothTime(video, live);
  const bufferedKey = useMediaValue(video, BUFFER_EVENTS, readBuffered, "");
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const resume = useRef(false);
  const control = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = control.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const buffered = useMemo(
    () =>
      bufferedKey
        ? bufferedKey.split(",").map((r) => {
            const [a, b] = r.split("-").map(Number);
            return [a, b] as const;
          })
        : [],
    [bufferedKey],
  );

  const value = drag ?? time;
  const pct = (t: number) => (duration ? (Math.min(duration, Math.max(0, t)) / duration) * 100 : 0);

  // Chapter gaps, cut out of every layer at once with a mask.
  const mask = useMemo(() => {
    if (!chapters?.length || !duration) return undefined;
    const cuts = chapters.map((c) => c.start).filter((s) => s > 0 && s < duration);
    if (!cuts.length) return undefined;
    const stops = cuts.map((s) => `var(--fg) calc(${pct(s)}% - 1.5px), transparent calc(${pct(s)}% - 1.5px) calc(${pct(s)}% + 1.5px), var(--fg) calc(${pct(s)}% + 1.5px)`);
    return `linear-gradient(to right, var(--fg) 0, ${stops.join(", ")})`;
    // pct only depends on duration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, duration]);

  const chapterAt = (t: number) => {
    if (!chapters?.length) return undefined;
    let found: VideoChapter | undefined;
    for (const c of chapters) if (c.start <= t) found = c;
    return found?.title;
  };

  const shown = drag ?? hover;
  const previewing = shown !== null;
  useEffect(() => onPreviewChange(previewing), [previewing, onPreviewChange]);
  const bubbleX = shown === null ? 0 : (pct(shown) / 100) * width;
  const label = shown === null ? "" : formatTime(shown, duration);
  const chapter = shown === null ? undefined : chapterAt(shown);

  return (
    <Slider.Root
      value={value}
      min={0}
      max={duration || 1}
      step={0.01}
      disabled={!duration}
      onValueChange={(v, details) => {
        const video = mediaRef.current;
        if (!video || !duration) return;
        if (details.reason === "keyboard") {
          // Native range steps are useless for time; seek in human-sized jumps instead.
          details.cancel();
          const key = (details.event as KeyboardEvent).key;
          const jump = key === "PageUp" || key === "PageDown" ? 10 : 5;
          const dir = key === "ArrowRight" || key === "ArrowUp" || key === "PageUp" ? 1 : key === "Home" ? -Infinity : key === "End" ? Infinity : -1;
          video.currentTime = Math.min(duration, Math.max(0, video.currentTime + dir * jump));
          return;
        }
        if (drag === null) {
          resume.current = !video.paused;
          if (resume.current) video.pause();
          onScrubbingChange(true);
        }
        setDrag(v);
        // Show the frame under the thumb while dragging. fastSeek lands on the nearest keyframe, which is what scrubbing wants.
        if ("fastSeek" in video && typeof video.fastSeek === "function") video.fastSeek(v);
        else video.currentTime = v;
      }}
      onValueCommitted={(v, details) => {
        const video = mediaRef.current;
        if (!video || details.reason === "keyboard") return;
        video.currentTime = v;
        setDrag(null);
        onScrubbingChange(false);
        if (resume.current) video.play().catch(noop);
        resume.current = false;
      }}
      className="group/scrub relative"
    >
      <Slider.Control
        ref={control}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || !duration) return;
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
        }}
        onPointerLeave={() => setHover(null)}
        className="relative flex h-5 w-full touch-none items-center data-disabled:opacity-50 pointer-coarse:h-7"
      >
        <Slider.Track className="relative h-[3px] w-full">
          {/* The rail thickens under the pointer: a hint that it's grabbable. The thumb sits outside it, unscaled. */}
          <div
            className={cn(
              "absolute inset-0 overflow-hidden rounded-full",
              "origin-center transition-[scale] duration-150 ease-out-quart group-hover/scrub:scale-y-[1.67] group-data-dragging/scrub:scale-y-[1.67] motion-reduce:transition-none",
            )}
            style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
          >
            <div className="absolute inset-0 bg-fg/20" />
            {buffered.map(([a, b]) => (
              <div key={`${a}-${b}`} className="absolute inset-y-0 bg-fg/25" style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }} />
            ))}
            {hover !== null && drag === null && <div className="absolute inset-y-0 left-0 bg-fg/30" style={{ width: `${pct(hover)}%` }} />}
            <Slider.Indicator className="bg-fg" />
          </div>
          <Slider.Thumb
            aria-label="Seek"
            getAriaValueText={(_, v) => `${speakTime(v)} of ${speakTime(duration)}`}
            className={cn(
              "size-3 rounded-full bg-fg shadow-[0_0_0_1px_var(--page)]",
              "scale-50 opacity-0 transition-[scale,opacity] duration-150 ease-out-quart motion-reduce:transition-none",
              "group-hover/scrub:scale-100 group-hover/scrub:opacity-100 has-[:focus-visible]:scale-100 has-[:focus-visible]:opacity-100",
              "data-dragging:scale-[1.15] data-dragging:opacity-100",
              "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-2",
            )}
          />
        </Slider.Track>

        {/* Hover / drag time. Clamped so it never leaves the rail. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-full left-0 mb-2 flex flex-col items-center gap-0.5 transition-opacity duration-100",
            shown === null ? "opacity-0" : "opacity-100",
          )}
          style={{ translate: `clamp(0px, ${bubbleX}px - 50%, ${width}px - 100%) 0` }}
        >
          {chapter && <span className="max-w-[200px] truncate rounded-md bg-page/80 px-1.5 py-0.5 text-[11.5px] font-medium text-fg">{chapter}</span>}
          <span className="tabular rounded-md bg-page/80 px-1.5 py-0.5 font-mono text-[11px] text-fg">{label}</span>
        </div>
      </Slider.Control>
    </Slider.Root>
  );
}

function TimeReadout({ video, duration, remaining }: { video: HTMLVideoElement | null; duration: number; remaining: boolean }) {
  const time = useMediaValue(video, TIME_EVENTS, (v) => Math.floor(v.currentTime), 0);
  const total = duration ? formatTime(duration) : "0:00";
  const now = remaining && duration ? formatTime(-(duration - time), duration) : formatTime(time, duration);
  // Reserve the widest value so the row never shifts as digits change or the mode flips.
  const widest = formatTime(-(duration || 0), duration).replace(/\d/g, "0");
  return (
    <span className="tabular flex items-center gap-1 font-mono text-[11.5px] text-fg">
      <span className="grid text-right">
        <span aria-hidden className="invisible col-start-1 row-start-1">{widest}</span>
        <span className="col-start-1 row-start-1">{now}</span>
      </span>
      <span className="text-fg-3">/</span>
      <span className="text-fg-2">{total}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ volume */

function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Slider.Root value={value} min={0} max={1} step={0.01} largeStep={0.1} onValueChange={(v) => onChange(v)} className="group/vol w-[76px] px-2">
      <Slider.Control className="flex h-8 w-full touch-none items-center">
        <Slider.Track className="relative h-[3px] w-full rounded-full bg-fg/20">
          <Slider.Indicator className="rounded-full bg-fg" />
          <Slider.Thumb
            aria-label="Volume"
            getAriaValueText={(_, v) => (v === 0 ? "Muted" : `${Math.round(v * 100)}%`)}
            className={cn(
              "size-2.5 rounded-full bg-fg transition-[scale] duration-150 ease-out-quart data-dragging:scale-125 motion-reduce:transition-none",
              "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-2",
            )}
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

/* ------------------------------------------------------------------ settings menu */

const formatRate = (r: number) => (r === 1 ? "Normal" : `${r}×`);

function SettingsMenu({
  container,
  rate,
  rates,
  onRate,
  tracks,
  trackValue,
  onTrack,
  onOpenChange,
}: {
  container: HTMLElement | null;
  rate: number;
  rates: number[];
  onRate: (r: number) => void;
  tracks: VideoTrack[];
  trackValue: string;
  onTrack: (v: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const labels = rates.map((r) => `${r}×`);
  const item = cn(
    "group/item flex h-8 cursor-default items-center gap-2 rounded-lg pl-2 pr-3 text-[13px] text-fg outline-none select-none",
    "data-highlighted:bg-fg/[0.07] data-disabled:opacity-50",
  );
  return (
    <Menu.Root onOpenChange={(open) => onOpenChange(open)} modal={false}>
      <Menu.Trigger
        aria-label={`Settings, speed ${formatRate(rate)}`}
        className={cn(
          "grid h-8 min-w-9 place-items-center rounded-lg px-1.5 font-mono text-[11.5px] tabular text-fg outline-none",
          "transition-[background-color,scale] duration-150 ease-out-quart hover:bg-fg/10 active:scale-[0.94] active:duration-75 data-popup-open:bg-fg/10",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        )}
      >
        {/* All rate labels share one cell, so the button never changes width. */}
        <span className="grid">
          {labels.map((l) => (
            <span key={l} aria-hidden className="invisible col-start-1 row-start-1">{l}</span>
          ))}
          <span className="col-start-1 row-start-1 text-center">{`${rate}×`}</span>
        </span>
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Menu.Popup
            className={cn(
              "max-h-(--available-height) min-w-[184px] overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised/95 p-1 shadow-pop outline-none backdrop-blur-md",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
              "data-instant:duration-0",
            )}
          >
            <Menu.RadioGroup value={String(rate)} onValueChange={(v: string) => onRate(Number(v))}>
              <Menu.GroupLabel className="px-2 pb-1 pt-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">Speed</Menu.GroupLabel>
              {rates.map((r) => (
                <Menu.RadioItem key={r} value={String(r)} closeOnClick className={item}>
                  <span className="grid size-4 place-items-center">
                    <Menu.RadioItemIndicator keepMounted className="grid place-items-center">
                      <Tick />
                    </Menu.RadioItemIndicator>
                  </span>
                  <span className="flex-1">{formatRate(r)}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            {tracks.length > 1 && (
              <>
                <Menu.Separator className="mx-2 my-1 h-px bg-line" />
                <Menu.RadioGroup value={trackValue} onValueChange={(v: string) => onTrack(v)}>
                  <Menu.GroupLabel className="px-2 pb-1 pt-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">Subtitles</Menu.GroupLabel>
                  {[{ value: "off", label: "Off" }, ...tracks.map((t, i) => ({ value: String(i), label: t.label }))].map((o) => (
                    <Menu.RadioItem key={o.value} value={o.value} closeOnClick className={item}>
                      <span className="grid size-4 place-items-center">
                        <Menu.RadioItemIndicator keepMounted className="grid place-items-center">
                          <Tick />
                        </Menu.RadioItemIndicator>
                      </span>
                      <span className="flex-1 truncate">{o.label}</span>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ------------------------------------------------------------------ control button with tooltip */

function ControlButton({
  label,
  shortcut,
  container,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string;
  shortcut?: string;
  container: HTMLElement | null;
  pressed?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={label}
        aria-pressed={pressed}
        aria-keyshortcuts={shortcut}
        onClick={onClick}
        className={cn(
          "group/btn relative grid size-8 shrink-0 place-items-center rounded-lg text-fg outline-none",
          "transition-[background-color,scale] duration-150 ease-out-quart hover:bg-fg/10 active:scale-[0.9] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          // 44px on touch without changing the drawing.
          "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
          className,
        )}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner side="top" sideOffset={10} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex items-center gap-2 rounded-lg border border-line-2 bg-raised px-2 py-1 text-[12px] text-fg shadow-pop",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:duration-0",
            )}
          >
            {label}
            {shortcut && <kbd className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3">{shortcut}</kbd>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* ------------------------------------------------------------------ glyphs */

// Play is two quads that morph into the two pause bars: same point count, so the path tweens.
const PLAY_L = "M4.6 2.9L8.6 5.3L8.6 10.7L4.6 13.1Z";
const PLAY_R = "M8.6 5.3L12.9 8L12.9 8L8.6 10.7Z";
const PAUSE_L = "M4 3L7 3L7 13L4 13Z";
const PAUSE_R = "M9 3L12 3L12 13L9 13Z";

function PlayGlyph({ paused, size = 16, morph = false }: { paused: boolean; size?: number; morph?: boolean }) {
  const t = { duration: 0.2, ease: ease.inOut };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" aria-hidden>
      <motion.path initial={false} animate={{ d: paused ? PLAY_L : PAUSE_L }} transition={morph ? t : { duration: 0 }} />
      <motion.path initial={false} animate={{ d: paused ? PLAY_R : PAUSE_R }} transition={morph ? t : { duration: 0 }} />
    </svg>
  );
}

function ReplayGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a5 5 0 1 0 1.5-3.55M3 2.75V5h2.25" />
    </svg>
  );
}

function SeekGlyph({ dir }: { dir: 1 | -1 }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden style={{ transform: dir < 0 ? "scaleX(-1)" : undefined }}>
      <path d="M2.5 4v8l5-4zM8.5 4v8l5-4z" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

function SpeedGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <path d="M2.75 11a5.25 5.25 0 1 1 10.5 0" />
      <path d="M8 11 10.5 7" />
    </svg>
  );
}

// Waves retract toward the speaker as the level drops; a cross draws in when muted.
function VolumeGlyph({ level, muted }: { level: number; muted: boolean }) {
  const w1 = !muted && level > 0;
  const w2 = !muted && level > 0.5;
  const wave = "origin-[7.5px_8px] transition-[opacity,scale] duration-200 ease-out-quart motion-reduce:transition-none";
  const cross = "transition-[stroke-dashoffset] duration-200 ease-out-quart [stroke-dasharray:1] motion-reduce:transition-none";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.5 3.25 4.6 5.6H2.6v4.8h2l2.9 2.35z" />
      <path d="M10 6.2a2.6 2.6 0 0 1 0 3.6" className={cn(wave, w1 ? "scale-100 opacity-100" : "scale-50 opacity-0")} />
      <path d="M12 4.4a5.2 5.2 0 0 1 0 7.2" className={cn(wave, w2 ? "scale-100 opacity-100" : "scale-50 opacity-0")} />
      <path d="M10.25 6.4l3.2 3.2" pathLength={1} className={cn(cross, muted ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]")} />
      <path d="M13.45 6.4l-3.2 3.2" pathLength={1} className={cn(cross, "delay-75", muted ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]")} />
    </svg>
  );
}

function CaptionsGlyph({ on }: { on?: boolean }) {
  return (
    <span className="relative grid place-items-center">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3.5" width="12" height="9" rx="2" />
        <path d="M7 6.9a1.5 1.5 0 1 0 0 2.2M11.25 6.9a1.5 1.5 0 1 0 0 2.2" />
      </svg>
      {on !== undefined && (
        // The "on" bar grows from the center under the icon.
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-[5px] h-[2px] w-3.5 rounded-full bg-fg transition-[scale,opacity] duration-200 ease-out-quart motion-reduce:transition-none",
            on ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
          )}
        />
      )}
    </span>
  );
}

function PipGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 7.5V4.25c0-.4-.35-.75-.75-.75H3.25c-.4 0-.75.35-.75.75v7.5c0 .4.35.75.75.75H6" />
      <rect x="8.5" y="9.5" width="5" height="3.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

// Corners travel outward to enter full screen and inward to leave; on hover they lean 0.75px in their direction.
function FullscreenGlyph({ on }: { on: boolean }) {
  const corners = on
    ? ["M6 2.75V6H2.75", "M10 2.75V6h3.25", "M6 13.25V10H2.75", "M10 13.25V10h3.25"]
    : ["M2.75 6V2.75H6", "M10 2.75h3.25V6", "M2.75 10v3.25H6", "M13.25 10v3.25H10"];
  const nudge = on
    ? ["group-hover/btn:translate-x-[0.75px] group-hover/btn:translate-y-[0.75px]", "group-hover/btn:-translate-x-[0.75px] group-hover/btn:translate-y-[0.75px]", "group-hover/btn:translate-x-[0.75px] group-hover/btn:-translate-y-[0.75px]", "group-hover/btn:-translate-x-[0.75px] group-hover/btn:-translate-y-[0.75px]"]
    : ["group-hover/btn:-translate-x-[0.75px] group-hover/btn:-translate-y-[0.75px]", "group-hover/btn:translate-x-[0.75px] group-hover/btn:-translate-y-[0.75px]", "group-hover/btn:-translate-x-[0.75px] group-hover/btn:translate-y-[0.75px]", "group-hover/btn:translate-x-[0.75px] group-hover/btn:translate-y-[0.75px]"];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="overflow-visible">
      {corners.map((d, i) => (
        <path key={`${on}-${i}`} d={d} className={cn("transition-transform duration-200 ease-out-quart motion-reduce:transition-none", nudge[i])} />
      ))}
    </svg>
  );
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-300 ease-out-expo in-data-checked:[stroke-dashoffset:0] motion-reduce:transition-none"
      />
    </svg>
  );
}
