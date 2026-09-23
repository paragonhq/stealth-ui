"use client";
import { Input as BaseInput } from "@base-ui/react/input";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Loader, Search, X } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SearchFieldProps = Omit<React.ComponentProps<"input">, "size" | "value" | "defaultValue" | "type"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called with the query when Enter is pressed. */
  onSearch?: (query: string) => void;
  /** Swaps the magnifier for a spinner. Waits 150ms before showing and holds 300ms once shown, so fast results never flash. */
  loading?: boolean;
  /** Focuses the field from anywhere: "mod+k" (⌘K on Mac, Ctrl K elsewhere) or a single key like "/" that never fires while typing. false for none. */
  shortcut?: string | false;
  /** Starts as a square icon button and springs open to full width; folds back when it loses focus empty. */
  collapsible?: boolean;
  size?: "sm" | "md" | "lg";
  /** Classes for the inner input; `className` styles the outer box. */
  inputClassName?: string;
};

const subscribe = () => () => {};
const isMacNow = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
function useIsMac() {
  return useSyncExternalStore(subscribe, isMacNow, () => true);
}

/** Holds a busy flag back for `delay` ms and keeps it for at least `min` ms once shown. */
export function useDelayedBusy(busy: boolean, { delay = 150, min = 300 } = {}) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    let t: number;
    if (busy && !shown) {
      t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, delay);
    } else if (!busy && shown) {
      const left = Math.max(0, min - (performance.now() - since.current));
      t = window.setTimeout(() => setShown(false), left);
    }
    return () => window.clearTimeout(t);
  }, [busy, shown, delay, min]);
  return shown;
}

function parseShortcut(s: string) {
  const parts = s.toLowerCase().split("+");
  return { mod: parts.includes("mod"), shift: parts.includes("shift"), key: parts[parts.length - 1] };
}

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

const sizes = {
  // Left padding centers the icon in the folded square, so opening never nudges it.
  sm: { box: "h-7 rounded-md pl-1.5 pr-1 gap-1.5 text-base sm:text-[12.5px]", square: 28, icon: 14 },
  md: { box: "h-8 rounded-lg pl-[7px] pr-1.5 gap-2 text-base sm:text-[13px]", square: 32, icon: 16 },
  lg: { box: "h-9 rounded-lg pl-[9px] pr-2 gap-2 text-base sm:text-[13px]", square: 36, icon: 16 },
};

export function SearchField({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onSearch,
  loading = false,
  shortcut = "mod+k",
  collapsible = false,
  size = "md",
  placeholder = "Search",
  disabled,
  className,
  inputClassName,
  onKeyDown,
  onBlur,
  ref,
  ...rest
}: SearchFieldProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const mac = useIsMac();
  const busy = useDelayedBusy(loading);
  const inner = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(!collapsible || defaultValue !== "");
  // Opening from the keyboard is instant; opening from a press gets the spring.
  const [instant, setInstant] = useState(false);
  const expanded = !collapsible || open || value !== "";
  const s = sizes[size];

  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    if (!shortcut || disabled) return;
    const want = parseShortcut(shortcut);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const mod = mac ? e.metaKey : e.ctrlKey;
      if (e.key.toLowerCase() !== want.key || mod !== want.mod || e.shiftKey !== want.shift || e.altKey) return;
      if (!want.mod && (isTyping(document.activeElement) || e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setInstant(true);
      setOpen(true);
      // The field may still be mounting its open state; focus on the next frame.
      requestAnimationFrame(() => {
        inner.current?.focus();
        inner.current?.select();
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut, disabled, mac]);

  const hint = shortcut
    ? (() => {
        const p = parseShortcut(shortcut);
        const key = p.key.length === 1 ? p.key.toUpperCase() : p.key;
        return `${p.mod ? (mac ? "⌘" : "Ctrl ") : ""}${p.shift ? (mac ? "⇧" : "Shift ") : ""}${key}`;
      })()
    : null;

  const clear = () => {
    setValue("");
    inner.current?.focus();
  };

  const showClear = value !== "" && !disabled;
  const width = expanded ? "100%" : s.square;

  return (
    <div className={cn("flex w-full min-w-0", collapsible && "justify-end")}>
      <motion.div
        data-slot="search-field"
        data-size={size}
        data-state={expanded ? "open" : "closed"}
        data-disabled={disabled || undefined}
        initial={false}
        animate={{ width }}
        transition={instant || reduce ? { duration: 0 } : spring.snappy}
        onAnimationComplete={() => setInstant(false)}
        className={cn(
          "group/search relative flex min-w-0 items-center overflow-hidden border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow,background-color,scale] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
          "data-[state=closed]:hover:bg-hover data-[state=closed]:active:scale-[0.94] data-[state=closed]:active:duration-75",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none data-disabled:hover:border-line-2",
          s.box,
          !collapsible && "w-full",
          className,
        )}
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("input, button") || disabled) return;
          e.preventDefault();
          inner.current?.focus();
        }}
      >
        {/* Magnifier and spinner share one box, so the text never moves when loading starts. */}
        <span aria-hidden className="relative grid shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-focus-within/search:text-fg-2" style={{ width: s.icon, height: s.icon }}>
          <AnimatePresence initial={false}>
            <motion.span
              key={busy ? "busy" : "idle"}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {busy ? <Loader size={s.icon} className="animate-spin" /> : <Search size={s.icon} />}
            </motion.span>
          </AnimatePresence>
        </span>

        <BaseInput
          ref={setRef}
          type="search"
          value={value}
          onValueChange={(next) => setValue(next)}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={rest["aria-label"] ?? (rest["aria-labelledby"] ? undefined : placeholder)}
          aria-busy={loading || undefined}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          tabIndex={expanded ? undefined : -1}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (e.key === "Escape") {
              // First Escape empties the field; the next one lets go of it.
              if (e.currentTarget.value) {
                e.preventDefault();
                e.stopPropagation();
                setValue("");
              } else {
                e.currentTarget.blur();
              }
            } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              onSearch?.(e.currentTarget.value);
            }
          }}
          onBlur={(e) => {
            onBlur?.(e);
            if (collapsible && !e.currentTarget.value) setOpen(false);
          }}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-inherit outline-none placeholder:text-fg-4 disabled:cursor-not-allowed",
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
            "transition-opacity duration-150 group-data-[state=closed]/search:pointer-events-none group-data-[state=closed]/search:opacity-0",
            inputClassName,
          )}
          {...rest}
        />

        {/* Hint and clear stack in one cell: the hint says how to get here, the clear says how to start over. */}
        <span className="grid shrink-0 place-items-center justify-items-end transition-opacity duration-150 group-data-[state=closed]/search:opacity-0">
          {hint && (
            <kbd
              aria-hidden
              data-state={showClear ? "hidden" : "visible"}
              className={cn(
                "col-start-1 row-start-1 inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 font-mono text-[10.5px] leading-none text-fg-3 pointer-coarse:hidden",
                "transition-[opacity,scale,filter] duration-200 ease-out-expo",
                "data-[state=hidden]:scale-75 data-[state=hidden]:opacity-0 data-[state=hidden]:blur-[2px] data-[state=hidden]:duration-100",
                "motion-reduce:data-[state=hidden]:scale-100 motion-reduce:data-[state=hidden]:blur-none",
              )}
            >
              {hint}
            </kbd>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear search"
            inert={!showClear}
            data-state={showClear ? "visible" : "hidden"}
            onClick={clear}
            className={cn(
              "relative col-start-1 row-start-1 grid size-5 place-items-center rounded-[5px] text-fg-3 outline-none",
              "before:absolute before:-inset-1.5 before:content-[''] pointer-coarse:before:-inset-3",
              "hover:bg-hover hover:text-fg active:scale-[0.88]",
              "transition-[opacity,scale,filter,background-color,color] duration-200 ease-out-expo",
              "data-[state=hidden]:pointer-events-none data-[state=hidden]:scale-75 data-[state=hidden]:opacity-0 data-[state=hidden]:blur-[2px] data-[state=hidden]:duration-100",
              "motion-reduce:data-[state=hidden]:scale-100 motion-reduce:data-[state=hidden]:blur-none",
            )}
          >
            <X size={size === "sm" ? 12 : 14} />
          </button>
        </span>

        {collapsible && !expanded && (
          // While folded, the whole square is one button that opens the field.
          <button
            type="button"
            aria-label={rest["aria-label"] ?? (typeof placeholder === "string" ? placeholder : "Search")}
            aria-expanded={false}
            disabled={disabled}
            onClick={() => {
              setInstant(false);
              setOpen(true);
              requestAnimationFrame(() => inner.current?.focus());
            }}
            className="absolute inset-0 rounded-[inherit] outline-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid"
          />
        )}
      </motion.div>
    </div>
  );
}
