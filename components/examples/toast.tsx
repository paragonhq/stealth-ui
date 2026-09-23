"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { File, Link, Refresh, Trash } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { ToastProvider, Toaster, useToast } from "@/components/ui/toast";

const files = [
  { id: "q3", name: "q3-forecast.xlsx", meta: "Edited by Maya Chen · 2h ago" },
  { id: "brand", name: "brand-guidelines-2026.pdf", meta: "Edited by you · Yesterday" },
  { id: "notes", name: "onboarding-notes.md", meta: "Edited by Theo Park · 3 Sep" },
];

// A shared folder: archive a file and undo it from the toast, copy a link twice
// to see the same toast nudge instead of stacking, and hit a sync failure.
export default function Demo() {
  return (
    <ToastProvider>
      <div className="relative flex h-[440px] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-line bg-frame">
        <Folder />
        <Toaster contained position="bottom-right" />
      </div>
    </ToastProvider>
  );
}

function Folder() {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(files.map((f) => f.id));

  const archive = (id: string) => {
    const file = files.find((f) => f.id === id)!;
    setVisible((v) => v.filter((x) => x !== id));
    const toastId = toast.add({
      title: `Archived ${file.name}`,
      description: "It stays in Archive for 30 days.",
      action: {
        label: "Undo",
        onClick: (e) => {
          // Keep the toast and turn it into the confirmation.
          e.preventDefault();
          setVisible((v) => files.map((f) => f.id).filter((x) => v.includes(x) || x === id));
          toast.update(toastId, { tone: "success", title: `Restored ${file.name}`, description: null, action: undefined, timeout: 2500 });
        },
      },
    });
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Finance</h3>
          <span className="text-[12px] text-fg-4 tabular">{visible.length} files</span>
        </div>
        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Copy link"
            onClick={() => toast.add({ id: "link", tone: "success", title: "Link copied", description: "stealth.app/s/finance-q3" })}
          >
            <Link />
          </ToolbarButton>
          <ToolbarButton
            label="Sync now"
            onClick={() =>
              toast.add({
                id: "sync",
                tone: "error",
                title: "Couldn’t sync 2 files",
                description: "You’re offline. Changes are saved on this device.",
                action: { label: "Retry", onClick: () => toast.add({ tone: "info", title: "Retrying when you’re back online" }) },
              })
            }
          >
            <Refresh />
          </ToolbarButton>
        </div>
      </header>

      <ul className="flex flex-col p-2" aria-label="Files">
        <AnimatePresence initial={false}>
          {files
            .filter((f) => visible.includes(f.id))
            .map((f) => (
              <motion.li
                key={f.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduce ? 0.12 : 0.24, ease: ease.inOut }}
                className="overflow-hidden"
              >
                <div className="group flex h-12 items-center gap-3 rounded-lg px-2 transition-colors duration-150 hover:bg-hover">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-raised text-fg-3">
                    <File size={14} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] leading-[18px] text-fg">{f.name}</span>
                    <span className="truncate text-[12px] leading-4 text-fg-3">{f.meta}</span>
                  </span>
                  <ToolbarButton label={`Archive ${f.name}`} onClick={() => archive(f.id)}>
                    <Trash />
                  </ToolbarButton>
                </div>
              </motion.li>
            ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <li className="flex h-36 flex-col items-center justify-center gap-1 text-center">
            <span className="text-[13px] text-fg-2">Nothing left in Finance</span>
            <span className="text-[12px] text-fg-4">Undo from the toast to bring files back.</span>
          </li>
        )}
      </ul>
    </>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative grid size-8 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3 active:scale-[0.92] active:duration-75 before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden"
    >
      {children}
    </button>
  );
}
