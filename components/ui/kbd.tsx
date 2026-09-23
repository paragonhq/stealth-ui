"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Platform                                                            */
/* ------------------------------------------------------------------ */

export type Platform = "mac" | "other";

function detectPlatform(): Platform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const hint = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  return /mac|iphone|ipad|ipod/i.test(hint) ? "mac" : "other";
}

const noop = () => () => {};

/**
 * The platform the shortcuts should be written for. The server has no way to
 * know, so it renders the Mac glyphs and the client corrects them right after
 * hydration, without a mismatch warning.
 */
export function usePlatform(override?: Platform): Platform {
  const detected = useSyncExternalStore(noop, detectPlatform, () => "mac" as Platform);
  return override ?? detected;
}

/* ------------------------------------------------------------------ */
/* Parsing and formatting                                              */
/* ------------------------------------------------------------------ */

const alias: Record<string, string> = {
  cmd: "meta", command: "meta", meta: "meta", "⌘": "meta", win: "meta", super: "meta",
  ctrl: "ctrl", control: "ctrl", "⌃": "ctrl",
  alt: "alt", option: "alt", opt: "alt", "⌥": "alt",
  shift: "shift", "⇧": "shift",
  enter: "enter", return: "enter", "↵": "enter", "↩": "enter",
  esc: "esc", escape: "esc",
  backspace: "backspace", "⌫": "backspace",
  del: "delete", delete: "delete", "⌦": "delete",
  space: "space", spacebar: "space",
  tab: "tab", "⇥": "tab",
  up: "up", arrowup: "up", "↑": "up",
  down: "down", arrowdown: "down", "↓": "down",
  left: "left", arrowleft: "left", "←": "left",
  right: "right", arrowright: "right", "→": "right",
  pageup: "pageup", pgup: "pageup", pagedown: "pagedown", pgdn: "pagedown",
  home: "home", end: "end", capslock: "capslock", caps: "capslock",
  plus: "+", comma: ",", period: ".", slash: "/",
};

const MODIFIERS = ["mod", "ctrl", "alt", "shift", "meta"] as const;
const isModifier = (k: string) => (MODIFIERS as readonly string[]).includes(k);

/** "mod+shift+p" → [["mod","shift","p"]]; "g i" → [["g"],["i"]]. Steps are pressed one after another. */
export function parseShortcut(keys: string | string[]): string[][] {
  if (Array.isArray(keys)) return [keys.map(normalizeKey)];
  return keys
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) => {
      // "mod++" means mod and the plus key.
      const parts = step === "+" ? ["+"] : step.endsWith("++") ? [...step.slice(0, -2).split("+"), "+"] : step.split("+");
      return parts.filter(Boolean).map(normalizeKey);
    });
}

export function normalizeKey(key: string) {
  const k = key.trim();
  const lower = k.toLowerCase();
  return alias[lower] ?? (k.length === 1 ? lower : lower);
}

/** Resolves "mod" and sorts modifiers in the order each platform prints them (⌃⌥⇧⌘ on a Mac, Ctrl+Alt+Shift elsewhere). */
export function resolveStep(step: string[], platform: Platform) {
  const resolved = step.map((k) => (k === "mod" ? (platform === "mac" ? "meta" : "ctrl") : k));
  const order = platform === "mac" ? ["ctrl", "alt", "shift", "meta"] : ["ctrl", "meta", "alt", "shift"];
  const mods = order.filter((m) => resolved.includes(m));
  const rest = resolved.filter((k) => !isModifier(k));
  return [...mods, ...rest];
}

const macGlyph: Record<string, string> = {
  meta: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧", enter: "↵", backspace: "⌫", delete: "⌦", esc: "esc", tab: "⇥",
  space: "Space", up: "↑", down: "↓", left: "←", right: "→", capslock: "⇪", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End",
};
const otherGlyph: Record<string, string> = {
  meta: "Win", ctrl: "Ctrl", alt: "Alt", shift: "Shift", enter: "Enter", backspace: "Backspace", delete: "Del", esc: "Esc", tab: "Tab",
  space: "Space", up: "↑", down: "↓", left: "←", right: "→", capslock: "Caps", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End",
};
const spoken: Record<string, [mac: string, other: string]> = {
  meta: ["Command", "Windows"], ctrl: ["Control", "Control"], alt: ["Option", "Alt"], shift: ["Shift", "Shift"],
  enter: ["Return", "Enter"], backspace: ["Delete", "Backspace"], delete: ["Forward delete", "Delete"], esc: ["Escape", "Escape"],
  tab: ["Tab", "Tab"], space: ["Space", "Space"], up: ["Up arrow", "Up arrow"], down: ["Down arrow", "Down arrow"],
  left: ["Left arrow", "Left arrow"], right: ["Right arrow", "Right arrow"], capslock: ["Caps lock", "Caps lock"],
  pageup: ["Page up", "Page up"], pagedown: ["Page down", "Page down"], home: ["Home", "Home"], end: ["End", "End"],
  "+": ["Plus", "Plus"], "?": ["Question mark", "Question mark"], "/": ["Slash", "Slash"], ".": ["Period", "Period"], ",": ["Comma", "Comma"],
};

export function keyLabel(key: string, platform: Platform) {
  const table = platform === "mac" ? macGlyph : otherGlyph;
  if (table[key]) return table[key];
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

export function keyName(key: string, platform: Platform) {
  const s = spoken[key];
  if (s) return platform === "mac" ? s[0] : s[1];
  return key.length === 1 ? key.toUpperCase() : key;
}

/** A plain-text rendering for titles, tooltips and screen readers: "⌘⇧P" / "Ctrl+Shift+P", or spoken: "Command Shift P". */
export function formatShortcut(keys: string | string[], platform: Platform, { spoken: speak = false } = {}) {
  return parseShortcut(keys)
    .map((step) => {
      const r = resolveStep(step, platform);
      if (speak) return r.map((k) => keyName(k, platform)).join(" ");
      return r.map((k) => keyLabel(k, platform)).join(platform === "mac" ? "" : "+");
    })
    .join(speak ? ", then " : " then ");
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

/** The key an event is about, in the same names parseShortcut uses. Letters and digits come from the physical key so ⌥K on a Mac is still "k". */
export function eventKey(e: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  const named: Record<string, string> = { Meta: "meta", OS: "meta", Control: "ctrl", Alt: "alt", Shift: "shift", " ": "space" };
  return named[e.key] ?? normalizeKey(e.key);
}

/** Whether a keydown is exactly this single-step shortcut: every modifier matches, none extra. */
export function matchShortcut(e: KeyboardEvent, keys: string | string[], platform: Platform) {
  const steps = parseShortcut(keys);
  if (steps.length !== 1) return false;
  const step = resolveStep(steps[0], platform);
  const main = step.find((k) => !isModifier(k));
  if (!main || eventKey(e) !== main) return false;
  // Symbols that need Shift to type ("?", "!") match whether or not Shift is listed.
  const shiftFree = main.length === 1 && !/[a-z0-9]/.test(main);
  return (
    e.metaKey === step.includes("meta") &&
    e.ctrlKey === step.includes("ctrl") &&
    e.altKey === step.includes("alt") &&
    (shiftFree || e.shiftKey === step.includes("shift"))
  );
}

/** Whether focus is somewhere that typing matters (fields, editors). Single-key shortcuts should stand down there. */
export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

/**
 * The keys held down right now, by name. macOS never sends keyup for a key
 * pressed while ⌘ is held, so those release themselves shortly after the last
 * keydown (auto-repeat keeps a held key held), and everything lets go when ⌘ does.
 */
export function useHeldKeys(enabled = true, { ignoreWhileTyping = false } = {}) {
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!enabled) return;
    const down = new Map<string, string>();
    const timers = new Map<string, number>();
    const commit = () => setHeld(new Set(down.values()));
    const release = (code: string) => {
      window.clearTimeout(timers.get(code));
      timers.delete(code);
      if (down.delete(code)) commit();
    };
    const clear = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      if (down.size) {
        down.clear();
        commit();
      }
    };
    const onDown = (e: KeyboardEvent) => {
      const name = eventKey(e);
      // Plain typing in a field isn't a shortcut; holding a modifier makes it one.
      if (ignoreWhileTyping && isTypingTarget(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) return;
      const code = e.code || name;
      if (down.get(code) !== name) {
        down.set(code, name);
        commit();
      }
      if (e.metaKey && !isModifier(name)) {
        window.clearTimeout(timers.get(code));
        timers.set(code, window.setTimeout(() => release(code), 350));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const name = eventKey(e);
      if (name === "meta") {
        // Everything pressed under ⌘ is released with it.
        for (const [code, n] of down) if (!isModifier(n)) release(code);
      }
      release(e.code || name);
    };
    const onVisibility = () => document.hidden && clear();
    // Capture, so a component that stops a shortcut from propagating still shows it pressed.
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [enabled, ignoreWhileTyping]);
  return enabled ? held : EMPTY;
}

const EMPTY: ReadonlySet<string> = new Set();

/* ------------------------------------------------------------------ */
/* Kbd                                                                 */
/* ------------------------------------------------------------------ */

export type KbdSize = "sm" | "md" | "lg";
export type KbdVariant = "keycap" | "ghost";

export type KbdProps = Omit<React.ComponentProps<"kbd">, "children"> & {
  /** "mod+k", "shift+?", "g i" (a sequence), or an array of keys for one combo. "mod" is ⌘ on a Mac and Ctrl elsewhere. */
  keys?: string | string[];
  /** A single literal key, when you'd rather write it yourself. Ignored when keys is set. */
  children?: React.ReactNode;
  size?: KbdSize;
  /** A raised keycap, or quiet glyphs for menus and highlighted rows. */
  variant?: KbdVariant;
  /** Draw a combo in one cap (⌘⇧P) instead of one cap per key. */
  joined?: boolean;
  /** Write the keys for this platform instead of the one detected. */
  platform?: Platform;
  /** Press the caps down while the real keys are held. */
  listen?: boolean;
  /** Called when the whole shortcut (every step of a sequence) is pressed while listening. */
  onMatch?: (event: KeyboardEvent) => void;
  /** Force the pressed look: true for every cap, or the set of key names held (from useHeldKeys). */
  pressed?: boolean | ReadonlySet<string>;
};

const capSize: Record<KbdSize, string> = {
  sm: "h-[18px] min-w-[18px] rounded-[5px] px-1 text-[10.5px]",
  md: "h-5 min-w-5 rounded-[5px] px-1.5 text-[11px]",
  lg: "h-7 min-w-7 rounded-[7px] px-2 text-[13px]",
};
const gapSize: Record<KbdSize, string> = { sm: "gap-0.5", md: "gap-1", lg: "gap-1.5" };
const GLYPH = /^[⌘⇧⌥⌃↵⌫⌦⇥↑↓←→⇪]$/;

export function Kbd({
  keys,
  children,
  size = "md",
  variant = "keycap",
  joined = false,
  platform: platformProp,
  listen = false,
  onMatch,
  pressed,
  className,
  ...rest
}: KbdProps) {
  const platform = usePlatform(platformProp);
  const own = useHeldKeys(listen);
  const steps = keys != null ? parseShortcut(keys).map((s) => resolveStep(s, platform)) : [];
  const held = pressed instanceof Set ? pressed : own;
  const isDown = (k: string) => pressed === true || held.has(k);

  // Sequences and full combos report once per press, only while listening.
  const progress = useRef({ step: 0, at: 0 });
  const onMatchRef = useRef(onMatch);
  useEffect(() => {
    onMatchRef.current = onMatch;
  });
  const signature = steps.map((s) => s.join("+")).join(" ");
  useEffect(() => {
    if (!listen || !signature) return;
    const parsed = signature.split(" ").map((s) => s.split("+"));
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const p = progress.current;
      if (performance.now() - p.at > 1200) p.step = 0;
      const want = parsed[p.step];
      const combo = want.filter(isModifier);
      const main = want.find((k) => !isModifier(k));
      const ok =
        eventKey(e) === main &&
        e.metaKey === combo.includes("meta") &&
        e.ctrlKey === combo.includes("ctrl") &&
        e.altKey === combo.includes("alt") &&
        (e.shiftKey === combo.includes("shift") || (main.length === 1 && !/[a-z0-9]/.test(main)));
      if (!ok) {
        p.step = 0;
        return;
      }
      p.at = performance.now();
      p.step += 1;
      if (p.step === parsed.length) {
        p.step = 0;
        onMatchRef.current?.(e);
      }
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [listen, signature]);

  const label = keys != null ? formatShortcut(keys, platform, { spoken: true }) : undefined;

  // Symbol keys (⌘ ⇧ ↵ ↑) sit small in a mono face; draw them from the sans at a size that matches the letters' cap height.
  const face = (k: string) => {
    const text = keyLabel(k, platform);
    return GLYPH.test(text) ? (
      <span className="font-sans text-[1.2em] leading-none">{text}</span>
    ) : (
      text
    );
  };

  const cap = (content: React.ReactNode, down: boolean, key: string | number, single = false) => (
    <kbd
      key={key}
      data-pressed={down ? "" : undefined}
      data-single={single ? "" : undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-mono font-medium leading-none tabular",
        // Press is a 50ms drop, release a 150ms lift: the key feels sprung, not animated.
        "transition-[translate,box-shadow,background-color,border-color,color] duration-150 ease-out-quart data-pressed:duration-50",
        variant === "keycap"
          ? cn(
              capSize[size],
              // One-character caps are squares; words get padding.
              "data-single:px-0",
              // A face a step lighter than whatever it sits on, and a 2px lower edge.
              "border border-line-2 bg-fg/[0.035] text-fg-2",
              size === "lg" ? "shadow-[inset_0_-2px_0_var(--line-2)]" : "shadow-[inset_0_-1px_0_var(--line-2)]",
              "data-pressed:translate-y-px data-pressed:border-fg-4 data-pressed:bg-fg/[0.09] data-pressed:text-fg data-pressed:shadow-none",
              "motion-reduce:data-pressed:translate-y-0",
            )
          : cn("text-fg-3 data-pressed:text-fg", size === "lg" ? "text-[13px]" : size === "md" ? "text-[11.5px]" : "text-[11px]"),
      )}
    >
      {content}
    </kbd>
  );

  let body: React.ReactNode;
  if (keys == null) {
    body = cap(children, pressed === true, 0, typeof children === "string" && [...children].length === 1);
  } else {
    body = steps.map((step, i) => (
      <span key={i} className={cn("inline-flex items-center", gapSize[size])}>
        {i > 0 && <span className={cn("font-sans font-normal text-fg-4", size === "lg" ? "mx-1 text-[12px]" : "mx-0.5 text-[11px]")}>then</span>}
        {joined || variant === "ghost"
          ? cap(
              <span className={cn("inline-flex items-center", platform === "mac" ? "gap-px" : "gap-0")}>
                {step.map((k, j) => (
                  <span key={j} className="inline-flex items-center">
                    {platform !== "mac" && j > 0 && <span className="mx-px text-fg-4">+</span>}
                    {face(k)}
                  </span>
                ))}
              </span>,
              step.every(isDown),
              i,
            )
          : step.map((k, j) => cap(face(k), isDown(k), `${i}-${j}`, [...keyLabel(k, platform)].length === 1))}
      </span>
    ));
  }

  return (
    <kbd
      data-size={size}
      data-variant={variant}
      data-listening={listen ? "" : undefined}
      className={cn("inline-flex items-center align-middle font-normal", gapSize[size], className)}
      {...rest}
    >
      {label ? (
        <>
          <span aria-hidden className={cn("inline-flex items-center", gapSize[size])}>
            {body}
          </span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        body
      )}
    </kbd>
  );
}
