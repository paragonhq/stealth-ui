"use client";
import { Popover } from "@base-ui/react/popover";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ state */

export type UseVolumeOptions = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  muted?: boolean;
  defaultMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
};

/** Volume and mute as two separate facts, so unmuting returns to the level you left. */
export function useVolume({ value, defaultValue = 60, onValueChange, muted: mutedProp, defaultMuted = false, onMutedChange }: UseVolumeOptions = {}) {
  const [volume, setVolume] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [muted, setMuted] = useControllableState({ value: mutedProp, defaultValue: defaultMuted, onChange: onMutedChange });
  // The last level you could hear, for when you unmute from a volume of 0.
  const [audible, setAudible] = useState(defaultValue > 0 ? defaultValue : 60);

  const set = useCallback(
    (v: number) => {
      const next = Math.round(Math.min(100, Math.max(0, v)));
      if (next > 0) setAudible(next);
      setVolume(next);
      // Touching the level is a request to hear it.
      if (muted) setMuted(false);
    },
    [muted, setMuted, setVolume],
  );

  /** Returns the level you will hear afterwards. */
  const toggleMute = useCallback(() => {
    if (muted || volume === 0) {
      setMuted(false);
      if (volume === 0) setVolume(audible);
      return volume === 0 ? audible : volume;
    }
    setMuted(true);
    return 0;
  }, [audible, muted, setMuted, setVolume, volume]);

  const level = muted ? 0 : volume;
  return { volume, muted, level, setVolume: set, toggleMute, silent: level === 0 };
}

/** Wheel and trackpad scrolling over an element nudge the volume: 1% per 20px, 5% per mouse notch. */
function useWheel(onStep: (steps: number) => void, enabled: boolean) {
  const cb = useRef(onStep);
  useEffect(() => {
    cb.current = onStep;
  });
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el || !enabled) return;
      let acc = 0;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 33 : 1;
        // Up or right is louder, whichever axis the gesture mostly moved on.
        acc += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY) * unit;
        const steps = Math.trunc(acc / 20);
        if (steps) {
          acc -= steps * 20;
          cb.current(steps);
        }
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    },
    [enabled],
  );
}

/* ------------------------------------------------------------------- icon */

export type VolumeIconProps = Omit<ComponentProps<"svg">, "children"> & { level: number; muted?: boolean; size?: number };

/**
 * A speaker whose waves follow the level: none up to 33%, one to 66%, two above.
 * Silence (muted or 0) crosses it out. Each wave grows out of the cone.
 */
export function VolumeIcon({ level, muted = false, size = 16, className, ...rest }: VolumeIconProps) {
  const reduce = useReducedMotion();
  const silent = muted || level === 0;
  const waves = silent ? 0 : level > 66 ? 2 : level > 33 ? 1 : 0;
  // Every state animates the same properties so the server and client render the
  // same markup; reduced motion only changes how long the non-opacity parts take.
  const t = (i: number, on: boolean) => {
    const base = { duration: on ? 0.26 : 0.16, ease: ease.out, delay: on ? i * 0.05 : (1 - i) * 0.04 }; // inner wave first in, outer first out
    return reduce ? { default: { duration: 0 }, opacity: { duration: 0.12 } } : base;
  };
  const wave = (i: number) => {
    const on = waves > i;
    return {
      initial: false as const,
      animate: { opacity: on ? 1 : 0, pathLength: on ? 1 : 0.2, scale: on ? 1 : 0.6 },
      transition: t(i, on),
      style: { transformOrigin: "6px 8px", transformBox: "view-box" as const },
    };
  };
  const cross = (i: number) => ({
    initial: false as const,
    animate: { opacity: silent ? 1 : 0, pathLength: silent ? 1 : 0 },
    transition: reduce
      ? { default: { duration: 0 }, opacity: { duration: 0.12 } }
      : { duration: silent ? 0.22 : 0.12, ease: ease.out, delay: silent ? 0.06 + i * 0.06 : 0 },
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      <path d="M7.5 3.25 4.6 5.6H2.6v4.8h2l2.9 2.35z" />
      <motion.path d="M10 6.2a2.6 2.6 0 0 1 0 3.6" {...wave(0)} />
      <motion.path d="M12 4.4a5.2 5.2 0 0 1 0 7.2" {...wave(1)} />
      <motion.path d="M10.4 6.3l3.4 3.4" {...cross(0)} />
      <motion.path d="M13.8 6.3l-3.4 3.4" {...cross(1)} />
    </svg>
  );
}

/* ------------------------------------------------------------------ track */

type TrackProps = {
  level: number;
  muted: boolean;
  orientation: "horizontal" | "vertical";
  disabled?: boolean;
  label: string;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  motion: "glide" | "instant";
  setMotion: (m: "glide" | "instant") => void;
  className?: string;
};

// The slider itself, shared by the inline and popover layouts. Mute and unmute
// glide the fill down and back up; drags and keys are instant.
function Track({ level, muted, orientation, disabled, label, onChange, onCommit, motion: mode, setMotion, className }: TrackProps) {
  const vertical = orientation === "vertical";
  return (
    <BaseSlider.Root
      value={level}
      min={0}
      max={100}
      step={1}
      largeStep={10}
      orientation={orientation}
      disabled={disabled}
      onValueChange={(v, d) => {
        setMotion(d.reason === "track-press" ? "glide" : "instant");
        onChange(v as number);
      }}
      onValueCommitted={(v, d) => {
        if (d.reason === "drag") setMotion("glide");
        onCommit?.(v as number);
      }}
      data-motion={mode}
      className={cn("group/vol", className)}
    >
      <BaseSlider.Control
        className={cn(
          "group/control relative flex cursor-pointer touch-none select-none items-center group-data-disabled/vol:pointer-events-none",
          vertical ? "h-full w-6 flex-col justify-center" : "h-6 w-full",
        )}
      >
        <BaseSlider.Track
          className={cn("relative rounded-full bg-fg/10 transition-colors duration-150 group-hover/control:bg-fg/14", vertical ? "h-full w-1" : "h-1 w-full")}
        >
          <div
            aria-hidden
            className={cn(
              "absolute rounded-full bg-fg",
              vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0",
              vertical
                ? "group-data-[motion=glide]/vol:transition-[height] group-data-[motion=glide]/vol:duration-200 group-data-[motion=glide]/vol:ease-out-expo"
                : "group-data-[motion=glide]/vol:transition-[width] group-data-[motion=glide]/vol:duration-200 group-data-[motion=glide]/vol:ease-out-expo",
            )}
            style={vertical ? { height: `${level}%` } : { width: `${level}%` }}
          />
          <BaseSlider.Thumb
            aria-label={label}
            getAriaValueText={(_, v) => (muted ? "Muted" : `${v}%`)}
            className={cn(
              "group/thumb size-3 outline-none before:absolute before:-inset-4 before:content-['']",
              vertical
                ? "group-data-[motion=glide]/vol:transition-[bottom] group-data-[motion=glide]/vol:duration-200 group-data-[motion=glide]/vol:ease-out-expo"
                : "group-data-[motion=glide]/vol:transition-[inset-inline-start] group-data-[motion=glide]/vol:duration-200 group-data-[motion=glide]/vol:ease-out-expo",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full bg-fg shadow-[var(--shadow)]",
                "outline-offset-2 group-has-focus-visible/thumb:outline-1 group-has-focus-visible/thumb:outline-solid group-has-focus-visible/thumb:outline-fg-3",
                // Resting small so the track reads first; grows under the pointer and swells on grab.
                "scale-75 transition-[scale,box-shadow] duration-150 ease-out-expo motion-reduce:transition-none",
                "group-hover/control:scale-100 group-has-focus-visible/thumb:scale-100 group-data-dragging/vol:scale-125 group-data-dragging/vol:ring-4 group-data-dragging/vol:ring-fg/10",
              )}
            />
          </BaseSlider.Thumb>
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

/* ---------------------------------------------------------------- control */

export type VolumeControlProps = Omit<ComponentProps<"div">, "defaultValue" | "onChange"> &
  UseVolumeOptions & {
    /** Inline: icon beside a horizontal track. Popover: an icon button that opens a vertical track on hover or press. */
    variant?: "inline" | "popover";
    /** Print the level beside the inline track. */
    showValue?: boolean;
    /** Called once a drag or key press settles, and after mute changes. Persist here. */
    onValueCommitted?: (value: number) => void;
    /** What is being made louder, for the accessible names: “Volume”, “Call volume”. */
    label?: string;
    disabled?: boolean;
    /** Where the popover portals to. Defaults to the body. */
    container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  };

const iconButton = cn(
  "relative grid size-8 shrink-0 place-items-center rounded-lg text-fg-2 outline-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "disabled:pointer-events-none disabled:opacity-50",
  // A 40px target around a 32px button.
  "before:absolute before:-inset-1 before:content-['']",
);

export function VolumeControl({
  value,
  defaultValue,
  onValueChange,
  muted: mutedProp,
  defaultMuted,
  onMutedChange,
  onValueCommitted,
  variant = "inline",
  showValue = false,
  label = "Volume",
  disabled,
  container,
  className,
  onKeyDown,
  ...rest
}: VolumeControlProps) {
  const vol = useVolume({ value, defaultValue, onValueChange, muted: mutedProp, defaultMuted, onMutedChange });
  const [mode, setMode] = useState<"glide" | "instant">("glide");
  // Several wheel events can land before a re-render; step from the latest level, not the rendered one.
  const latest = useRef(vol.level);
  useEffect(() => {
    latest.current = vol.level;
  }, [vol.level]);
  const wheel = useWheel((steps) => {
    const next = Math.min(100, Math.max(0, latest.current + steps));
    latest.current = next;
    setMode("glide");
    vol.setVolume(next);
  }, !disabled);

  const toggle = () => {
    setMode("glide");
    // Toggle first: an optional call would skip evaluating its argument.
    const heard = vol.toggleMute();
    onValueCommitted?.(heard);
  };

  // M mutes from anywhere inside the control, as it does in most players.
  const keys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggle();
    }
  };

  const muteButton = (
    <button
      type="button"
      aria-label={label === "Volume" ? "Mute" : `Mute ${label.toLowerCase()}`}
      aria-pressed={vol.silent}
      aria-keyshortcuts="M"
      title={vol.silent ? "Unmute (M)" : "Mute (M)"}
      disabled={disabled}
      onClick={toggle}
      className={iconButton}
    >
      <VolumeIcon level={vol.level} muted={vol.muted} />
    </button>
  );

  const readout = (
    <span aria-hidden className="w-[4ch] shrink-0 text-right text-[12px] text-fg-3 tabular">
      {vol.level}%
    </span>
  );

  if (variant === "popover") {
    return (
      <div ref={wheel} onKeyDown={keys} data-variant="popover" className={cn("inline-flex", className)} {...rest}>
        <Popover.Root>
          <Popover.Trigger
            openOnHover
            delay={80}
            closeDelay={160}
            disabled={disabled}
            aria-label={label}
            className={cn(iconButton, "data-popup-open:bg-hover data-popup-open:text-fg")}
          >
            <VolumeIcon level={vol.level} muted={vol.muted} />
          </Popover.Trigger>
          <Popover.Portal container={container}>
            <Popover.Positioner side="top" sideOffset={8} className="z-(--z-popover)">
              <Popover.Popup
                ref={wheel}
                onKeyDown={keys}
                className={cn(
                  "flex w-11 origin-(--transform-origin) flex-col items-center gap-1 rounded-xl border border-line-2 bg-raised pt-2.5 pb-1 shadow-pop outline-none",
                  "transition-[opacity,scale,translate] duration-150 ease-out-expo",
                  "data-starting-style:translate-y-1 data-starting-style:scale-95 data-starting-style:opacity-0",
                  "data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-ending-style:ease-out",
                  "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
                )}
              >
                <span aria-hidden className="text-[11px] leading-4 text-fg-2 tabular">
                  {vol.level}
                </span>
                <Track
                  level={vol.level}
                  muted={vol.muted}
                  orientation="vertical"
                  disabled={disabled}
                  label={label}
                  onChange={vol.setVolume}
                  onCommit={onValueCommitted}
                  motion={mode}
                  setMotion={setMode}
                  className="h-28"
                />
                {muteButton}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    );
  }

  return (
    <div
      ref={wheel}
      role="group"
      aria-label={label}
      onKeyDown={keys}
      data-variant="inline"
      data-muted={vol.silent || undefined}
      className={cn("flex w-full min-w-0 items-center gap-1.5", className)}
      {...rest}
    >
      {muteButton}
      <Track
        level={vol.level}
        muted={vol.muted}
        orientation="horizontal"
        disabled={disabled}
        label={label}
        onChange={vol.setVolume}
        onCommit={onValueCommitted}
        motion={mode}
        setMotion={setMode}
        className="min-w-16 flex-1 px-1.5"
      />
      {showValue && readout}
    </div>
  );
}
