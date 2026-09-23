"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Copy, Download, File, Folder, Trash } from "@/lib/icons";
import { ease } from "@/lib/motion";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

const BODY = [
  "We ship the new billing flow to 10% of workspaces on Tuesday, then widen to everyone by Friday if refunds stay flat.",
  "Support gets the runbook on Monday. Sales hears about it in the weekly sync, not from customers.",
];

const words = [...BODY, "Launch plan"].join(" ").split(/\s+/).length;
const zooms = { fit: "text-[12.5px]", "100": "text-[13px]", "125": "text-[15px]" } as const;

// A document editor's bar. View really changes the page; File and Edit report
// what they did underneath.
export default function Demo() {
  const reduce = useReducedMotion();
  const [ruler, setRuler] = useState(true);
  const [count, setCount] = useState(true);
  const [zoom, setZoom] = useState<keyof typeof zooms>("100");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const say = (text: string) => setStatus(text);

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-10 items-center gap-2 border-b border-line ps-1.5 pe-3">
          <Menubar aria-label="Launch plan">
            <MenubarMenu>
              <MenubarTrigger>File</MenubarTrigger>
              <MenubarContent>
                <MenubarItem icon={<File />} shortcut="⌘N" onClick={() => say("Created Untitled document")}>
                  New document
                </MenubarItem>
                <MenubarItem icon={<Folder />} shortcut="⌘O" onClick={() => say("Choose a document to open")}>
                  Open…
                </MenubarItem>
                <MenubarSub>
                  <MenubarSubTrigger>Open recent</MenubarSubTrigger>
                  <MenubarSubContent>
                    {["Q3 planning notes", "Hiring plan 2027", "Customer interviews"].map((d) => (
                      <MenubarItem key={d} onClick={() => say(`Opened ${d}`)}>
                        {d}
                      </MenubarItem>
                    ))}
                  </MenubarSubContent>
                </MenubarSub>
                <MenubarSeparator />
                <MenubarItem shortcut="⌘S" disabled={saved} onClick={() => (setSaved(true), say("Saved"))}>
                  Save
                </MenubarItem>
                <MenubarItem icon={<Copy />} shortcut="⇧⌘S" onClick={() => say("Duplicated as Launch plan copy")}>
                  Duplicate
                </MenubarItem>
                <MenubarSub>
                  <MenubarSubTrigger icon={<Download />}>Export</MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem description="Keeps the page layout" onClick={() => say("Exported launch-plan.pdf")}>
                      PDF
                    </MenubarItem>
                    <MenubarItem description="Plain text with headings" onClick={() => say("Exported launch-plan.md")}>
                      Markdown
                    </MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
                <MenubarSeparator />
                <MenubarItem variant="danger" icon={<Trash />} onClick={() => say("Moved Launch plan to Trash")}>
                  Move to Trash
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger>Edit</MenubarTrigger>
              <MenubarContent>
                <MenubarItem shortcut="⌘Z" onClick={() => (setSaved(false), say("Undid typing"))}>
                  Undo typing
                </MenubarItem>
                <MenubarItem shortcut="⇧⌘Z" disabled>
                  Redo
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem shortcut="⌘X" onClick={() => say("Nothing selected to cut")}>
                  Cut
                </MenubarItem>
                <MenubarItem shortcut="⌘C" onClick={() => say("Nothing selected to copy")}>
                  Copy
                </MenubarItem>
                <MenubarItem shortcut="⌘V" onClick={() => say("Clipboard is empty")}>
                  Paste
                </MenubarItem>
                <MenubarItem shortcut="⌘A" onClick={() => say(`Selected ${words} words`)}>
                  Select all
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem shortcut="⌘F" onClick={() => say("Find in document")}>
                  Find…
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger>View</MenubarTrigger>
              <MenubarContent>
                <MenubarCheckboxItem checked={ruler} onCheckedChange={setRuler} shortcut="⌘R">
                  Ruler
                </MenubarCheckboxItem>
                <MenubarCheckboxItem checked={count} onCheckedChange={setCount} shortcut="⇧⌘W">
                  Word count
                </MenubarCheckboxItem>
                <MenubarSeparator />
                <MenubarRadioGroup value={zoom} onValueChange={setZoom}>
                  <MenubarLabel>Zoom</MenubarLabel>
                  <MenubarRadioItem value="fit" shortcut="⌘0">
                    Fit width
                  </MenubarRadioItem>
                  <MenubarRadioItem value="100" shortcut="⌘1">
                    100%
                  </MenubarRadioItem>
                  <MenubarRadioItem value="125" shortcut="⌘2">
                    125%
                  </MenubarRadioItem>
                </MenubarRadioGroup>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
          <span className="ms-auto flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
            <span className="truncate">Launch plan</span>
            <span className="grid shrink-0">
              {["Saved", "Edited"].map((l) => (
                <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
                  · {l}
                </span>
              ))}
              <span className="col-start-1 row-start-1">· {saved ? "Saved" : "Edited"}</span>
            </span>
          </span>
        </div>

        <AnimatePresence initial={false}>
          {ruler && (
            <motion.div
              key="ruler"
              aria-hidden
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 20, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0.12 } : { duration: 0.22, ease: ease.inOut }}
              className="overflow-hidden border-b border-line"
            >
              <div className="h-5 [background-image:repeating-linear-gradient(to_right,var(--line-2)_0_1px,transparent_1px_8px),repeating-linear-gradient(to_right,var(--fg-4)_0_1px,transparent_1px_40px)] [background-position:16px_12px,16px_6px] [background-repeat:repeat-x] [background-size:auto_8px,auto_14px]" />
            </motion.div>
          )}
        </AnimatePresence>

        <article className={`flex flex-col gap-2 px-5 py-4 leading-[1.6] text-fg-2 ${zooms[zoom]}`}>
          <h3 className="text-[1.15em] font-medium leading-snug tracking-[-0.015em] text-fg">Launch plan</h3>
          {BODY.map((p) => (
            <p key={p} className="text-pretty">
              {p}
            </p>
          ))}
        </article>

        <div className="flex h-8 items-center justify-between border-t border-line px-4 text-[12px] text-fg-3">
          <span className="tabular">{count ? `${words} words` : ""}</span>
          <span className="tabular">{zoom === "fit" ? "Fit width" : `${zoom}%`}</span>
        </div>
      </div>

      <p role="status" aria-live="polite" className="h-5 truncate px-1 text-[12px] text-fg-3">
        {status}
      </p>
    </div>
  );
}
