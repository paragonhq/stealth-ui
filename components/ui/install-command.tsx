"use client";
import { Select } from "@base-ui/react/select";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type InstallAction = "install" | "dev" | "global" | "remove" | "exec" | "create" | "run";

const VERBS: Record<InstallAction, Record<PackageManager, string>> = {
  install: { npm: "npm install", pnpm: "pnpm add", yarn: "yarn add", bun: "bun add" },
  dev: { npm: "npm install -D", pnpm: "pnpm add -D", yarn: "yarn add -D", bun: "bun add -d" },
  global: { npm: "npm install -g", pnpm: "pnpm add -g", yarn: "yarn global add", bun: "bun add -g" },
  remove: { npm: "npm uninstall", pnpm: "pnpm remove", yarn: "yarn remove", bun: "bun remove" },
  exec: { npm: "npx", pnpm: "pnpm dlx", yarn: "yarn dlx", bun: "bunx" },
  create: { npm: "npm create", pnpm: "pnpm create", yarn: "yarn create", bun: "bun create" },
  run: { npm: "npm run", pnpm: "pnpm", yarn: "yarn", bun: "bun run" },
};

/** The command a package manager uses for an action, e.g. ("pnpm", "exec") → "pnpm dlx". */
export const commandFor = (pm: PackageManager, action: InstallAction, args = "") => `${VERBS[action][pm]}${args ? ` ${args}` : ""}`;

/* -------------------------------------------------------------------------------------------------
 * The synced preference. Same key and event as code tabs, so a docs page with both stays in step.
 * -----------------------------------------------------------------------------------------------*/

const EVENT = "stealth:preference";
const storageKey = (key: string) => `stealth:${key}`;
const read = (key: string) => {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
};

function usePreference(key: string | undefined) {
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
  const value = useSyncExternalStore(subscribe, () => (key ? read(key) : null), () => null);
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
 * InstallCommand
 * -----------------------------------------------------------------------------------------------*/

export type InstallCommandProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** Everything after the verb: packages, flags, a script name. */
  args?: string;
  action?: InstallAction;
  /** Which managers to offer, in order. One manager hides the switcher. */
  managers?: PackageManager[];
  value?: PackageManager;
  defaultValue?: PackageManager;
  onValueChange?: (pm: PackageManager) => void;
  /** Shares the manager with every install command and code tabs using this key. `false` keeps it local. */
  syncKey?: string | false;
  /** Full commands per manager, for anything the actions don't cover. */
  commands?: Partial<Record<PackageManager, string>>;
};

export function InstallCommand({
  args = "",
  action = "install",
  managers = ["npm", "pnpm", "yarn", "bun"],
  value: valueProp,
  defaultValue,
  onValueChange,
  syncKey = "package-manager",
  commands,
  className,
  ...rest
}: InstallCommandProps) {
  const reduce = useReducedMotion();
  const [synced, setSynced] = usePreference(syncKey || undefined);
  const [inner, setInner] = useState<PackageManager>(defaultValue ?? managers[0]);
  const offered = (v: string | null | undefined): v is PackageManager => !!v && managers.includes(v as PackageManager);
  const pm: PackageManager = valueProp ?? (offered(synced) ? synced : offered(inner) ? inner : managers[0]);

  const override = commands?.[pm];
  const verb = override ? "" : VERBS[action][pm];
  const tail = override ?? args;
  const full = override ?? commandFor(pm, action, args);

  const scroller = useRef<HTMLDivElement>(null);
  useFade(scroller);

  const choose = (next: PackageManager) => {
    setInner(next);
    setSynced(next);
    onValueChange?.(next);
  };

  return (
    <div
      data-pm={pm}
      className={cn(
        "flex h-10 min-w-0 items-center rounded-lg border border-line bg-raised pl-3 pr-1 shadow-[var(--shadow)]",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="mr-2 shrink-0 select-none font-mono text-[12.5px] text-fg-4">
        $
      </span>

      <div
        ref={scroller}
        className={cn(
          "min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_left,transparent,var(--fg)_var(--fade-end,0px))]",
        )}
      >
        {/* One click selects the whole command, the way people want to grab it. */}
        <code className="flex w-max select-all items-center whitespace-pre py-2 pr-3 font-mono text-[12.5px] leading-5 text-fg">
          <span className="flex">
            {verb && (
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={verb}
                  className="text-fg-2"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, y: -7, filter: "blur(3px)", transition: { duration: 0.14, ease: ease.in } }}
                  transition={{ duration: reduce ? 0.12 : 0.24, ease: ease.out }}
                >
                  {verb}
                </motion.span>
              </AnimatePresence>
            )}
            {/* The package slides to where the new verb ends instead of jumping. */}
            <motion.span layout={reduce ? false : "position"} transition={spring.snappy}>
              {verb && tail ? " " : ""}
              {tail}
            </motion.span>
          </span>
        </code>
      </div>

      {managers.length > 1 && <ManagerSelect value={pm} managers={managers} action={action} onChange={choose} />}
      <CopyButton value={full} iconOnly variant="ghost" size="sm" label="Copy command" className="ml-0.5" />
    </div>
  );
}

function ManagerSelect({
  value,
  managers,
  action,
  onChange,
}: {
  value: PackageManager;
  managers: PackageManager[];
  action: InstallAction;
  onChange: (pm: PackageManager) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => v && onChange(v as PackageManager)} modal={false}>
      <Select.Trigger
        aria-label="Package manager"
        className={cn(
          "group/pm relative ml-1 inline-flex h-7 shrink-0 select-none items-center gap-1 rounded-md pl-2 pr-1.5 text-[12px] font-medium text-fg-2 outline-none",
          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
          "data-popup-open:bg-hover data-popup-open:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
        )}
      >
        {/* Every name shares one cell, so the trigger keeps one width whichever is picked. */}
        <span className="grid text-left">
          {managers.map((m) => (
            <span key={m} aria-hidden className="invisible col-start-1 row-start-1">
              {m}
            </span>
          ))}
          <Select.Value className="col-start-1 row-start-1" />
        </span>
        <ChevronsUpDown size={12} className="text-fg-4 transition-colors group-hover/pm:text-fg-3" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner alignItemWithTrigger={false} side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Select.Popup
            className={cn(
              "min-w-40 origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-160 ease-out-expo",
              "data-starting-style:-translate-y-0.5 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100 data-ending-style:ease-out",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <Select.List className="outline-none">
              {managers.map((m) => (
                <Select.Item
                  key={m}
                  value={m}
                  className={cn(
                    "flex h-8 cursor-default select-none items-center gap-2 rounded-lg pl-2 pr-2 text-[13px] outline-none pointer-coarse:h-10",
                    "transition-colors duration-100 data-highlighted:bg-hover",
                  )}
                >
                  <Select.ItemText className="flex-1">{m}</Select.ItemText>
                  <span className="font-mono text-2xs text-fg-4">{VERBS[action][m].split(" ").slice(1).join(" ") || VERBS[action][m]}</span>
                  <span className="grid size-4 shrink-0 place-items-center">
                    <Select.ItemIndicator>
                      <Check size={14} />
                    </Select.ItemIndicator>
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

// Fades the right edge while the command runs past it, written straight to the element so scrolling never re-renders.
function useFade(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
        el.style.setProperty("--fade-end", more ? "24px" : "0px");
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);
}
