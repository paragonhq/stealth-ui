"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { ReorderList, ReorderListItem } from "@/components/ui/reorder-list";

const initiatives = [
  { id: "billing", title: "Move billing to usage-based plans", owner: "Priya Nair", team: "Billing" },
  { id: "sso", title: "SSO for Enterprise workspaces", owner: "Marcus Chen", team: "Auth" },
  { id: "cold-start", title: "Cut cold starts under 400 ms", owner: "Lea Hoffmann", team: "Platform" },
  { id: "onboarding", title: "Rewrite the onboarding checklist", owner: "Tomás Rivera", team: "Growth" },
  { id: "audit-log", title: "Audit log export to CSV and JSON", owner: "Aiko Tanaka", team: "Compliance" },
];
const initial = initiatives.map((i) => i.id);

// A team's quarter, ranked. Drag a grip or focus it and press Space; the rank rolls as rows move.
export default function Demo() {
  const [order, setOrder] = useState(initial);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number>(undefined);
  const reduce = useReducedMotion();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pristine = order.join() === initial.join();

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="flex h-8 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[14px] font-medium leading-5 tracking-[-0.015em] text-fg">Q4 priorities</h3>
          <span className="relative text-[12px] text-fg-3">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={saved ? "saved" : "hint"}
                className="inline-flex items-baseline gap-1"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
                transition={{ duration: 0.2, ease: ease.out }}
              >
                {saved ? (
                  <>
                    <Check size={12} className="self-center text-success" /> Order saved
                  </>
                ) : (
                  "Ranked by impact"
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <button
          type="button"
          disabled={pristine}
          onClick={() => {
            setOrder(initial);
            setSaved(false);
          }}
          className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,opacity,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
        >
          Reset order
        </button>
      </div>

      <ReorderList
        aria-label="Q4 priorities"
        numbered
        value={order}
        onValueChange={setOrder}
        onValueCommitted={() => {
          setSaved(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setSaved(false), 2000);
        }}
      >
        {initiatives.map((item) => (
          <ReorderListItem key={item.id} value={item.id} label={item.title}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 font-medium leading-[18px] tracking-[-0.005em] text-fg">{item.title}</span>
              <span className="truncate text-[12px] leading-4 text-fg-3">
                {item.owner} <span className="text-fg-4">·</span> {item.team}
              </span>
            </div>
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full border border-line-2 bg-hover text-[10px] font-medium tracking-[0.02em] text-fg-2"
            >
              {item.owner
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </ReorderListItem>
        ))}
      </ReorderList>
    </div>
  );
}
