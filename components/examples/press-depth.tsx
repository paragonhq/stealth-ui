"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Code, Folder, Globe, Terminal } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { PressDepth } from "@/components/ui/press-depth";

const templates = [
  { id: "next", icon: <Code />, name: "Next.js app", detail: "App Router, TypeScript and Tailwind" },
  { id: "site", icon: <Globe />, name: "Marketing site", detail: "Static pages with a blog and sitemap" },
  { id: "api", icon: <Terminal />, name: "API service", detail: "Edge functions with a typed client" },
  { id: "mono", icon: <Folder />, name: "Monorepo", detail: "Available on the Team plan", disabled: true },
];

const noop = () => () => {};

// A new-project picker. A wide card and a small button sink by the same few pixels;
// holding ⌘ Enter holds the Continue button down through the controlled prop.
export default function Demo() {
  const [choice, setChoice] = useState("next");
  const [hotkey, setHotkey] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const mod = useSyncExternalStore(noop, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"), () => "⌘");

  const open = () => setOpening(templates.find((t) => t.id === choice)!.name);

  useEffect(() => {
    if (!opening) return;
    const t = window.setTimeout(() => setOpening(null), 1800);
    return () => window.clearTimeout(t);
  }, [opening]);

  useEffect(() => {
    let held = false;
    const down = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.repeat) return;
      e.preventDefault();
      held = true;
      setHotkey(true);
    };
    // Fires on release, like a click: the button comes back up as the action runs.
    const up = (e: KeyboardEvent) => {
      if (!held || !["Enter", "Meta", "Control"].includes(e.key)) return;
      held = false;
      setHotkey(false);
      setOpening(templates.find((t) => t.id === choice)!.name);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [choice]);

  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-3 px-0.5">
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Choose a starting point</p>
        <p className="text-[12px] text-fg-3">You can change the framework later in project settings.</p>
      </div>

      <div role="radiogroup" aria-label="Template" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((t) => {
          const checked = choice === t.id;
          return (
            <PressDepth key={t.id} disabled={t.disabled} className="rounded-xl">
              <label
                className={cn(
                  "flex h-full cursor-pointer select-none gap-3 rounded-xl border bg-raised p-3 transition-[border-color,background-color] duration-150",
                  "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-3",
                  checked ? "border-fg-3" : "border-line-2 hover:border-fg-4",
                  t.disabled && "cursor-not-allowed border-line-2 bg-frame hover:border-line-2",
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={checked}
                  disabled={t.disabled}
                  onChange={() => setChoice(t.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-2",
                    t.disabled && "text-fg-4",
                  )}
                >
                  {t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] font-medium text-fg", t.disabled && "text-fg-3")}>{t.name}</span>
                  <span className="block text-pretty text-[12px] leading-[1.4] text-fg-3">{t.detail}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border transition-[background-color,border-color] duration-150",
                    checked ? "border-fg bg-fg" : "border-line-2",
                    t.disabled && "opacity-50",
                  )}
                >
                  <AnimatePresence initial={false}>
                    {checked && (
                      <motion.span
                        className="size-1.5 rounded-full bg-frame"
                        initial={reduce ? { opacity: 0, scale: 1 } : { opacity: 1, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { scale: 0, transition: { duration: 0.1 } }}
                        transition={reduce ? { duration: 0.12 } : spring.pop}
                      />
                    )}
                  </AnimatePresence>
                </span>
              </label>
            </PressDepth>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 px-0.5">
        <p className="relative h-[18px] min-w-0 flex-1 overflow-hidden text-[12px] text-fg-3" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={opening ?? "hint"}
              className="block truncate"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
            >
              {opening ? `Setting up ${opening}…` : (
                <>
                  Hold <kbd className="font-mono text-[11px] text-fg-2">{mod} Enter</kbd> to continue
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </p>
        <PressDepth depth="deep" pressed={hotkey || undefined} className="shrink-0 rounded-lg">
          <button
            type="button"
            onClick={open}
            className="h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-colors duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            Continue
          </button>
        </PressDepth>
      </div>
    </div>
  );
}
