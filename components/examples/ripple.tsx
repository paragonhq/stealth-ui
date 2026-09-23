"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Download, Link, Lock, MoreH, Star, Users } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { Ripple } from "@/components/ui/ripple";

const focus = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

// A share sheet for a spreadsheet: rows ripple from the finger, icon buttons from
// their centre, and the primary button's wave takes its own inverted text color.
export default function Demo() {
  const [copied, setCopied] = useState(false);
  const [starred, setStarred] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = () => setCopied(true);

  const rows = [
    { icon: <Link />, label: "Copy link", meta: copied ? "Copied" : "Anyone with the link can view", onClick: copy },
    { icon: <Users />, label: "Invite people", meta: "Maya, Tomás and 3 others have access" },
    { icon: <Download />, label: "Export as PDF", meta: "12 pages · 2.4 MB" },
    { icon: <Lock />, label: "Publish to the web", meta: "Only workspace admins can publish", disabled: true },
  ];

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-line-2 bg-raised p-1.5 shadow-pop">
      <div className="flex items-center gap-3 py-1.5 pl-3 pr-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Share q3-forecast.xlsx</p>
          <p className="truncate text-[12px] text-fg-3">Finance · edited 4m ago</p>
        </div>
        <button
          type="button"
          aria-label={starred ? "Remove from starred" : "Add to starred"}
          aria-pressed={starred}
          onClick={() => setStarred((s) => !s)}
          className={cn(
            "relative grid size-8 shrink-0 place-items-center rounded-full transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
            "pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5",
            starred ? "text-fg" : "text-fg-3",
            focus,
          )}
        >
          <Star fill={starred ? "currentColor" : "none"} />
          <Ripple centered />
        </button>
        <button
          type="button"
          aria-label="More share options"
          className={cn(
            "relative grid size-8 shrink-0 place-items-center rounded-full text-fg-3 transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
            "pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5",
            focus,
          )}
        >
          <MoreH />
          <Ripple centered />
        </button>
      </div>

      <ul className="mt-1 flex flex-col">
        {rows.map((row) => (
          <li key={row.label}>
            <button
              type="button"
              onClick={row.disabled ? undefined : row.onClick}
              aria-disabled={row.disabled || undefined}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-hover",
                "aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-2",
                  row.disabled && "text-fg-4",
                )}
              >
                {row.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-medium text-fg", row.disabled && "text-fg-3")}>{row.label}</span>
                <span className="relative block h-[18px] overflow-hidden text-[12px] text-fg-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={row.meta}
                      className={cn("block truncate", row.meta === "Copied" && "text-fg-2")}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                      transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
                    >
                      {row.meta}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
              <Ripple />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-1.5 flex items-center justify-end gap-2 border-t border-line px-1.5 pb-0.5 pt-2.5">
        <button
          type="button"
          className={cn(
            "relative h-8 rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
            focus,
          )}
        >
          Manage access
          <Ripple />
        </button>
        <button
          type="button"
          className={cn(
            "relative h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame shadow-[var(--shadow)] transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
            focus,
          )}
        >
          Done
          <Ripple />
        </button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
