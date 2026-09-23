"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Copy, Download, Folder, Link, MoreH, Trash } from "@/lib/icons";
import { spring } from "@/lib/motion";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Doc = { id: string; name: string; ext: string; bytes: number; editedMin: number };

const START: Doc[] = [
  { id: "forecast", name: "q3-forecast", ext: "xlsx", bytes: 248_000, editedMin: 125 },
  { id: "deck", name: "board-deck-final", ext: "key", bytes: 18_400_000, editedMin: 1_560 },
  { id: "hiring", name: "hiring-plan-2027", ext: "pdf", bytes: 1_200_000, editedMin: 12 },
];

const FOLDERS = ["Design", "Finance", "Archive"];

const size = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
const ago = (m: number) => (m < 60 ? `${m}m ago` : m < 1_440 ? `${Math.floor(m / 60)}h ago` : "Yesterday");

// A folder's worth of files. The View menu re-sorts and reformats the rows; each
// row's menu acts on it for real, including a submenu and an undoable delete.
export default function Demo() {
  const reduce = useReducedMotion();
  const [docs, setDocs] = useState(START);
  const [sort, setSort] = useState("edited");
  const [showExt, setShowExt] = useState(true);
  const [showSize, setShowSize] = useState(true);
  const [status, setStatus] = useState<{ text: string; undo?: Doc[] } | null>(null);

  const sorted = [...docs].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.bytes - a.bytes : a.editedMin - b.editedMin,
  );
  const label = (d: Doc) => (showExt ? `${d.name}.${d.ext}` : d.name);

  const remove = (d: Doc, text: string) => {
    setStatus({ text, undo: docs });
    setDocs((all) => all.filter((x) => x.id !== d.id));
  };
  const duplicate = (d: Doc) => {
    const copy = { ...d, id: `${d.id}-${docs.length}`, name: `${d.name} copy`, editedMin: 0 };
    setDocs((all) => [...all, copy]);
    setStatus({ text: `Duplicated as ${label(copy)}` });
  };

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-12 items-center gap-3 border-b border-line ps-4 pe-2">
          <Folder className="shrink-0 text-fg-3" />
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h3 className="truncate text-[14px] font-medium tracking-[-0.015em]">Finance</h3>
            <span className="text-[12px] text-fg-3 tabular">
              {docs.length === 1 ? "1 file" : `${docs.length} files`}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger size="sm" chevron>
              View
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="edited">Last edited</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={showExt} onCheckedChange={setShowExt} shortcut="⇧⌘E">
                  File extensions
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showSize} onCheckedChange={setShowSize}>
                  File sizes
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {docs.length === 0 ? (
          <div className="flex h-[156px] flex-col items-center justify-center gap-3 text-center">
            <p className="text-[13px] text-fg-2">No files in Finance</p>
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
          <ul aria-label="Files in Finance" className="flex flex-col p-1">
            <AnimatePresence initial={false}>
              {sorted.map((d) => (
                <motion.li
                  key={d.id}
                  layout={reduce ? false : "position"}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={spring.soft}
                  className="group/row flex h-[52px] items-center gap-3 rounded-lg ps-3 pe-1.5 hover:bg-hover has-[[data-popup-open]]:bg-hover"
                >
                  <FileGlyph ext={d.ext} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] leading-[18px] text-fg">{label(d)}</span>
                    <span className="truncate text-[12px] leading-4 text-fg-3 tabular">
                      Edited {ago(d.editedMin)}
                      {showSize && ` · ${size(d.bytes)}`}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={`Actions for ${label(d)}`}
                      className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                    >
                      <MoreH />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem icon={<Copy />} shortcut="⌘D" onClick={() => duplicate(d)}>
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem icon={<Link />} shortcut="⇧⌘C" onClick={() => setStatus({ text: `Link to ${label(d)} copied` })}>
                        Copy link
                      </DropdownMenuItem>
                      <DropdownMenuItem icon={<Download />} onClick={() => setStatus({ text: `Downloading ${label(d)}` })}>
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger icon={<Folder />}>Move to</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {FOLDERS.map((f) => (
                            <DropdownMenuItem
                              key={f}
                              icon={<Folder />}
                              disabled={f === "Finance"}
                              description={f === "Finance" ? "Current folder" : undefined}
                              onClick={() => remove(d, `Moved ${label(d)} to ${f}`)}
                            >
                              {f}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="danger" icon={<Trash />} shortcut="⌘⌫" onClick={() => remove(d, `Deleted ${label(d)}`)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div role="status" aria-live="polite" className="flex h-7 items-center justify-between gap-3 px-1">
        <AnimatePresence mode="wait" initial={false}>
          {status && (
            <motion.div
              key={status.text}
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2 }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FileGlyph({ ext }: { ext: string }) {
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-raised font-mono text-[9px] uppercase tracking-[0.04em] text-fg-3">
      {ext}
    </span>
  );
}
