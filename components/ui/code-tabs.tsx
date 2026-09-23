"use client";
import { Tabs } from "@base-ui/react/tabs";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { CodeLines, Hint, resolveLanguage, tokenize, useSideScroll } from "@/components/ui/code-block";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * A preference shared by every instance with the same key: on this page through an event,
 * in other tabs through the storage event, and across visits through localStorage.
 * -----------------------------------------------------------------------------------------------*/

const EVENT = "stealth:preference";
const storageKey = (key: string) => `stealth:${key}`;

function read(key: string) {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    return null; // Private windows and blocked storage: behave as if nothing was saved.
  }
}

/** Reads and writes a synced preference. Returns null until a value has been chosen (and always on the server). */
export function usePreference(key: string | undefined) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!key) return () => {};
      const onStorage = (e: StorageEvent) => e.key === storageKey(key) && notify();
      const onLocal = (e: Event) => (e as CustomEvent<{ key: string }>).detail?.key === key && notify();
      window.addEventListener("storage", onStorage);
      window.addEventListener(EVENT, onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(EVENT, onLocal);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      if (!key) return;
      try {
        localStorage.setItem(storageKey(key), next);
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, value: next } }));
    },
    [key],
  );
  return [value, set] as const;
}

/* -------------------------------------------------------------------------------------------------
 * CodeTabs
 * -----------------------------------------------------------------------------------------------*/

export type CodeTabsItem = {
  value: string;
  label: React.ReactNode;
  code: string;
  /** Language name, alias or extension. Falls back to the filename's extension, then plain text. */
  lang?: string;
  /** Shown beside the copy button while this tab is active. */
  filename?: string;
  /** 14px icon before the label. */
  icon?: React.ReactNode;
};

export type CodeTabsProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  items: CodeTabsItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * Shares the choice with every CodeTabs using the same key, in this tab, in other tabs,
   * and on the next visit. Use "package-manager" for install commands.
   */
  syncKey?: string;
  lineNumbers?: boolean;
  /** Accessible name for the tab list, e.g. "Package manager". */
  label?: string;
};

export function CodeTabs({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  syncKey,
  lineNumbers = false,
  label = "Code variant",
  className,
  onKeyDownCapture,
  onPointerDownCapture,
  ...rest
}: CodeTabsProps) {
  const reduce = useReducedMotion();
  const [synced, setSynced] = usePreference(syncKey);
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value);
  const has = (v: string | null | undefined): v is string => !!v && items.some((i) => i.value === v);
  // The prop wins, then the shared choice (if this block offers it), then this block's own state.
  const value = valueProp !== undefined ? valueProp : has(synced) ? synced : has(inner) ? inner : items[0]?.value;
  const active = items.find((i) => i.value === value) ?? items[0];

  // One gutter width for every tab, so switching from a 9-line to a 10-line snippet doesn't nudge the code.
  const digits = String(Math.max(...items.map((i) => i.code.replace(/\n$/, "").split("\n").length))).length;
  const list = useRef<HTMLDivElement>(null);
  const overflows = useSideScroll(list);

  const change = (next: string) => {
    if (next === value) return;
    setInner(next);
    setSynced(next);
    onValueChange?.(next);
  };

  if (!active) return null;

  return (
    <Tabs.Root
      value={value}
      onValueChange={(v) => change(String(v))}
      // Pointer switches animate; arrow keys and changes synced from elsewhere land on the same frame.
      onKeyDownCapture={(e) => {
        e.currentTarget.dataset.nav = "key";
        onKeyDownCapture?.(e);
      }}
      onPointerDownCapture={(e) => {
        e.currentTarget.dataset.nav = "pointer";
        onPointerDownCapture?.(e);
      }}
      className={cn("group/ct flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <div className="relative flex h-10 shrink-0 items-stretch pr-1.5 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-line">
        <Tabs.List
          ref={list}
          aria-label={label}
          activateOnFocus
          className={cn(
            "relative flex min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            overflows && "[mask-image:linear-gradient(to_left,transparent,var(--fg)_var(--fade-end,0px))]",
          )}
        >
          {items.map((item) => (
            <Tabs.Tab
              key={item.value}
              value={item.value}
              className={cn(
                "group/tab relative flex shrink-0 select-none items-center px-2.5 outline-none",
                "touch-manipulation [-webkit-tap-highlight-color:transparent]",
                "text-[12.5px] font-medium tracking-[-0.005em] text-fg-3 transition-colors duration-150 hover:text-fg-2 data-active:text-fg",
                "data-disabled:pointer-events-none data-disabled:text-fg-4",
              )}
            >
              <span
                className={cn(
                  "-mx-1 flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 outline-offset-2",
                  "transition-[scale] duration-150 ease-out-quart group-active/tab:scale-[0.96] group-active/tab:duration-75",
                  "group-focus-visible/tab:outline-solid group-focus-visible/tab:outline-1 group-focus-visible/tab:outline-fg-3",
                )}
              >
                {item.icon && <span className="grid shrink-0 place-items-center text-fg-4 transition-colors group-data-active/tab:text-fg-2 [&_svg]:size-3.5">{item.icon}</span>}
                {item.label}
              </span>
            </Tabs.Tab>
          ))}
          <Tabs.Indicator
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 z-[1] h-px translate-x-(--active-tab-left) bg-fg",
              // Inset to the label, so the line sits under the word and not the padding.
              "ml-2.5 w-[calc(var(--active-tab-width)-20px)]",
              "transition-none group-data-[nav=pointer]/ct:transition-[translate,width] group-data-[nav=pointer]/ct:duration-[240ms] group-data-[nav=pointer]/ct:ease-in-out-quart",
              "motion-reduce:transition-none",
            )}
          />
        </Tabs.List>

        <div className="flex shrink-0 items-center gap-2 pl-2">
          {items.some((i) => i.filename) && (
            // Every filename shares one cell, so the header never shifts as they swap.
            <span className="hidden font-mono text-[11.5px] text-fg-3 sm:grid">
              {items.map((i) => (
                <span key={i.value} aria-hidden className="invisible col-start-1 row-start-1 text-right">
                  {i.filename}
                </span>
              ))}
              <AnimatePresence initial={false}>
                <motion.span
                  key={active.value}
                  className="col-start-1 row-start-1 text-right"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
                >
                  {active.filename}
                </motion.span>
              </AnimatePresence>
            </span>
          )}
          <Tooltip.Provider delay={500}>
            <Hint label="Copy code">
              <CopyButton value={active.code.replace(/\n$/, "")} iconOnly variant="ghost" size="sm" label="Copy code" />
            </Hint>
          </Tooltip.Provider>
        </div>
      </div>

      <Panels>
        {items.map((item) => (
          <Tabs.Panel
            key={item.value}
            value={item.value}
            className={cn(
              "col-start-1 row-start-1 min-w-0 outline-none",
              "transition-opacity duration-200 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
              "group-data-[nav=key]/ct:transition-none",
            )}
          >
            <Code item={item} lineNumbers={lineNumbers} minDigits={digits} />
          </Tabs.Panel>
        ))}
      </Panels>
    </Tabs.Root>
  );
}

// Glides between panels of different heights instead of snapping.
function Panels({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.26, ease: ease.inOut }}
      className="overflow-hidden"
    >
      <div ref={inner} className="grid">
        {children}
      </div>
    </motion.div>
  );
}

function Code({ item, lineNumbers, minDigits }: { item: CodeTabsItem; lineNumbers: boolean; minDigits: number }) {
  const scroller = useRef<HTMLPreElement>(null);
  const overflows = useSideScroll(scroller);
  const lines = useMemo(() => tokenize(item.code, resolveLanguage(item.lang, item.filename)), [item.code, item.lang, item.filename]);
  return (
    <pre
      ref={scroller}
      tabIndex={overflows ? 0 : undefined}
      className={cn(
        "m-0 overflow-x-auto overscroll-x-contain py-3 outline-none",
        "focus-visible:shadow-[inset_0_0_0_1px_var(--fg-3)]",
        "[mask-image:linear-gradient(to_left,transparent,var(--fg)_var(--fade-end,0px))]",
      )}
    >
      <CodeLines lines={lines} lineNumbers={lineNumbers} minDigits={minDigits} />
    </pre>
  );
}
