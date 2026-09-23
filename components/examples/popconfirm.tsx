"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { File, Image, Refresh, Trash } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { Popconfirm } from "@/components/ui/popconfirm";

type Doc = { id: string; name: string; meta: string; kind: "file" | "image"; locked?: string };

const files: Doc[] = [
  { id: "a", name: "launch-plan-v3.pdf", meta: "2.4 MB · Edited yesterday", kind: "file" },
  { id: "b", name: "hero-illustration-final-final.png", meta: "6.1 MB · Edited 3 days ago", kind: "image" },
  { id: "c", name: "vendor-contract-signed.pdf", meta: "380 KB · Locked by Priya", kind: "file", locked: "Priya Raman" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A project's attachments. Deleting asks right where you pressed, waits for the
// server, and the row folds away once it's gone; the signed contract refuses.
export default function Demo() {
  const [docs, setDocs] = useState(files);
  const reduce = useReducedMotion();

  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Attachments</p>
        <p className="text-[12px] text-fg-3 tabular">{docs.length === 1 ? "1 file" : `${docs.length} files`}</p>
      </div>

      <ul className="flex flex-col p-1.5" aria-label="Attachments">
        <AnimatePresence initial={false}>
          {docs.map((d) => (
            <motion.li
              key={d.id}
              layout={!reduce}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.24, ease: ease.inOut } }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-hover">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-2">
                  {d.kind === "image" ? <Image /> : <File />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-fg">{d.name}</p>
                  <p className="truncate text-[12px] text-fg-3">{d.meta}</p>
                </div>
                <Popconfirm
                  tone="danger"
                  icon={<Trash />}
                  title={`Delete ${d.name}?`}
                  description="It’s removed for everyone on the project. This can’t be undone."
                  confirmLabel="Delete"
                  successLabel="Deleted"
                  errorMessage={d.locked ? `Couldn’t delete it. ${d.locked} is editing this file.` : undefined}
                  align="end"
                  onConfirm={async () => {
                    await wait(900);
                    if (d.locked) throw new Error("locked");
                  }}
                  onConfirmed={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}
                >
                  <button
                    type="button"
                    aria-label={`Delete ${d.name}`}
                    className={cn(
                      "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-3 outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-raised hover:text-danger active:scale-[0.92] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                      "data-popup-open:bg-danger-soft data-popup-open:text-danger",
                      "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <Trash />
                  </button>
                </Popconfirm>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {docs.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-[13px] text-fg-2">No attachments</p>
            <button
              type="button"
              onClick={() => setDocs(files)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              <Refresh size={14} />
              Restore files
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
