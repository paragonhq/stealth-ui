"use client";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Minus, Plus } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/** Where a zoom change came from, so a canvas can animate buttons but follow pinches 1:1. */
export type ZoomChangeReason = "button" | "preset" | "input" | "shortcut" | "wheel";

// The ladder the buttons walk, the same stops browsers use.
const LADDER = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const ROLL = { duration: 380, easing: `cubic-bezier(${ease.out.join(",")})` };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (v: number) => Math.round(v * 100);
const round = (v: number) => Math.round(v * 100) / 100;

// ⌘ on Apple platforms, Ctrl elsewhere. The server renders Ctrl; the client corrects it without a mismatch.
const subscribe = () => () => {};
const useModKey = () =>
  useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl "),
    () => "Ctrl ",
  );

function nextStop(value: number, dir: 1 | -1, ladder: number[]) {
  const eps = 0.001;
  return dir > 0 ? ladder.find((s) => s > value + eps) : [...ladder].reverse().find((s) => s < value - eps);
}

export type ZoomControlProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** Scale, where 1 is 100%. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number, reason: ZoomChangeReason) => void;
  min?: number;
  max?: number;
  /** Stops the minus and plus buttons walk through. */
  steps?: number[];
  /** Quick picks in the menu. */
  presets?: number[];
  /** The scale that fits your content; adds "Zoom to fit" (Shift+1) when set. */
  fitValue?: number;
  /** The canvas. Ctrl/⌘ + wheel and trackpad pinch over it zoom, and ⌘+ ⌘− ⌘0 Shift+1 work while focus is inside it. */
  target?: React.RefObject<HTMLElement | null>;
  size?: "sm" | "md";
  /** Which side the menu opens on. Use "top" for a control docked at the bottom of a canvas. */
  side?: "top" | "bottom";
  disabled?: boolean;
};

type Option = { key: string; label: string; hint?: string; value: number; selected?: boolean };

export function ZoomControl({
  value: valueProp,
  defaultValue = 1,
  onValueChange,
  min = 0.1,
  max = 4,
  steps = LADDER,
  presets = [0.5, 1, 2],
  fitValue,
  target,
  size = "md",
  side = "bottom",
  disabled = false,
  className,
  ...rest
}: ZoomControlProps) {
  const reason = useRef<ZoomChangeReason>("button");
  const [value, setInner] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange: (v: number) => onValueChange?.(v, reason.current),
  });
  const set = (v: number, why: ZoomChangeReason) => {
    reason.current = why;
    setInner(clamp(round(v), min, max));
  };

  const mod = useModKey();
  const reduce = useReducedMotion();
  const ladder = steps.filter((s) => s >= min && s <= max);
  const canOut = !disabled && value > min + 0.001;
  const canIn = !disabled && value < max - 0.001;
  const zoomBy = (dir: 1 | -1, why: ZoomChangeReason) => {
    const stop = nextStop(value, dir, ladder);
    set(stop ?? (dir > 0 ? max : min), why);
  };

  // Pinches and Ctrl+wheel arrive as a stream; the readout stops rolling while
  // they last so the digits keep up with the hand.
  const [streaming, setStreaming] = useState(false);
  const live = useRef({ value, set, zoomBy, fitValue, disabled });
  useEffect(() => {
    live.current = { value, set, zoomBy, fitValue, disabled };
  });

  useEffect(() => {
    const el = target?.current;
    if (!el) return;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || live.current.disabled) return;
      e.preventDefault();
      // Trackpad pinches send small deltas, mouse notches ±100; clamping keeps a notch to ~28%.
      const d = clamp(e.deltaY, -25, 25);
      live.current.set(live.current.value * Math.exp(-d * 0.01), "wheel");
      setStreaming(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setStreaming(false), 220);
    };
    const onKey = (e: KeyboardEvent) => {
      const l = live.current;
      if (l.disabled) return;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && (e.key === "=" || e.key === "+")) l.zoomBy(1, "shortcut");
      else if (cmd && e.key === "-") l.zoomBy(-1, "shortcut");
      else if (cmd && e.key === "0") l.set(1, "shortcut");
      else if (e.shiftKey && !cmd && e.code === "Digit1" && l.fitValue !== undefined) {
        if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable=true]")) return;
        l.set(l.fitValue, "shortcut");
      } else return;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [target]);

  // Hold minus or plus to keep zooming: one step on press, then a step every 90ms after 400ms.
  const repeat = useRef<{ t: number; i: number }>({ t: 0, i: 0 });
  const stopRepeat = () => {
    window.clearTimeout(repeat.current.t);
    window.clearInterval(repeat.current.i);
  };
  useEffect(() => stopRepeat, []);
  const pressHandlers = (dir: 1 | -1, enabled: boolean) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      live.current.zoomBy(dir, "button");
      stopRepeat();
      repeat.current.t = window.setTimeout(() => {
        repeat.current.i = window.setInterval(() => live.current.zoomBy(dir, "button"), 90);
      }, 400);
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
    // Enter and Space arrive as a click with no pointer (detail 0).
    onClick: (e: React.MouseEvent) => {
      if (enabled && e.detail === 0) zoomBy(dir, "button");
    },
  });

  // Stop repeating the moment a bound is reached.
  useEffect(() => {
    if (value <= min + 0.001 || value >= max - 0.001) stopRepeat();
  }, [value, min, max]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1);
  const [via, setVia] = useState<"pointer" | "keyboard">("pointer");
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const errorId = `${uid}-error`;

  const options: Option[] = [
    { key: "in", label: "Zoom in", hint: `${mod}+`, value: nextStop(value, 1, ladder) ?? max },
    { key: "out", label: "Zoom out", hint: `${mod}−`, value: nextStop(value, -1, ladder) ?? min },
    ...(fitValue !== undefined ? [{ key: "fit", label: "Zoom to fit", hint: "⇧1", value: fitValue, selected: pct(fitValue) === pct(value) }] : []),
    ...presets.map((p) => ({ key: `p${p}`, label: `${pct(p)}%`, hint: p === 1 ? `${mod}0` : undefined, value: p, selected: pct(p) === pct(value) })),
  ];

  const onOpenChange = (next: boolean) => {
    if (next) {
      setText(String(pct(value)));
      setError(false);
      setActive(-1);
    }
    setOpen(next);
  };

  const choose = (o: Option) => {
    set(o.value, "preset");
    setOpen(false);
  };

  const commitText = () => {
    const n = parseFloat(text.replace(/[%\s,]/g, ""));
    if (!Number.isFinite(n)) {
      setError(true);
      inputRef.current?.select();
      return;
    }
    // Out-of-range numbers clamp rather than fail: 900 means "as far as it goes".
    set(n / 100, "input");
    setOpen(false);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setVia("keyboard");
      const n = options.length;
      // -1 is the input itself; the list wraps through it.
      setActive((i) => (e.key === "ArrowDown" ? (i + 1 >= n ? -1 : i + 1) : i - 1 < -1 ? n - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(options[active]);
      else commitText();
    }
  };

  const h = size === "sm" ? "h-6" : "h-7";
  const iconBtn = cn(
    "relative grid shrink-0 place-items-center rounded-md text-fg-2",
    size === "sm" ? "size-6" : "size-7",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
    "transition-[background-color,color,scale,opacity] duration-150 ease-out active:scale-[0.92] active:duration-75",
    "hover:bg-hover hover:text-fg",
    "aria-disabled:pointer-events-none aria-disabled:opacity-40",
    // Invisible 44px target on touch screens.
    "[@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-2",
  );
  const tipPopup =
    "flex items-center gap-2 rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] text-fg shadow-pop origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-out-expo data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[ending-style]:duration-100 data-[instant]:transition-none";

  const button = (dir: 1 | -1) => {
    const enabled = dir > 0 ? canIn : canOut;
    const label = dir > 0 ? "Zoom in" : "Zoom out";
    return (
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          aria-label={label}
          aria-disabled={!enabled || undefined}
          className={iconBtn}
          {...pressHandlers(dir, enabled)}
        >
          {dir > 0 ? <Plus size={size === "sm" ? 14 : 16} /> : <Minus size={size === "sm" ? 14 : 16} />}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side={side} sideOffset={8} className="z-(--z-tooltip)">
            <Tooltip.Popup className={tipPopup}>
              {label}
              <kbd className="font-mono text-[11px] text-fg-3">{dir > 0 ? `${mod}+` : `${mod}−`}</kbd>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  };

  return (
    <Tooltip.Provider delay={500}>
      <div
        role="group"
        aria-label="Zoom"
        data-size={size}
        data-disabled={disabled || undefined}
        className={cn(
          "inline-flex items-center gap-px rounded-lg border border-line-2 bg-raised p-0.5 shadow-[var(--shadow)]",
          disabled && "opacity-50",
          className,
        )}
        {...rest}
      >
        {button(-1)}

        <Popover.Root open={open} onOpenChange={onOpenChange}>
          <Popover.Trigger
            disabled={disabled}
            aria-label={`Zoom level ${pct(value)}%`}
            className={cn(
              "group/level flex items-center justify-center gap-0.5 rounded-md pl-1.5 pr-1 text-[12.5px] font-medium text-fg",
              h,
              size === "sm" ? "w-[58px]" : "w-[64px]",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              "transition-[background-color,scale] duration-150 ease-out hover:bg-hover active:scale-[0.97] active:duration-75 data-[popup-open]:bg-hover",
            )}
          >
            <NumberFlow
              value={pct(value)}
              suffix="%"
              animated={!streaming}
              transformTiming={ROLL}
              spinTiming={ROLL}
              className="tabular"
            />
            <ChevronDown
              size={12}
              className="shrink-0 text-fg-3 transition-transform duration-150 ease-out group-data-[popup-open]/level:rotate-180 motion-reduce:transition-none"
            />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side={side} sideOffset={6} align="center" className="z-(--z-popover)">
              <Popover.Popup
                initialFocus={inputRef}
                className={cn(
                  "w-[212px] rounded-xl border border-line-2 bg-raised p-1 shadow-pop outline-none",
                  "origin-[var(--transform-origin)] transition-[opacity,scale,translate] duration-150 ease-out-expo",
                  "data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0",
                  "data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[ending-style]:duration-100",
                  "motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 items-center rounded-lg border bg-frame pl-2.5 pr-2 transition-[border-color,box-shadow] duration-150",
                    "focus-within:ring-2 focus-within:ring-fg/10",
                    error ? "border-danger focus-within:ring-danger/20" : "border-line-2 focus-within:border-fg-4",
                  )}
                >
                  <input
                    ref={inputRef}
                    role="combobox"
                    aria-label="Zoom percentage"
                    aria-expanded
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${uid}-${options[active].key}` : undefined}
                    aria-invalid={error || undefined}
                    aria-describedby={error ? errorId : undefined}
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    spellCheck={false}
                    value={text}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      setText(e.target.value);
                      setError(false);
                      setActive(-1);
                    }}
                    onKeyDown={onInputKey}
                    className="tabular min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
                  />
                  <span aria-hidden className="text-[13px] text-fg-3">
                    %
                  </span>
                </div>
                {error && (
                  <p id={errorId} role="alert" className="px-1.5 pt-1.5 text-[11.5px] leading-[1.4] text-danger">
                    Enter a number, like 150
                  </p>
                )}

                <LayoutGroup id={uid}>
                  <div
                    id={listId}
                    role="listbox"
                    aria-label="Zoom presets"
                    onPointerLeave={() => setActive(-1)}
                    className="mt-1 flex flex-col"
                  >
                    {options.map((o, i) => (
                      <div key={o.key} className="contents">
                        {(o.key === "fit" || (o.key === `p${presets[0]}` && fitValue === undefined)) && (
                          <div role="separator" className="mx-1.5 my-1 h-px bg-line" />
                        )}
                        <div
                          id={`${uid}-${o.key}`}
                          role="option"
                          aria-selected={!!o.selected}
                          onPointerMove={() => {
                            if (active !== i) {
                              setVia("pointer");
                              setActive(i);
                            }
                          }}
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => choose(o)}
                          className="relative flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] text-fg"
                        >
                          {active === i && (
                            // One highlight glides between rows; arrow keys move it without easing.
                            <motion.span
                              layoutId="zoom-highlight"
                              aria-hidden
                              className="absolute inset-0 rounded-md bg-hover"
                              transition={via === "keyboard" || reduce ? { duration: 0 } : spring.follow}
                            />
                          )}
                          <span className="relative grid size-4 place-items-center text-fg">
                            {o.selected && <Check size={14} />}
                          </span>
                          <span className="relative flex-1">{o.label}</span>
                          {o.hint && <kbd className="relative font-mono text-[11px] text-fg-3">{o.hint}</kbd>}
                        </div>
                      </div>
                    ))}
                  </div>
                </LayoutGroup>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        {button(1)}
      </div>
    </Tooltip.Provider>
  );
}
