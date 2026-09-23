"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Undo, Warning, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Keys: parsing, formatting, reading events                           */
/* ------------------------------------------------------------------ */

export type ShortcutPlatform = "mac" | "other";

const noop = () => () => {};
const detect = (): ShortcutPlatform => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent) ? "mac" : "other";
};
/** Mac glyphs on the server, corrected on the client right after hydration without a mismatch. */
function usePlatform(override?: ShortcutPlatform) {
  const detected = useSyncExternalStore(noop, detect, () => "mac" as ShortcutPlatform);
  return override ?? detected;
}

// "mod" is ⌘ on a Mac and Ctrl elsewhere, so one stored value works on both.
const MODS = ["mod", "ctrl", "alt", "shift", "meta"] as const;
type Mod = (typeof MODS)[number];
const isMod = (k: string): k is Mod => (MODS as readonly string[]).includes(k);

/** "shift+mod+K" → "mod+shift+k": one spelling per combo, so two combos compare as strings. */
export function normalizeShortcut(keys: string) {
  const parts = keys.toLowerCase().split("+").filter(Boolean);
  if (keys.endsWith("++")) parts.push("+");
  const mods = MODS.filter((m) => parts.includes(m));
  const key = parts.filter((p) => !isMod(p)).pop();
  return [...mods, ...(key ? [key] : [])].join("+");
}

const codeKeys: Record<string, string> = {
  Space: "space", Enter: "enter", NumpadEnter: "enter", Tab: "tab", Backspace: "backspace", Delete: "delete", Escape: "escape",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown",
  Slash: "/", Backslash: "\\", Comma: ",", Period: ".", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]",
  Minus: "-", Equal: "=", Backquote: "`",
};
const modCodes: Record<string, Mod | "os"> = {
  MetaLeft: "os", MetaRight: "os", OSLeft: "os", OSRight: "os", ControlLeft: "ctrl", ControlRight: "ctrl",
  AltLeft: "alt", AltRight: "alt", ShiftLeft: "shift", ShiftRight: "shift",
};

/** The physical key of an event, so ⌥K on a Mac is still "k" and Shift+/ is still "/". */
function eventKey(e: KeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  if (/^F\d{1,2}$/.test(e.code)) return e.code.toLowerCase();
  if (codeKeys[e.code]) return codeKeys[e.code];
  if (e.key.length === 1) return e.key.toLowerCase();
  return null;
}

/** Which modifier a held modifier key means on this platform. */
function modName(code: string, platform: ShortcutPlatform): Mod | null {
  const m = modCodes[code];
  if (!m) return null;
  if (m === "os") return platform === "mac" ? "mod" : "meta";
  if (m === "ctrl") return platform === "mac" ? "ctrl" : "mod";
  return m;
}

const macGlyph: Record<string, string> = {
  mod: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧", enter: "↵", backspace: "⌫", delete: "⌦", tab: "⇥", escape: "esc",
  up: "↑", down: "↓", left: "←", right: "→", space: "Space", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End",
};
const otherGlyph: Record<string, string> = {
  mod: "Ctrl", meta: "Win", alt: "Alt", shift: "Shift", enter: "Enter", backspace: "Backspace", delete: "Del", tab: "Tab", escape: "Esc",
  up: "↑", down: "↓", left: "←", right: "→", space: "Space", pageup: "PgUp", pagedown: "PgDn", home: "Home", end: "End",
};
const spokenNames: Record<string, [string, string]> = {
  mod: ["Command", "Control"], ctrl: ["Control", "Control"], alt: ["Option", "Alt"], shift: ["Shift", "Shift"], meta: ["Command", "Windows"],
  enter: ["Return", "Enter"], backspace: ["Delete", "Backspace"], delete: ["Forward delete", "Delete"], tab: ["Tab", "Tab"],
  up: ["Up arrow", "Up arrow"], down: ["Down arrow", "Down arrow"], left: ["Left arrow", "Left arrow"], right: ["Right arrow", "Right arrow"],
  space: ["Space", "Space"], "/": ["Slash", "Slash"], "\\": ["Backslash", "Backslash"], ",": ["Comma", "Comma"], ".": ["Period", "Period"],
};

/** Keys in the order each platform prints them: ⌃⌥⇧⌘K on a Mac, Ctrl+Alt+Shift+K elsewhere. */
function orderKeys(keys: string[], platform: ShortcutPlatform) {
  const order: string[] = platform === "mac" ? ["ctrl", "alt", "shift", "mod", "meta"] : ["mod", "meta", "alt", "shift", "ctrl"];
  return [...order.filter((m) => keys.includes(m)), ...keys.filter((k) => !isMod(k))];
}

export function keyGlyph(key: string, platform: ShortcutPlatform) {
  const g = (platform === "mac" ? macGlyph : otherGlyph)[key];
  if (g) return g;
  if (/^f\d+$/.test(key)) return key.toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1);
}

/** "mod+shift+k" → "⌘⇧K" on a Mac, "Ctrl+Shift+K" elsewhere, or spoken: "Command Shift K". */
export function formatShortcut(keys: string, platform: ShortcutPlatform, { spoken = false } = {}) {
  const list = orderKeys(normalizeShortcut(keys).split("+").filter(Boolean), platform);
  if (spoken) return list.map((k) => spokenNames[k]?.[platform === "mac" ? 0 : 1] ?? keyGlyph(k, platform)).join(" ");
  return list.map((k) => keyGlyph(k, platform)).join(platform === "mac" ? "" : "+");
}

/** Combos the browser keeps for itself: pages never receive them, so they can't be assigned. */
export const browserReservedShortcuts = ["mod+w", "mod+t", "mod+n", "mod+q", "mod+shift+w", "mod+shift+t", "mod+shift+n", "mod+tab", "mod+shift+tab"];

/* ------------------------------------------------------------------ */
/* ShortcutRecorder                                                    */
/* ------------------------------------------------------------------ */

export type TakenShortcut = { keys: string; label: string };

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; held: string[]; hint?: string }
  | { kind: "conflict"; keys: string; with: TakenShortcut };

export type ShortcutRecorderProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** What the shortcut does. Names the control for screen readers: “Search: Command K”. */
  label: string;
  /** "mod+shift+k". mod is ⌘ on a Mac and Ctrl elsewhere. null means not set. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** The shortcut it ships with. When the value differs, a reset button brings it back. */
  resetValue?: string | null;
  /** Shortcuts other actions already use. Recording one asks before taking it. */
  taken?: TakenShortcut[];
  /** Called when the person chooses to take a shortcut from another action; unassign it there. */
  onReplace?: (conflict: TakenShortcut) => void;
  /** Combos that can't be assigned. Defaults to the ones browsers keep for themselves. */
  reserved?: string[];
  /** Allow a plain key with no modifier, like C or /. F-keys are always allowed. */
  allowSingleKey?: boolean;
  disabled?: boolean;
  /** Write the keys for this platform instead of the one detected. */
  platform?: ShortcutPlatform;
  size?: "sm" | "md";
  placeholder?: string;
};

export function ShortcutRecorder({
  label,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  resetValue,
  taken = [],
  onReplace,
  reserved = browserReservedShortcuts,
  allowSingleKey = false,
  disabled = false,
  platform: platformProp,
  size = "md",
  placeholder = "Not set",
  className,
  ...rest
}: ShortcutRecorderProps) {
  const platform = usePlatform(platformProp);
  const reduce = !!useReducedMotion();
  const uid = useId();
  const [value, setValue] = useControllableState<string | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [saved, setSaved] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const recorderRef = useRef<HTMLButtonElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);

  const recording = phase.kind === "recording";
  const current = value ? normalizeShortcut(value) : null;
  const canReset = resetValue !== undefined && (resetValue ? normalizeShortcut(resetValue) : null) !== current;
  const say = (keys: string) => formatShortcut(keys, platform, { spoken: true });

  // The tick after a save stays for a beat, then the field is plain again.
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(0), 1400);
    return () => window.clearTimeout(t);
  }, [saved]);

  const commit = (keys: string | null) => {
    setPhase({ kind: "idle" });
    if (keys === current) return;
    setValue(keys);
    if (keys) setSaved((n) => n + 1);
    setAnnouncement(keys ? `${label} set to ${say(keys)}` : `${label} shortcut cleared`);
  };

  // The key listener lives for the whole recording; it reads the latest props through this ref.
  const latest = useRef({ platform, allowSingleKey, reserved, taken, current, commit, say });
  useEffect(() => {
    latest.current = { platform, allowSingleKey, reserved, taken, current, commit, say };
  });

  // While recording, every key goes to the recorder first: ⌘K must not open the page's palette.
  useEffect(() => {
    if (!recording) return;
    const held = new Map<string, string>();
    const show = (hint?: string) => setPhase({ kind: "recording", held: [...new Set(held.values())], hint });

    const down = (e: KeyboardEvent) => {
      const { platform, allowSingleKey, reserved, taken, current, commit, say } = latest.current;
      const noMods = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
      // Tab still moves focus (and blur ends recording); Escape cancels; Backspace alone clears.
      if (e.key === "Tab" && noMods) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (e.key === "Escape" && noMods) {
        setPhase({ kind: "idle" });
        setAnnouncement("Recording cancelled");
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && noMods) {
        commit(null);
        return;
      }
      const mod = modName(e.code, platform);
      if (mod) {
        held.set(e.code, mod);
        show();
        return;
      }
      const key = eventKey(e);
      if (!key) return;
      const mods: string[] = [];
      if (platform === "mac") {
        if (e.metaKey) mods.push("mod");
        if (e.ctrlKey) mods.push("ctrl");
      } else {
        if (e.ctrlKey) mods.push("mod");
        if (e.metaKey) mods.push("meta");
      }
      if (e.altKey) mods.push("alt");
      if (e.shiftKey) mods.push("shift");
      const keys = normalizeShortcut([...mods, key].join("+"));
      // Shift alone only types a capital, so it doesn't count as a modifier.
      const strong = mods.some((m) => m !== "shift");
      if (!strong && !allowSingleKey && !/^f\d+$/.test(key)) {
        const hint = platform === "mac" ? "Add ⌘, ⌥ or ⌃ to the key" : "Add Ctrl or Alt to the key";
        held.clear();
        show(hint);
        setAnnouncement(hint);
        return;
      }
      if (reserved.some((r) => normalizeShortcut(r) === keys)) {
        const hint = `${formatShortcut(keys, platform)} belongs to the browser. Try another.`;
        held.clear();
        show(hint);
        setAnnouncement(hint);
        return;
      }
      const clash = taken.find((t) => normalizeShortcut(t.keys) === keys);
      if (clash && keys !== current) {
        setPhase({ kind: "conflict", keys, with: clash });
        setAnnouncement(`${say(keys)} is already used for ${clash.label}. Replace it, or cancel.`);
        return;
      }
      commit(keys);
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) show();
      // macOS sends no keyup for keys released while ⌘ is held; ⌘ letting go releases everything.
      if (e.key === "Meta" && held.size) {
        held.clear();
        show();
      }
    };
    const blur = () => setPhase({ kind: "idle" });
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
    };
  }, [recording]);

  // A conflict hands focus to Replace, so Enter takes the shortcut and Escape backs out.
  useEffect(() => {
    if (phase.kind === "conflict") replaceRef.current?.focus();
  }, [phase.kind]);

  const cancelConflict = () => {
    setPhase({ kind: "idle" });
    recorderRef.current?.focus();
  };

  const shown = phase.kind === "recording" ? phase.held : phase.kind === "conflict" ? phase.keys.split("+") : current ? current.split("+") : [];
  const keys = orderKeys(shown, platform);
  const message = phase.kind === "recording" ? phase.hint : undefined;
  const sm = size === "sm";

  return (
    <div className={cn("flex w-full min-w-0 flex-col", className)} {...rest}>
      <div
        data-state={phase.kind}
        data-disabled={disabled || undefined}
        className={cn(
          "group/field relative flex min-w-0 items-center rounded-lg border bg-raised shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow] duration-150",
          sm ? "h-7 rounded-md" : "h-8",
          phase.kind === "recording"
            ? "border-fg-4 ring-3 ring-fg/10"
            : phase.kind === "conflict"
              ? "border-warning/60 ring-3 ring-warning/15"
              : "border-line-2 has-[[data-recorder]:hover]:border-fg-4 has-[[data-recorder]:focus-visible]:border-fg-4 has-[[data-recorder]:focus-visible]:ring-3 has-[[data-recorder]:focus-visible]:ring-fg/10",
          disabled && "opacity-50",
        )}
      >
        <button
          ref={recorderRef}
          type="button"
          data-recorder=""
          disabled={disabled}
          aria-label={
            recording ? `Recording a shortcut for ${label}. Press the keys, or Escape to cancel.` : `${label}: ${current ? say(current) : "not set"}. Press to change.`
          }
          aria-describedby={message ? `${uid}-msg` : undefined}
          onClick={() => {
            if (phase.kind === "recording") {
              setPhase({ kind: "idle" });
              return;
            }
            setPhase({ kind: "recording", held: [] });
            setAnnouncement("Recording. Press the new shortcut.");
          }}
          onBlur={(e) => {
            // Leaving the field ends recording; moving to a conflict's buttons doesn't.
            if (phase.kind === "recording" && !e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget)) setPhase({ kind: "idle" });
          }}
          className={cn(
            "relative flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-[inherit] text-left outline-none select-none",
            sm ? "pl-1.5 pr-1" : "pl-2 pr-1",
            "disabled:cursor-not-allowed",
          )}
        >
          {recording && (
            <span aria-hidden className="relative grid size-2 shrink-0 place-items-center">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-danger/60 motion-reduce:hidden" />
              <span className="size-1.5 rounded-full bg-danger" />
            </span>
          )}
          <span className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              {keys.map((k) => (
                <motion.span
                  key={k}
                  layout={reduce ? false : "position"}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                  className="flex"
                >
                  <Cap k={k} platform={platform} pressed={recording} tone={phase.kind === "conflict" ? "warning" : "default"} sm={sm} />
                </motion.span>
              ))}
            </AnimatePresence>
            {keys.length === 0 && (
              <span className={cn("truncate", sm ? "text-[12px]" : "text-[12.5px]", recording ? "text-fg-2" : "text-fg-4")}>
                {recording ? "Press a shortcut" : placeholder}
              </span>
            )}
          </span>
        </button>

        <span className="flex shrink-0 items-center pr-1">
          <AnimatePresence initial={false} mode="popLayout">
            {saved > 0 && phase.kind === "idle" ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="grid size-6 place-items-center text-success"
              >
                <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
                  />
                </svg>
              </motion.span>
            ) : (
              phase.kind === "idle" &&
              !disabled && (
                <motion.span
                  key="actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="flex items-center"
                >
                  {canReset && (
                    <IconButton label={resetValue ? `Reset ${label} to ${say(resetValue)}` : `Reset ${label}`} onClick={() => commit(resetValue ? normalizeShortcut(resetValue) : null)} sm={sm}>
                      <Undo size={sm ? 12 : 14} />
                    </IconButton>
                  )}
                  {current && (
                    <IconButton label={`Clear the ${label} shortcut`} onClick={() => commit(null)} sm={sm}>
                      <X size={sm ? 12 : 14} />
                    </IconButton>
                  )}
                </motion.span>
              )
            )}
          </AnimatePresence>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {(message || phase.kind === "conflict") && (
          <motion.div
            key="message"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="overflow-hidden"
          >
            <div id={`${uid}-msg`} className="flex items-start gap-1.5 pb-1 pt-1.5 text-[12px] leading-4 text-warning">
              <Warning size={13} className="mt-px shrink-0" />
              {phase.kind === "conflict" ? (
                <div
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelConflict();
                    }
                  }}
                >
                  <span className="min-w-0 text-pretty">
                    Already used for <span className="font-medium">{phase.with.label}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageButton
                      ref={replaceRef}
                      onClick={() => {
                        onReplace?.(phase.with);
                        commit(phase.keys);
                        recorderRef.current?.focus();
                      }}
                    >
                      {onReplace ? "Replace" : "Use anyway"}
                    </MessageButton>
                    <MessageButton onClick={cancelConflict}>Cancel</MessageButton>
                  </span>
                </div>
              ) : (
                <span className="min-w-0 text-pretty">{message}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function Cap({ k, platform, pressed, tone, sm }: { k: string; platform: ShortcutPlatform; pressed: boolean; tone: "default" | "warning"; sm: boolean }) {
  const glyph = keyGlyph(k, platform);
  const symbol = /^[⌘⇧⌥⌃↵⌫⌦⇥↑↓←→]$/.test(glyph);
  return (
    <kbd
      data-pressed={pressed || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[5px] border font-sans font-medium leading-none",
        sm ? "h-[18px] min-w-[18px] px-1 text-[10.5px]" : "h-5 min-w-5 px-1.5 text-[11px]",
        symbol && (sm ? "text-[11.5px]" : "text-[12.5px]"),
        // A keycap has a lip; held keys sink onto it.
        "transition-[translate,box-shadow,background-color,color,border-color] duration-100",
        tone === "warning"
          ? "border-warning/40 bg-warning-soft text-warning shadow-[inset_0_-1px_0_var(--warning-soft)]"
          : "border-line-2 bg-frame text-fg-2 shadow-[inset_0_-1px_0_var(--line-2)]",
        "data-pressed:translate-y-px data-pressed:text-fg data-pressed:shadow-none",
      )}
    >
      {glyph}
    </kbd>
  );
}

function IconButton({ label, onClick, sm, children }: { label: string; onClick: () => void; sm: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-md text-fg-3 outline-none",
        "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        sm ? "size-5" : "size-6",
      )}
    >
      {children}
    </button>
  );
}

function MessageButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "relative h-6 rounded-md px-1.5 text-[12px] font-medium text-fg outline-none",
        "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.96] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
        "before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
        className,
      )}
      {...props}
    />
  );
}
