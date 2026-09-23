"use client";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Inbox, Pencil, Search } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { Kbd, usePlatform, type Platform } from "@/components/ui/kbd";

// A reply box that really sends on ⌘↵, a menu that names its shortcuts, and the
// same keys written for the other platform.
export default function Demo() {
  const detected = usePlatform();
  const [choice, setChoice] = useState<Platform | null>(null);
  const platform = choice ?? detected;
  const [sent, setSent] = useState(false);
  const timer = useRef<number>(undefined);
  const reduce = useReducedMotion();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const send = () => {
    setSent(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSent(false), 1600);
  };

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="px-3.5 pt-3 pb-3.5">
          <p className="text-[12px] text-fg-3">
            Reply to <span className="text-fg-2">Maya Chen</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-fg text-pretty">Looks good. Ship it once the billing migration lands on staging.</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-fg-3">
            <Kbd keys="mod+enter" listen onMatch={send} platform={platform} />
            <span className="truncate">to send</span>
          </span>
          <button
            type="button"
            onClick={send}
            className={cn(
              "relative inline-flex h-7 shrink-0 select-none items-center justify-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,scale] duration-150 ease-out-quart hover:bg-fg/90 active:scale-[0.97] active:duration-75",
            )}
          >
            {/* Both labels share one cell so the button never changes width. */}
            <span className="grid">
              <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-1">
                <Check size={14} /> Sent
              </span>
              <span aria-hidden className="invisible col-start-1 row-start-1">Send</span>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={sent ? "sent" : "send"}
                  className="col-start-1 row-start-1 flex items-center justify-center gap-1"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)" }}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                >
                  {sent ? (
                    <>
                      <Check size={14} /> Sent
                    </>
                  ) : (
                    "Send"
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
          <span role="status" className="sr-only">
            {sent ? "Reply sent" : ""}
          </span>
        </div>
      </div>

      <div role="presentation" className="rounded-xl border border-line bg-raised p-1 shadow-[var(--shadow)]">
        {[
          { icon: <Pencil />, label: "New issue", keys: "c" },
          { icon: <Search />, label: "Search", keys: "mod+k" },
          { icon: <Inbox />, label: "Go to inbox", keys: "g i" },
        ].map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-fg",
              i === 1 && "bg-hover",
            )}
          >
            <span className="flex text-fg-3 [&_svg]:size-4">{row.icon}</span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <Kbd keys={row.keys} variant="ghost" size="sm" platform={platform} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 truncate text-[12px] text-fg-3">
          Press <Kbd keys="?" size="sm" platform={platform} className="mx-0.5" /> for every shortcut
        </p>
        <ToggleGroup
          aria-label="Write shortcuts for"
          value={[platform]}
          onValueChange={(v) => v[0] && setChoice(v[0] as Platform)}
          className="flex shrink-0 rounded-lg border border-line bg-frame p-0.5"
        >
          {(
            [
              ["mac", "macOS"],
              ["other", "Windows"],
            ] as const
          ).map(([value, label]) => (
            <Toggle
              key={value}
              value={value}
              className={cn(
                "relative h-6 rounded-md px-2 text-[11.5px] font-medium text-fg-3 outline-none select-none",
                "transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.96] data-pressed:text-fg",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              )}
            >
              {platform === value && (
                <motion.span
                  layoutId="kbd-demo-platform"
                  transition={reduce ? { duration: 0 } : spring.snappy}
                  className="absolute inset-0 rounded-md border border-line-2 bg-raised shadow-[var(--shadow)]"
                />
              )}
              <span className="relative">{label}</span>
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
