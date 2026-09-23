"use client";
import { Combobox } from "@base-ui/react/combobox";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronsUpDown, Loader, Plus, Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type Workspace = {
  id: string;
  name: string;
  /** Plan or role, shown under the name in the trigger and beside it in the list: "Pro", "Free trial". */
  plan?: string;
  /** Extra detail for the trigger's second line: "24 members". */
  detail?: string;
  /** An image URL or your own mark. Without one, the first letter sits on a neutral tile. */
  logo?: string | React.ReactNode;
  disabled?: boolean;
};

type Row = Workspace & { create?: true };
const CREATE = "__create__";

export type WorkspaceSwitcherProps = Omit<React.ComponentProps<"button">, "value" | "defaultValue" | "onChange"> & {
  workspaces: Workspace[];
  /** The current workspace id. Pair with onValueChange to control it. */
  value?: string;
  defaultValue?: string;
  /**
   * Called with the chosen id. Return a promise to show the switch as pending: the trigger
   * spins until it settles, and a rejection puts the previous workspace back.
   */
  onValueChange?: (id: string, workspace: Workspace) => void | Promise<unknown>;
  /** Adds a create row. Receives whatever was typed in the search, or "" from the plain row. */
  onCreate?: (name: string) => void;
  /**
   * The modifier for the 1–9 shortcuts, or false for none. Browsers keep ⌘1–9 for their own tabs,
   * so a web app usually wants "alt" or "ctrl"; "mod" (⌘ on a Mac, Ctrl elsewhere) suits desktop shells.
   */
  shortcut?: "mod" | "alt" | "ctrl" | false;
  /** One line, no plan: for a top bar rather than a sidebar. */
  compact?: boolean;
  /** Portal container for the popup. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
};

/**
 * The workspace in the corner of a sidebar: its mark, name and plan, and one press away
 * from every other workspace you belong to, searchable, with number shortcuts.
 */
export function WorkspaceSwitcher({
  workspaces,
  value: valueProp,
  defaultValue,
  onValueChange,
  onCreate,
  shortcut = "mod",
  compact = false,
  container,
  disabled,
  className,
  ...rest
}: WorkspaceSwitcherProps) {
  const reduce = !!useReducedMotion();
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? workspaces[0]?.id ?? "" });
  const current = workspaces.find((w) => w.id === value) ?? workspaces[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // +1 when the new workspace sits below the old one in the list, -1 above: the trigger rolls that way.
  const [dir, setDir] = useState(1);
  const mac = useIsMac();
  const failTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(failTimer.current), []);

  const choose = async (next: Workspace) => {
    if (!current || pending || next.id === current.id || next.disabled) return;
    const prev = current;
    setDir(workspaces.indexOf(next) >= workspaces.indexOf(prev) ? 1 : -1);
    setFailed(null);
    window.clearTimeout(failTimer.current);
    setValue(next.id);
    const result = onValueChange?.(next.id, next);
    if (!(result instanceof Promise)) return setAnnounce(`Switched to ${next.name}`);
    setPending(next.id);
    try {
      await result;
      setAnnounce(`Switched to ${next.name}`);
    } catch {
      setDir(-1 * (workspaces.indexOf(next) >= workspaces.indexOf(prev) ? 1 : -1));
      setValue(prev.id);
      setFailed(next.name);
      setAnnounce(`Couldn’t switch to ${next.name}. Still in ${prev.name}.`);
      failTimer.current = window.setTimeout(() => setFailed(null), 4000);
    } finally {
      setPending(null);
    }
  };

  // Number shortcuts work from anywhere, except while typing in someone else's field.
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  useEffect(() => {
    if (!shortcut || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const want = shortcut === "alt" ? e.altKey : shortcut === "ctrl" ? e.ctrlKey : mac ? e.metaKey : e.ctrlKey;
      const others = (shortcut !== "alt" && e.altKey) || (shortcut === "alt" && (e.metaKey || e.ctrlKey)) || e.shiftKey;
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1];
      if (!want || others || !digit) return;
      const t = e.target as HTMLElement | null;
      const typing = t?.closest("input, textarea, [contenteditable=true]") && !t.closest("[data-workspace-switcher]");
      if (typing) return;
      const target = workspaces[Number(digit) - 1];
      if (!target) return;
      e.preventDefault();
      setOpen(false);
      void chooseRef.current(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, disabled, mac, workspaces]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? workspaces.filter((w) => w.name.toLowerCase().includes(q)) : workspaces), [workspaces, q]);
  const createRow = useMemo<Row>(() => ({ id: CREATE, name: query.trim(), create: true }), [query]);
  const exact = workspaces.some((w) => w.name.toLowerCase() === q);
  const rows: Row[] = onCreate && !exact ? [...matches, createRow] : matches;
  const keyLabel = shortcut === "alt" ? (mac ? "⌥" : "Alt+") : shortcut === "ctrl" ? (mac ? "⌃" : "Ctrl+") : mac ? "⌘" : "Ctrl+";
  const { setScroller, y, height, opacity } = useGlide(reduce);

  if (!current) return null;
  const busy = pending !== null;
  // While a switch is pending the trigger already shows where you're going, controlled or not.
  const shown = (pending && workspaces.find((w) => w.id === pending)) || current;
  const second = failed ? "Couldn’t switch. Try again" : [shown.plan, shown.detail].filter(Boolean).join(" · ");

  return (
    <Combobox.Root<Row>
      items={onCreate ? [...workspaces, createRow] : workspaces}
      filteredItems={rows}
      value={shown}
      onValueChange={(next) => {
        if (!next) return;
        if (next.create) return onCreate?.(query.trim());
        void choose(next);
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      autoHighlight
      disabled={disabled}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(w) => w.name}
      itemToStringValue={(w) => w.id}
    >
      <Combobox.Trigger
        data-workspace-switcher=""
        aria-label={`Workspace: ${shown.name}. Switch workspace`}
        aria-busy={busy || undefined}
        className={cn(
          "group/ws relative flex w-full min-w-0 select-none items-center gap-2.5 rounded-lg px-1.5 text-left outline-none",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          compact ? "h-8 gap-2" : "h-11",
          "transition-[background-color,scale] duration-150 ease-out hover:bg-hover data-popup-open:bg-hover active:scale-[0.98] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          className,
        )}
        {...rest}
      >
        <span className={cn("relative grid shrink-0", compact ? "size-5" : "size-7")}>
          <AnimatePresence initial={false} custom={dir}>
            <motion.span
              key={shown.id}
              custom={dir}
              variants={roll(reduce, compact ? 8 : 12)}
              initial="enter"
              animate="center"
              exit="exit"
              className="col-start-1 row-start-1"
            >
              <Logo workspace={shown} size={compact ? 20 : 28} />
            </motion.span>
          </AnimatePresence>
          <AnimatePresence>
            {busy && (
              <motion.span
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={cn("absolute inset-0 grid place-items-center bg-raised/80 text-fg", compact ? "rounded-[5px]" : "rounded-md")}
              >
                <Loader size={compact ? 12 : 14} className="animate-spin motion-reduce:animate-[spin_2s_linear_infinite]" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <span className="grid min-w-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={dir}>
            <motion.span
              key={shown.id}
              custom={dir}
              variants={roll(reduce, compact ? 8 : 14)}
              initial="enter"
              animate="center"
              exit="exit"
              className="col-start-1 row-start-1 flex min-w-0 flex-col justify-center"
            >
              <span className="truncate text-[13px] font-medium leading-[18px] tracking-[-0.01em] text-fg">{shown.name}</span>
              {!compact && second && (
                <span title={failed ? `Couldn’t switch to ${failed}` : undefined} className={cn("truncate text-[11.5px] leading-[15px] transition-colors", failed ? "text-danger" : "text-fg-3")}>
                  {second}
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>

        <ChevronsUpDown size={14} className="shrink-0 text-fg-4 transition-colors group-hover/ws:text-fg-3 group-data-popup-open/ws:text-fg-2" />
      </Combobox.Trigger>

      <span role="status" aria-live="polite" className="sr-only">{announce}</span>

      <Combobox.Portal container={container}>
        <Combobox.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Combobox.Popup
            aria-label="Switch workspace"
            data-workspace-switcher=""
            className={cn(
              "w-[max(var(--anchor-width),17rem)] max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-180 ease-out-expo data-ending-style:duration-120 data-ending-style:ease-out",
              "data-starting-style:scale-96 data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0",
              "data-[side=top]:data-starting-style:translate-y-1",
              "motion-reduce:scale-100 motion-reduce:translate-none",
            )}
          >
            <label className="flex h-10 items-center gap-2 border-b border-line px-3 text-fg-3">
              <Search size={14} className="shrink-0" />
              <Combobox.Input
                placeholder="Find a workspace"
                aria-label="Find a workspace"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
              />
            </label>

            <div ref={setScroller} className="relative max-h-[min(var(--available-height),18rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1">
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-fg/[0.06]" />
              {matches.length > 0 && (
                <div className="flex h-7 items-center justify-between px-2 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">
                  <span>Workspaces</span>
                  <span className="tabular">{matches.length}</span>
                </div>
              )}
              {!matches.length && (
                <p className="truncate px-2 py-3 text-[12.5px] text-fg-3">
                  No workspace matches <span className="text-fg-2">“{query.trim()}”</span>
                </p>
              )}
              <Combobox.List className="outline-none">
                {(w: Row) =>
                  w.create ? (
                    <Combobox.Item
                      key={CREATE}
                      value={w}
                      className={cn(itemClass, matches.length > 0 && "mt-1 before:absolute before:inset-x-1 before:-top-[3px] before:h-px before:bg-line")}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-[5px] border border-dashed border-line-2 text-fg-3 transition-colors group-data-highlighted/item:border-fg-4 group-data-highlighted/item:text-fg">
                        <Plus size={12} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg-2 group-data-highlighted/item:text-fg">
                        {w.name ? <>Create <span className="text-fg">“{w.name}”</span></> : "Create workspace"}
                      </span>
                    </Combobox.Item>
                  ) : (
                    <Combobox.Item key={w.id} value={w} disabled={w.disabled} className={itemClass}>
                      <Logo workspace={w} size={20} />
                      <span className="min-w-0 flex-1 truncate">{w.name}</span>
                      {w.plan && <span className="shrink-0 text-[11.5px] text-fg-4">{w.plan}</span>}
                      <span className="grid h-5 min-w-7 shrink-0 place-items-center">
                        {w.id === shown.id ? (
                          busy ? (
                            <Loader size={13} className="animate-spin text-fg-2" />
                          ) : (
                            <DrawnCheck reduce={reduce} />
                          )
                        ) : (
                          shortcut &&
                          workspaces.indexOf(w) < 9 && (
                            <kbd className="font-mono text-2xs text-fg-4 tabular pointer-coarse:hidden">
                              {keyLabel}
                              {workspaces.indexOf(w) + 1}
                            </kbd>
                          )
                        )}
                      </span>
                    </Combobox.Item>
                  )
                }
              </Combobox.List>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const itemClass = cn(
  "group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-10",
  "data-disabled:text-fg-4 data-disabled:[&_*]:text-fg-4",
);

// The trigger rolls like a drum: the old workspace leaves the way the list runs, the new one arrives from the other side.
const roll = (reduce: boolean, distance: number) => ({
  enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d * distance, filter: "blur(2px)" }),
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: reduce ? { duration: 0.15 } : { duration: 0.32, ease: ease.out } },
  exit: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: d * -distance, filter: "blur(2px)", transition: { duration: 0.2, ease: ease.out } }),
});

/** The workspace's mark: its image, your node, or its first letter on a neutral tile. */
export function WorkspaceLogo({ workspace, size = 20, className }: { workspace: Workspace; size?: number; className?: string }) {
  return <Logo workspace={workspace} size={size} className={className} />;
}

function Logo({ workspace, size, className }: { workspace: Workspace; size: number; className?: string }) {
  const radius = size >= 28 ? "rounded-md" : "rounded-[5px]";
  const box = cn("grid shrink-0 place-items-center overflow-hidden", radius, className);
  const style = { width: size, height: size };
  if (typeof workspace.logo === "string")
    // eslint-disable-next-line @next/next/no-img-element -- a plain image keeps the component portable
    return <img src={workspace.logo} alt="" width={size} height={size} style={style} className={cn(box, "object-cover")} />;
  if (workspace.logo)
    return (
      <span aria-hidden style={style} className={cn(box, "bg-fg text-frame [&_svg]:size-[62%]")}>
        {workspace.logo}
      </span>
    );
  return (
    <span aria-hidden style={{ ...style, fontSize: Math.round(size * 0.46) }} className={cn(box, "border border-line-2 bg-hover font-semibold leading-none text-fg-2")}>
      {workspace.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg">
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: ease.out, delay: 0.06 }}
      />
    </svg>
  );
}

const noop = () => () => {};
function useIsMac() {
  return useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );
}

// One highlight for the list: it glides after the pointer and jumps for arrow keys and
// filtering, so keyboard use never waits on an animation.
function useGlide(reduce: boolean) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!scroller) return;
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = scroller.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.12 }));
        return;
      }
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== scroller; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
      }
      opacity.jump(el.hasAttribute("data-disabled") ? 0.45 : 1);
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(scroller, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    scroller.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      scroller.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [scroller, reduce, y, height, opacity]);

  return { setScroller, y, height, opacity };
}
