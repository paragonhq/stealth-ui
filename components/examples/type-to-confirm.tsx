"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { ease } from "@/lib/motion";
import { TypeToConfirm } from "@/components/ui/type-to-confirm";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A danger zone: the delete button opens the typed confirm in place. The first attempt fails so the error can be seen.
export default function Demo() {
  const [open, setOpen] = useState(false);
  const attempts = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`} className="w-full max-w-[480px] overflow-hidden rounded-xl border border-danger/30 bg-raised shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
        <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
          <h3 id={`${id}-title`} className="text-[13px] font-medium leading-5 text-fg">
            Delete project
          </h3>
          <p className="text-[12.5px] leading-[18px] text-fg-3 text-pretty">Permanently removes acme-web, its 214 deployments and 3 domains.</p>
        </div>
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-confirm`}
          onClick={() => setOpen(true)}
          disabled={open}
          className="ml-auto inline-flex h-8 shrink-0 items-center rounded-lg border border-danger/40 px-3 text-[12.5px] font-medium text-danger outline-none transition-[background-color,border-color,scale,opacity] duration-150 hover:border-danger/70 hover:bg-danger-soft focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 disabled:opacity-40"
        >
          Delete project…
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-confirm`}
            key="confirm"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.18, ease: ease.out } }}
            transition={{ duration: 0.26, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="border-t border-danger/15 bg-danger-soft/40 p-4">
              <TypeToConfirm
                resource="acme-web"
                action="Delete project"
                confirmedLabel="Deleted"
                autoFocus
                onCancel={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
                onConfirm={async () => {
                  await wait(1100);
                  if (attempts.current++ === 0) throw new Error("Timed out");
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
