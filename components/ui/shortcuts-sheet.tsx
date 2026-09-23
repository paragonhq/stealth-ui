"use client";
import { Dialog } from "@base-ui/react/dialog";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Search, X } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import {
  Kbd,
  formatShortcut,
  isTypingTarget,
  matchShortcut,
  parseShortcut,
  resolveStep,
  useHeldKeys,
  usePlatform,
  type Platform,
} from "@/components/ui/kbd";
import { CommandHighlight, scoreCommand, usePaletteHotkey } from "@/components/ui/command-palette";

export type Shortcut = {
  /** "mod+k", "g i" (a sequence), "shift+?"… mod is ⌘ on a Mac and Ctrl elsewhere. */
  keys: string;
  label: string;
  /** More words that should find it. */
  keywords?: string[];
};

export type ShortcutGroup = { heading: string; shortcuts: Shortcut[] };

export type ShortcutsSheetProps = {
  groups: ShortcutGroup[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Opens and closes the sheet. Ignored while typing in a field. */
  hotkey?: string | false;
  hotkeyTarget?: React.RefObject<HTMLElement | null>;
  /** Write the keys for this platform. Defaults to the reader's, and they can switch. */
  platform?: Platform;
  /** Show the macOS / Windows switch in the header. */
  platformToggle?: boolean;
  title?: string;
  container?: Dialog.Portal.Props["container"];
  className?: string;
  children?: React.ReactNode;
};

export function ShortcutsSheet({
  groups,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  hotkey = "?",
  hotkeyTarget,
  platform: platformProp,
  platformToggle = true,
  title = "Keyboard shortcuts",
  container,
  className,
  children,
}: ShortcutsSheetProps) {
  const reduce = !!useReducedMotion();
  const detected = usePlatform(platformProp);
  const [chosen, setChosen] = useState<Platform | null>(null);
  const platform = chosen ?? detected;
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [instant, setInstant] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const contained = container != null;

  // While the sheet is open, pressing a listed shortcut lights its row and presses its keys.
  const held = useHeldKeys(open, { ignoreWhileTyping: true });

  usePaletteHotkey({
    hotkey,
    target: hotkeyTarget,
    open,
    onToggle: () => {
      setInstant(true);
      setOpen(!open);
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim();
    return groups
      .map((g) => ({
        heading: g.heading,
        shortcuts: g.shortcuts
          .map((s) => {
            // Keys are searchable by name in both spellings: "cmd", "command", "ctrl", "shift"…
            const spoken = `${formatShortcut(s.keys, "mac", { spoken: true })} ${formatShortcut(s.keys, "other", { spoken: true })} cmd ${formatShortcut(s.keys, platform)}`;
            const m = scoreCommand({ id: s.keys, label: s.label, keywords: [g.heading, ...(s.keywords ?? []), ...spoken.split(/[\s+,]+/)] }, q);
            return m ? { ...s, ranges: m.ranges } : null;
          })
          .filter((s): s is Shortcut & { ranges: [number, number][] } => s !== null),
      }))
      .filter((g) => g.shortcuts.length);
  }, [groups, query, platform]);
  const count = filtered.reduce((n, g) => n + g.shortcuts.length, 0);

  // A row lights when exactly its keys are held: ⌘↵ lights Send comment, not Open issue (↵) as well.
  const isActive = (keys: string) =>
    held.size > 0 &&
    parseShortcut(keys).some((step) => {
      const want = resolveStep(step, platform);
      return want.length === held.size && want.every((k) => held.has(k));
    });
  const activeKey = filtered.flatMap((g) => g.shortcuts).find((s) => isActive(s.keys))?.keys;

  useEffect(() => {
    if (!activeKey) return;
    scrollRef.current?.querySelector<HTMLElement>(`[data-keys="${CSS.escape(activeKey)}"]`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [activeKey, reduce]);

  // Listed shortcuts are shown, not run, while the sheet is up: they stop here instead of reaching the app.
  const listed = useMemo(() => groups.flatMap((g) => g.shortcuts.map((s) => s.keys)), [groups]);
  const onPopupKeyDown = (e: React.KeyboardEvent) => {
    const native = e.nativeEvent;
    if (native.key === "Escape" || native.key === "Tab") return;
    // "/" jumps to the search field, as it does in most apps.
    if (native.key === "/" && !isTypingTarget(native.target) && !native.metaKey && !native.ctrlKey) {
      native.preventDefault();
      e.stopPropagation();
      inputRef.current?.focus();
      return;
    }
    // The key that opened the sheet closes it again.
    if (hotkey && matchShortcut(native, hotkey, platform)) return;
    if (isTypingTarget(native.target) && !native.metaKey && !native.ctrlKey && !native.altKey) return;
    const hit = listed.some((keys) => parseShortcut(keys).some((step) => resolveStep(step, platform).includes(eventName(native))));
    if (hit && (native.metaKey || native.ctrlKey || native.altKey || !isTypingTarget(native.target))) {
      if (native.metaKey || native.ctrlKey || native.altKey) native.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        const ev = details.event as Event | undefined;
        setInstant(ev instanceof KeyboardEvent || (ev instanceof MouseEvent && ev.detail === 0));
        setOpen(next);
      }}
      onOpenChangeComplete={(isOpen) => !isOpen && setQuery("")}
    >
      {children}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop
          data-instant={instant ? "" : undefined}
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-200 ease-out-quart data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150 data-instant:transition-none",
          )}
        />
        <Dialog.Viewport className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-dialog) flex items-center justify-center p-3 sm:p-4")}>
          <Dialog.Popup
            ref={popupRef}
            tabIndex={-1}
            // Focus starts on the sheet, not the field, so pressing any shortcut shows it straight away.
            initialFocus={popupRef}
            aria-labelledby={titleId}
            data-instant={instant ? "" : undefined}
            onKeyDown={onPopupKeyDown}
            className={cn(
              "@container relative flex max-h-full w-full max-w-[720px] min-w-0 flex-col overflow-hidden rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "origin-center transition-[opacity,scale,translate] duration-[220ms] ease-out-expo",
              "data-starting-style:translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.99] data-ending-style:opacity-0 data-ending-style:duration-[140ms] data-ending-style:ease-out-quart",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              "data-instant:transition-none",
              contained ? "h-full max-h-[560px]" : "h-[min(600px,85dvh)]",
              className,
            )}
          >
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2.5 border-b border-line px-4 py-3">
              <Dialog.Title id={titleId} className="order-1 mr-auto min-w-0 flex-1 text-[14px] @max-[479px]:basis-[calc(100%-2.5rem)] font-medium tracking-[-0.015em] text-balance text-fg">
                {title}
              </Dialog.Title>
              {platformToggle && <PlatformSwitch value={platform} onChange={setChosen} reduce={reduce} className="order-5 @[480px]:order-2" />}
              <Dialog.Close
                aria-label="Close"
                className={cn(
                  "relative order-3 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
                  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92]",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "after:absolute after:-inset-2 after:content-[''] pointer-fine:after:hidden",
                )}
              >
                <X size={16} />
              </Dialog.Close>
              <label className="group/search relative order-4 flex h-8 w-full min-w-0 items-center @max-[479px]:w-auto @max-[479px]:flex-1 rounded-lg border border-line-2 bg-frame transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/8 hover:border-fg-4">
                <Search size={14} className="pointer-events-none absolute left-2.5 text-fg-3" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Escape clears a search before it closes the sheet.
                    if (e.key === "Escape" && query) {
                      e.preventDefault();
                      e.stopPropagation();
                      setQuery("");
                    }
                  }}
                  placeholder="Search"
                  aria-label="Search shortcuts"
                  aria-controls={`${titleId}-list`}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  className="peer h-full min-w-0 flex-1 bg-transparent pr-2.5 pl-8 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px] [&::-webkit-search-cancel-button]:hidden"
                />
                <Kbd keys="/" size="sm" className="mr-1.5 transition-opacity duration-150 peer-focus:opacity-0 pointer-coarse:hidden @max-[479px]:hidden" />
              </label>
            </div>

            <div ref={scrollRef} id={`${titleId}-list`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-4">
              {count === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <p className="max-w-full truncate text-[13px] text-fg-2">
                    No shortcuts match <span className="text-fg">“{query.trim()}”</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      "inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
                      "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
                      "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    )}
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="gap-x-8 @[560px]:columns-2">
                  {filtered.map((g) => (
                    <section key={g.heading} aria-label={g.heading} className="break-inside-avoid pt-4">
                      <h3 className="pb-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{g.heading}</h3>
                      <ul>
                        {g.shortcuts.map((s) => {
                          const active = activeKey === s.keys || isActive(s.keys);
                          return (
                            <li
                              key={s.keys + s.label}
                              data-keys={s.keys}
                              data-active={active ? "" : undefined}
                              className={cn(
                                "-mx-2 flex min-h-8 items-center justify-between gap-3 rounded-md px-2 py-1 text-[13px] text-fg-2",
                                "transition-[background-color,color] duration-150 data-active:bg-fg/[0.07] data-active:text-fg data-active:duration-50",
                              )}
                            >
                              <span className="min-w-0">
                                <CommandHighlight text={s.label} ranges={s.ranges} />
                              </span>
                              <Kbd keys={s.keys} size="sm" platform={platform} pressed={held} className="shrink-0" />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="flex h-10 shrink-0 items-center gap-1.5 border-t border-line px-4 text-[11.5px] text-fg-3 pointer-coarse:hidden">
              <span className="truncate">Press a shortcut to find it. It won’t run.</span>
            </div>
            <span role="status" className="sr-only">
              {query.trim() ? (count === 0 ? "No shortcuts match" : `${count} ${count === 1 ? "shortcut" : "shortcuts"}`) : ""}
            </span>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function eventName(e: KeyboardEvent) {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase().replace(/^arrow/, "");
}

function PlatformSwitch({ value, onChange, reduce, className }: { value: Platform; onChange: (p: Platform) => void; reduce: boolean; className?: string }) {
  const id = useId();
  return (
    <ToggleGroup
      aria-label="Show shortcuts for"
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0] as Platform)}
      className={cn("flex shrink-0 rounded-lg border border-line bg-frame p-0.5", className)}
    >
      {(
        [
          ["mac", "Mac"],
          ["other", "Windows"],
        ] as const
      ).map(([v, label]) => (
        <Toggle
          key={v}
          value={v}
          className={cn(
            "relative h-6 rounded-md px-2 text-[11.5px] font-medium text-fg-3 outline-none select-none",
            "transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.96] data-pressed:text-fg",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          )}
        >
          {value === v && (
            <motion.span
              layoutId={`${id}-platform`}
              transition={reduce ? { duration: 0 } : spring.snappy}
              className="absolute inset-0 rounded-md border border-line-2 bg-raised shadow-[var(--shadow)]"
            />
          )}
          <span className="relative">{label}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

export type ShortcutsSheetTriggerProps = Omit<Dialog.Trigger.Props, "children"> & { label?: string; shortcut?: string };

/** A quiet button that opens the sheet and shows its key. */
export function ShortcutsSheetTrigger({ label = "Keyboard shortcuts", shortcut = "?", className, ...rest }: ShortcutsSheetTriggerProps) {
  return (
    <Dialog.Trigger
      className={cn(
        "relative inline-flex h-8 select-none items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        typeof className === "string" ? className : undefined,
      )}
      {...rest}
    >
      {label}
      <Kbd keys={shortcut} size="sm" />
    </Dialog.Trigger>
  );
}
