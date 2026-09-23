"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { File, Trash } from "@/lib/icons";
import { ease } from "@/lib/motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmField,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const seed = [
  { name: "q3-forecast.xlsx", meta: "Maya Chen · 2.4 MB" },
  { name: "brand-guidelines-2026.pdf", meta: "Leo Park · 18 MB" },
  { name: "onboarding-deck.key", meta: "You · 41 MB" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Demo() {
  const [files, setFiles] = useState(seed);
  const [target, setTarget] = useState(seed[0]);
  const [open, setOpen] = useState(false);
  const [projectGone, setProjectGone] = useState(false);
  const attempts = useRef(0);
  const reduce = useReducedMotion();

  return (
    <div className="w-full max-w-[400px]">
      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-10 items-center justify-between border-b border-line px-3.5">
          <p className="text-[12.5px] font-medium text-fg">Shared files</p>
          <p className="tabular text-[11.5px] text-fg-3">{files.length === 1 ? "1 file" : `${files.length} files`}</p>
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <motion.li
                key={f.name}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: ease.inOut }}
                className="overflow-hidden"
              >
                <div className="flex h-12 items-center gap-3 px-3.5">
                  <File className="shrink-0 text-fg-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-fg">{f.name}</p>
                    <p className="truncate text-[11.5px] text-fg-3">{f.meta}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${f.name}`}
                    onClick={() => {
                      setTarget(f);
                      setOpen(true);
                    }}
                    className={cn(
                      "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3",
                      "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                      "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-danger-soft hover:text-danger active:scale-[0.92]",
                      "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <Trash />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {files.length === 0 && (
          <div className="flex h-24 flex-col items-center justify-center gap-2">
            <p className="text-[12.5px] text-fg-3">No shared files</p>
            <button type="button" onClick={() => setFiles(seed)} className="text-[12.5px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px] hover:decoration-fg-2">
              Restore demo files
            </button>
          </div>
        )}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent tone="danger" icon={<Trash />}>
          <AlertDialogTitle>
            Delete <span className="break-all">{target.name}</span>?
          </AlertDialogTitle>
          <AlertDialogDescription>It’s removed for everyone it was shared with. This can’t be undone.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction
              pendingLabel="Deleting…"
              onAction={async () => {
                await wait(900);
                setFiles((all) => all.filter((f) => f.name !== target.name));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-fg">{projectGone ? "Project deleted" : "Delete project"}</p>
          <p className="truncate text-[11.5px] text-fg-3">{projectGone ? "stealth-web and its 212 deploys are gone" : "Removes stealth-web and every deploy"}</p>
        </div>
        {projectGone ? (
          <button
            type="button"
            onClick={() => {
              attempts.current = 0;
              setProjectGone(false);
            }}
            className="h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97]"
          >
            Restore demo
          </button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-lg border border-danger/25 bg-danger-soft px-2.5 text-[12.5px] font-medium text-danger",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,border-color,scale] duration-150 ease-out-quart hover:border-danger/45 hover:bg-danger/15 active:scale-[0.97]",
              )}
            >
              Delete…
            </AlertDialogTrigger>
            <AlertDialogContent tone="danger">
              <AlertDialogTitle>Delete stealth-web?</AlertDialogTitle>
              <AlertDialogDescription>This removes the project, its 212 deploys and 4 domains for your whole team. It can’t be undone.</AlertDialogDescription>
              <AlertDialogConfirmField match="stealth-web" />
              <AlertDialogFooter>
                <AlertDialogCancel />
                <AlertDialogAction
                  pendingLabel="Deleting…"
                  errorMessage={() => "Couldn’t delete stealth-web. The server didn’t respond. Try again."}
                  onAction={async () => {
                    await wait(1100);
                    // The first attempt fails so the error state can be seen.
                    if (attempts.current++ === 0) throw new Error("timeout");
                    setProjectGone(true);
                  }}
                >
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
