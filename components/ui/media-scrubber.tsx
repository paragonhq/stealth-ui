"use client";
import { Slider } from "@base-ui/react/slider";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

export type MediaChapter = { start: number; title: string };

/** 83 → "1:23", 3725 → "1:02:05". Locale-free, so server and client agree. */
export function formatTime(seconds: number, pad = false) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 || pad ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function spokenTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const parts = [
    [Math.floor(s / 3600), "hour"],
    [Math.floor((s % 3600) / 60), "minute"],
    [s % 60, "second"],
  ] as const;
  const said = parts.filter(([n], i) => n > 0 || (i === 2 && s === 0)).map(([n, unit]) => `${n} ${unit}${n === 1 ? "" : "s"}`);
  return said.join(" ");
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type MediaScrubberProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** Current time in seconds, usually mirrored from the media element's timeupdate. */
  value?: number;
  defaultValue?: number;
  /** Fires while scrubbing and on every key press. Use it to preview; seek on commit. */
  onValueChange?: (time: number) => void;
  /** Fires when a drag is released, the track is clicked or a key moves the time. This is where you seek. */
  onValueCommitted?: (time: number) => void;
  /** Total length in seconds. 0, NaN or Infinity (metadata not loaded yet) disables the scrubber. */
  duration: number;
  /** Buffered end in seconds, or the ranges from media.buffered as [start, end] pairs. */
  buffered?: number | Array<[number, number]>;
  /** Sorted or not; each chapter runs until the next one starts. */
  chapters?: MediaChapter[];
  /** Seconds moved by the arrow keys. */
  keyStep?: number;
  /** Seconds moved by Shift+Arrow and Page Up/Down. */
  largeKeyStep?: number;
  disabled?: boolean;
  "aria-label"?: string;
};

export function MediaScrubber({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  onValueCommitted,
  duration,
  buffered,
  chapters,
  keyStep = 5,
  largeKeyStep = 10,
  disabled: disabledProp = false,
  className,
  "aria-label": ariaLabel = "Seek",
  ...rest
}: MediaScrubberProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const ready = Number.isFinite(duration) && duration > 0;
  const disabled = disabledProp || !ready;
  const max = ready ? duration : 1;

  // While a drag is in progress the thumb shows the scrub position, not the
  // playing time the parent keeps pushing in, so the two never fight.
  const [scrub, setScrub] = useState<number | null>(null);
  const [hover, setHover] = useState<{ time: number } | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const time = clamp(scrub ?? value, 0, max);
  const pct = (t: number) => (clamp(t, 0, max) / max) * 100;

  const sorted = chapters?.length ? [...chapters].sort((a, b) => a.start - b.start) : [{ start: 0, title: "" }];
  const segments = sorted.map((c, i) => ({ ...c, start: i === 0 ? 0 : c.start, end: sorted[i + 1]?.start ?? max }));
  const chapterAt = (t: number) => segments.findLast((s) => t >= s.start) ?? segments[0];
  const ranges: Array<[number, number]> = buffered === undefined ? [] : typeof buffered === "number" ? [[0, buffered]] : buffered;

  const tipTime = scrub ?? (keyboard ? time : hover?.time ?? null);
  const tipOpen = !disabled && tipTime !== null;
  const tipChapter = tipTime !== null && chapters?.length ? chapterAt(tipTime).title : null;
  const hoveredChapter = hover && chapters?.length ? chapterAt(hover.time) : null;

  // The tip follows the pointer 1:1 but stays inside the track's edges.
  const placeTip = (t: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const w = track.clientWidth;
    const half = (tipRef.current?.offsetWidth ?? 0) / 2;
    return clamp((pct(t) / 100) * w, Math.min(half, w / 2), Math.max(w - half, w / 2));
  };
  const [tipX, setTipX] = useState(0);

  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || e.pointerType === "touch") return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = clamp((e.clientX - rect.left) / rect.width, 0, 1) * max;
    setHover({ time: t });
    setKeyboard(false);
    if (scrub === null) setTipX(placeTip(t));
  };

  const set = (t: number, commit: boolean) => {
    const next = clamp(t, 0, max);
    setValue(next);
    if (commit) onValueCommitted?.(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const big = e.shiftKey ? largeKeyStep : keyStep;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = time + big;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = time - big;
    else if (e.key === "PageUp") next = time + largeKeyStep;
    else if (e.key === "PageDown") next = time - largeKeyStep;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    // 0–9 jump to that tenth of the way through, as most players do.
    else if (/^[0-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) next = (Number(e.key) / 10) * max;
    if (next === null) return;
    // Owning the keys here stops the primitive from snapping to its own step.
    e.preventDefault();
    // A thumb focused by the pointer earlier should show its ring once keys take over.
    const input = e.currentTarget;
    if (!input.matches(":focus-visible")) {
      input.blur();
      input.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    }
    setKeyboard(true);
    set(next, true);
    setTipX(placeTip(clamp(next, 0, max)));
  };

  return (
    <Slider.Root
      value={time}
      min={0}
      max={max}
      step={0.01}
      disabled={disabled}
      onValueChange={(v, details) => {
        if (details.reason === "keyboard") return;
        const t = v as number;
        setScrub(t);
        setKeyboard(false);
        setTipX(placeTip(t));
        onValueChange?.(t);
      }}
      onValueCommitted={(v, details) => {
        if (details.reason === "keyboard") return;
        setScrub(null);
        set(v as number, true);
      }}
      data-scrubbing={scrub !== null || undefined}
      className={cn("group/scrub relative w-full touch-none select-none", disabled && "opacity-50", className)}
      {...rest}
    >
      <Slider.Control
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        className={cn("relative flex h-5 w-full items-center [@media(pointer:coarse)]:h-11", !disabled && "cursor-pointer")}
      >
        <Slider.Track ref={trackRef} className="relative h-1.5 w-full">
          {segments.map((s, i) => {
            const len = Math.max(s.end - s.start, 0.0001);
            const fill = (t: number) => `${clamp((t - s.start) / len, 0, 1) * 100}%`;
            const active = hoveredChapter?.start === s.start || (scrub !== null && chapterAt(scrub).start === s.start);
            return (
              <div
                key={s.start}
                aria-hidden
                data-active={(active && segments.length > 1) || undefined}
                // Chapters sit at their true positions with a 2px gap cut from each
                // side, so the fill and the thumb always line up.
                style={{
                  left: `calc(${pct(s.start)}% + ${i === 0 ? 0 : 1}px)`,
                  width: `calc(${pct(s.end) - pct(s.start)}% - ${(i === 0 ? 0 : 1) + (i === segments.length - 1 ? 0 : 1)}px)`,
                }}
                className={cn(
                  "absolute inset-y-0 overflow-hidden rounded-full bg-line-2",
                  "scale-y-50 transition-transform duration-150 ease-out-quart motion-reduce:transition-none",
                  "group-hover/scrub:scale-y-[0.7] group-data-[scrubbing]/scrub:scale-y-[0.7] data-[active]:!scale-y-100",
                  "[@media(hover:none)]:scale-y-[0.7]",
                )}
              >
                {ranges.map(([a, b]) =>
                  b > s.start && a < s.end ? (
                    <span
                      key={`${a}-${b}`}
                      className="absolute inset-y-0 bg-fg-4"
                      style={{ left: fill(a), width: `calc(${fill(b)} - ${fill(a)})` }}
                    />
                  ) : null,
                )}
                {hover && scrub === null && hover.time > time && (
                  <span className="absolute inset-y-0 left-0 bg-fg-3" style={{ width: fill(hover.time) }} />
                )}
                <span className="absolute inset-y-0 left-0 bg-fg" style={{ width: fill(time) }} />
              </div>
            );
          })}

          <Slider.Thumb
            aria-label={ariaLabel}
            getAriaValueText={(_, v) => {
              const c = chapters?.length ? chapterAt(v).title : "";
              return `${spokenTime(v)} of ${spokenTime(max)}${c ? `, ${c}` : ""}`;
            }}
            onKeyDown={onKeyDown}
            onFocus={(e) => setKeyboard(e.currentTarget.matches(":focus-visible"))}
            onBlur={() => setKeyboard(false)}
            className={cn(
              "size-3 rounded-full bg-fg shadow-[var(--shadow)]",
              // Hidden at rest so the bar reads as a clean line; it arrives on hover,
              // focus or touch, and swells a little while held.
              "scale-0 transition-[scale] duration-150 ease-out-quart motion-reduce:transition-none",
              "group-hover/scrub:scale-100 has-[:focus-visible]:scale-100 [@media(hover:none)]:scale-100",
              "group-data-[scrubbing]/scrub:scale-[1.25] motion-reduce:group-data-[scrubbing]/scrub:scale-100",
              "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-3",
              disabled && "hidden",
            )}
          />
        </Slider.Track>
      </Slider.Control>

      <div
        ref={tipRef}
        aria-hidden
        style={{ transform: `translateX(calc(${tipX}px - 50%))` }}
        className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-(--z-tooltip)"
      >
        <div
          data-open={tipOpen || undefined}
          className={cn(
            "flex origin-bottom flex-col items-center rounded-md border border-line-2 bg-raised px-2 py-1 shadow-pop",
            "translate-y-0.5 scale-[0.96] opacity-0 transition-[opacity,scale,translate] duration-100 ease-out",
            "data-[open]:translate-y-0 data-[open]:scale-100 data-[open]:opacity-100 data-[open]:duration-150 data-[open]:ease-out-expo",
            "motion-reduce:translate-y-0 motion-reduce:scale-100",
          )}
        >
          {tipChapter && <span className="max-w-[180px] truncate text-[11px] leading-[14px] text-fg-2">{tipChapter}</span>}
          <span className="tabular text-[12px] font-medium leading-4 text-fg">{formatTime(tipTime ?? 0, max >= 3600)}</span>
        </div>
      </div>
    </Slider.Root>
  );
}
