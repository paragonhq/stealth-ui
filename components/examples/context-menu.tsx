"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { Copy, Download, External, Folder, Link, MoreH, Trash } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type Doc = { id: string; name: string; meta: string; offline: boolean };

const START: Doc[] = [
  { id: "a", name: "q3-forecast.xlsx", meta: "248 KB · Maya Chen", offline: true },
  { id: "b", name: "brand-guidelines-v4-final-approved.pdf", meta: "12.8 MB · Theo Okafor", offline: false },
  { id: "c", name: "customer-interviews.md", meta: "36 KB · You", offline: false },
];

// Rows you right-click (or long-press) the way you would in a file manager. The
// same actions sit behind each row's ⋯ button, because a context menu should
// never be the only way in.
export default function Demo() {
  const reduce = useReducedMotion();
  const hint = useId();
  const [docs, setDocs] = useState(START);
  const [status, setStatus] = useState<{ text: string; undo?: Doc[] } | null>(null);

  const update = (id: string, patch: Partial<Doc>) => setDocs((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const remove = (d: Doc, text: string) => {
    setStatus({ text, undo: docs });
    setDocs((all) => all.filter((x) => x.id !== d.id));
  };

  // One definition, rendered in both the context menu and the ⋯ dropdown.
  const items = (d: Doc) => (
    <>
      <ContextMenuItem icon={<External />} shortcut="⌘O" onClick={() => setStatus({ text: `Opened ${d.name}` })}>
        Open
      </ContextMenuItem>
      <ContextMenuItem icon={<Copy />} shortcut="⌘D" onClick={() => setStatus({ text: `Duplicated ${d.name}` })}>
        Duplicate
      </ContextMenuItem>
      <ContextMenuItem icon={<Link />} shortcut="⇧⌘C" onClick={() => setStatus({ text: "Link copied" })}>
        Copy link
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger icon={<Folder />}>Move to</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {["Design", "Research", "Archive"].map((f) => (
            <ContextMenuItem key={f} icon={<Folder />} onClick={() => remove(d, `Moved ${d.name} to ${f}`)}>
              {f}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuCheckboxItem checked={d.offline} onCheckedChange={(offline) => update(d.id, { offline })}>
        Available offline
      </ContextMenuCheckboxItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="danger" icon={<Trash />} shortcut="⌘⌫" onClick={() => remove(d, `Moved ${d.name} to Trash`)}>
        Move to Trash
      </ContextMenuItem>
    </>
  );

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-9 items-center gap-2 border-b border-line px-4 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
          <span className="flex-1">Name</span>
          <span className="pe-9">Offline</span>
        </div>
        {docs.length === 0 ? (
          <div className="flex h-[168px] flex-col items-center justify-center gap-3">
            <p className="text-[13px] text-fg-2">This folder is empty</p>
            <button
              type="button"
              onClick={() => {
                setDocs(START);
                setStatus(null);
              }}
              className="h-7 rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium shadow-[var(--shadow)] outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
            >
              Restore files
            </button>
          </div>
        ) : (
          <ul aria-label="Files" className="flex flex-col gap-px p-1">
            <AnimatePresence initial={false}>
              {docs.map((d) => (
                <motion.li
                  key={d.id}
                  layout={reduce ? false : "position"}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={spring.soft}
                >
                  <ContextMenu>
                    <ContextMenuTrigger
                      tabIndex={0}
                      aria-describedby={hint}
                      className="group/row flex h-[52px] items-center gap-3 rounded-lg ps-3 pe-1.5 hover:bg-hover data-popup-open:bg-hover data-popup-open:outline-solid data-popup-open:outline-1 data-popup-open:-outline-offset-1 data-popup-open:outline-line-2 has-[[data-popup-open]]:bg-hover"
                    >
                      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-raised text-fg-3">
                        <FileIcon />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] leading-[18px] text-fg">{d.name}</span>
                        <span className="truncate text-[12px] leading-4 text-fg-3">{d.meta}</span>
                      </span>
                      <span className="grid size-7 shrink-0 place-items-center text-fg-3" aria-label={d.offline ? "Available offline" : undefined} role={d.offline ? "img" : undefined}>
                        <AnimatePresence initial={false}>
                          {d.offline && (
                            <motion.span
                              key="offline"
                              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                              transition={reduce ? { duration: 0.15 } : spring.pop}
                              className="grid place-items-center"
                            >
                              <Download size={14} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label={`Actions for ${d.name}`}
                          className="opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                        >
                          <MoreH />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">{items(d)}</DropdownMenuContent>
                      </DropdownMenu>
                    </ContextMenuTrigger>
                    <ContextMenuContent>{items(d)}</ContextMenuContent>
                  </ContextMenu>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <span id={hint} className="sr-only">Press Shift F10 for actions</span>
      <div role="status" aria-live="polite" className="flex h-7 items-center gap-3 px-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status?.text ?? "hint"}
            className="flex min-w-0 flex-1 items-center justify-between gap-3"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2 }}
          >
            {status ? (
              <>
                <span className="truncate text-[12px] text-fg-3">{status.text}</span>
                {status.undo && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocs(status.undo!);
                      setStatus(null);
                    }}
                    className="relative shrink-0 rounded text-[12px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden"
                  >
                    Undo
                  </button>
                )}
              </>
            ) : (
              <span className="truncate text-[12px] text-fg-3">
                <span className="pointer-coarse:hidden">Right-click a file, or focus it and press ⇧F10</span>
                <span className="hidden pointer-coarse:inline">Press and hold a file for its actions</span>
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
    </svg>
  );
}
