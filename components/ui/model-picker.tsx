"use client";
import { Select } from "@base-ui/react/select";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown, Lock } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Data
 * -----------------------------------------------------------------------------------------------*/

export type ModelCapability = "vision" | "tools" | "reasoning" | "long-context" | "web" | "code";

export type Model = {
  value: string;
  name: string;
  /** One line on what it's for. Truncates, so lead with the point. */
  description?: string;
  capabilities?: ModelCapability[];
  /** 1 slow · 2 balanced · 3 fast. */
  speed?: 1 | 2 | 3;
  /** 1 cheap · 2 moderate · 3 expensive. */
  cost?: 1 | 2 | 3;
  /** A short tag after the name, like "New" or "Beta". */
  tag?: string;
  /** Rows with the same group sit together under that label. */
  group?: string;
  disabled?: boolean;
  /** Why it can't be picked. Replaces the description on a disabled row. */
  disabledReason?: string;
  icon?: React.ReactNode;
};

const capabilityLabel: Record<ModelCapability, string> = {
  vision: "Vision",
  tools: "Tools",
  reasoning: "Reasoning",
  "long-context": "Long context",
  web: "Web",
  code: "Code",
};
const speedLabel = ["", "Slower", "Balanced", "Fast"];
const costLabel = ["", "Low cost", "Moderate cost", "High cost"];

/* -------------------------------------------------------------------------------------------------
 * Picker
 * -----------------------------------------------------------------------------------------------*/

export type ModelPickerProps = {
  models: Model[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name for the trigger. The visible label is the model's name. */
  label?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  /** A key that opens the picker together with ⌘ (Ctrl elsewhere), e.g. "/". It needs the modifier, so it works while typing. */
  shortcut?: string;
  disabled?: boolean;
  /** Portal target. Defaults to document.body. */
  container?: Select.Portal.Props["container"];
  className?: string;
};

export function ModelPicker({
  models,
  value,
  defaultValue,
  onValueChange,
  label = "Model",
  size = "sm",
  variant = "ghost",
  side = "bottom",
  align = "start",
  shortcut,
  disabled,
  container,
  className,
}: ModelPickerProps) {
  const [inner, setInner] = useState<string | null>(defaultValue ?? models.find((m) => !m.disabled)?.value ?? null);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const [open, setOpen] = useState(false);
  const reduce = !!useReducedMotion();
  const byValue = useMemo(() => new Map(models.map((m) => [m.value, m])), [models]);
  const selected = current ? byValue.get(current) : undefined;
  const groups = useMemo(() => groupBy(models), [models]);
  const apple = useApple();

  // The new name arrives from where it sat in the list: picked below slides up, above slides down.
  const order = models.map((m) => m.value);
  const [shown, setShown] = useState({ value: current, dir: 1 });
  if (shown.value !== current) setShown({ value: current, dir: order.indexOf(current ?? "") < order.indexOf(shown.value ?? "") ? -1 : 1 });

  // ⌘ + key opens it from anywhere, instantly.
  useEffect(() => {
    if (!shortcut || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === shortcut.toLowerCase()) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, disabled]);

  return (
    <Select.Root<string>
      value={current}
      onValueChange={(next) => {
        if (next == null) return;
        if (!controlled) setInner(next);
        onValueChange?.(next);
      }}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      items={models.map((m) => ({ value: m.value, label: m.name }))}
    >
      <Select.Trigger
        aria-label={label}
        data-size={size}
        data-variant={variant}
        aria-keyshortcuts={shortcut ? `Meta+${shortcut.toUpperCase()}` : undefined}
        className={cn(
          "group/trigger relative inline-flex max-w-full shrink-0 select-none items-center font-medium tracking-[-0.005em] text-fg-2 outline-none",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "hover:text-fg data-popup-open:text-fg data-disabled:pointer-events-none data-disabled:opacity-50",
          size === "sm" ? "h-7 gap-1.5 rounded-md pl-2 pr-1.5 text-[12.5px]" : "h-8 gap-1.5 rounded-lg pl-2.5 pr-2 text-[13px]",
          variant === "ghost"
            ? "hover:bg-hover data-popup-open:bg-hover"
            : "border border-line-2 bg-raised shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4",
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']",
          className,
        )}
      >
        {selected?.icon && <span className="grid size-4 shrink-0 place-items-center text-fg-3 [&_svg]:size-3.5">{selected.icon}</span>}
        <TriggerLabel id={current ?? ""} dir={shown.dir} reduce={reduce}>
          {selected?.name ?? "Choose a model"}
        </TriggerLabel>
        <Select.Icon className="grid shrink-0 place-items-center text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/trigger:rotate-180 motion-reduce:transition-none">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal container={container}>
        <Select.Positioner
          alignItemWithTrigger={false}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-(--z-popover) outline-none select-none"
        >
          <Select.Popup
            className={cn(
              "flex w-[min(22rem,var(--available-width))] origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "max-h-[min(30rem,var(--available-height))]",
              "transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
            )}
          >
            <List reduce={reduce}>
              {groups.map(([group, items], gi) => (
                <Fragment key={group ?? gi}>
                  {group ? (
                    <Select.Group className="flex flex-col">
                      <Select.GroupLabel className="px-2 pb-1 pt-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-3">{group}</Select.GroupLabel>
                      {items.map((m) => (
                        <ModelRow key={m.value} model={m} reduce={reduce} />
                      ))}
                    </Select.Group>
                  ) : (
                    items.map((m) => <ModelRow key={m.value} model={m} reduce={reduce} />)
                  )}
                </Fragment>
              ))}
            </List>
            <div className="flex shrink-0 items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-fg-3">
              <span className="flex items-center gap-1.5">
                <SpeedBars level={3} className="text-fg-3" /> Speed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10.5px] text-fg-3">$</span> Cost
              </span>
              {shortcut && (
                <span className="ms-auto flex items-center gap-1 text-fg-4 pointer-coarse:hidden">
                  <kbd className="rounded-[4px] border border-line-2 px-1 font-sans text-[10.5px] leading-4 text-fg-3">
                    {apple ? "⌘" : "Ctrl"} {shortcut.toUpperCase()}
                  </kbd>
                  to open
                </span>
              )}
            </div>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function groupBy(models: Model[]) {
  const out: [string | undefined, Model[]][] = [];
  for (const m of models) {
    const last = out.find(([g]) => g === m.group);
    if (last) last[1].push(m);
    else out.push([m.group, [m]]);
  }
  return out;
}

const subscribe = () => () => {};
function useApple() {
  return useSyncExternalStore(subscribe, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);
}

/* -------------------------------------------------------------------------------------------------
 * Trigger label: swaps in place and the width follows on a spring
 * -----------------------------------------------------------------------------------------------*/

function TriggerLabel({ id, dir, reduce, children }: { id: string; dir: number; reduce: boolean; children: React.ReactNode }) {
  const measure = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const w = el.offsetWidth;
    if (first.current || reduce) {
      first.current = false;
      width.jump(w);
      return;
    }
    const c = animate(width, w, spring.snappy);
    return () => c.stop();
  }, [id, reduce, width]);

  return (
    <motion.span style={{ width }} className="relative grid min-w-0 max-w-[16rem] overflow-hidden py-1">
      {/* The next name, laid out invisibly, tells the box how wide to become. */}
      <span ref={measure} aria-hidden className="invisible col-start-1 row-start-1 w-max whitespace-nowrap">
        {children}
      </span>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={id}
          custom={dir}
          className="col-start-1 row-start-1 truncate whitespace-nowrap"
          variants={{
            enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: 8 * d, filter: "blur(2px)" }),
            center: { opacity: 1, y: 0, filter: "blur(0px)" },
            exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: -8 * d, filter: "blur(2px)" }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The list and its rows
 * -----------------------------------------------------------------------------------------------*/

// One highlight for the list. It glides after the pointer and jumps for arrow keys.
function List({ reduce, children }: { reduce: boolean; children: React.ReactNode }) {
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(56);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!list) return;
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      running.forEach((c) => c.stop());
      running = [];
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.1 }));
        return;
      }
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      const target = el.hasAttribute("data-disabled") ? 0.5 : 1;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
        opacity.jump(target);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
        opacity.jump(target);
      }
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      running.forEach((c) => c.stop());
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
    };
  }, [list, reduce, y, height, opacity]);

  return (
    <Select.List ref={setList} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none">
      <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-fg/[0.06]" />
      {children}
    </Select.List>
  );
}

function ModelRow({ model: m, reduce }: { model: Model; reduce: boolean }) {
  const unavailable = m.disabled;
  const caps = m.capabilities ?? [];
  // What a screen reader hears after the name: the row's details, in words.
  const details = [
    unavailable ? m.disabledReason : m.description,
    caps.map((c) => capabilityLabel[c]).join(", "),
    m.speed ? speedLabel[m.speed] : "",
    m.cost ? costLabel[m.cost] : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Select.Item
      value={m.value}
      label={m.name}
      disabled={unavailable}
      className={cn(
        "relative grid cursor-default grid-cols-[16px_minmax(0,1fr)_auto] gap-x-2.5 rounded-lg px-2 py-2 outline-none",
        "data-disabled:cursor-not-allowed",
      )}
    >
      <span className="grid h-[18px] place-items-center text-fg">
        <Select.ItemIndicator className="grid place-items-center">
          <SelectedCheck reduce={reduce} />
        </Select.ItemIndicator>
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {m.icon && <span className="grid size-4 shrink-0 place-items-center text-fg-3 [&_svg]:size-3.5">{m.icon}</span>}
          <Select.ItemText className={cn("truncate text-[13px] font-medium leading-[18px] tracking-[-0.005em]", unavailable ? "text-fg-3" : "text-fg")}>{m.name}</Select.ItemText>
          {m.tag && <span className="shrink-0 rounded-full border border-line-2 px-1.5 text-[10.5px] font-medium leading-4 text-fg-2">{m.tag}</span>}
        </span>
        {(unavailable ? m.disabledReason : m.description) && (
          <span className={"flex min-w-0 items-center gap-1 text-[12px] leading-4 text-fg-3"}>
            {unavailable && <Lock size={12} className="shrink-0" />}
            <span className="truncate">{unavailable ? m.disabledReason : m.description}</span>
          </span>
        )}
        {caps.length > 0 && !unavailable && (
          <span aria-hidden className="mt-1 flex flex-wrap gap-1">
            {caps.map((c) => (
              <span key={c} className="rounded-[4px] bg-fg/[0.06] px-1.5 text-[10.5px] font-medium leading-4 text-fg-2">
                {capabilityLabel[c]}
              </span>
            ))}
          </span>
        )}
        <span className="sr-only">{details}</span>
      </span>

      <span aria-hidden className={cn("flex flex-col items-end gap-1.5 pt-1 text-fg-2", unavailable && "opacity-50")}>
        {m.speed && <SpeedBars level={m.speed} />}
        {m.cost && <Cost level={m.cost} />}
      </span>
    </Select.Item>
  );
}

function SelectedCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: ease.out, delay: 0.04 }} />
    </svg>
  );
}

function SpeedBars({ level, className }: { level: 1 | 2 | 3; className?: string }) {
  return (
    <span className={cn("flex h-2.5 items-end gap-[2px]", className)}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-[1px]", i <= level ? "bg-current" : "bg-fg/15")} style={{ height: 4 + i * 2 }} />
      ))}
    </span>
  );
}

function Cost({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="flex font-mono text-[10.5px] leading-3 tracking-[-0.02em]">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= level ? "text-fg-2" : "text-fg-4 opacity-60"}>
          $
        </span>
      ))}
    </span>
  );
}
