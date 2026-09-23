"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { File, Folder, Link, Upload } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { SpeedDial, SpeedDialAction } from "@/components/ui/speed-dial";

type Doc = { id: number; name: string; kind: "doc" | "folder" | "file" | "link"; meta: string };

const START: Doc[] = [
  { id: 1, name: "Q3 planning", kind: "doc", meta: "Edited 2h ago" },
  { id: 2, name: "Brand assets", kind: "folder", meta: "24 items" },
  { id: 3, name: "q3-forecast.xlsx", kind: "file", meta: "1.8 MB" },
];

const glyph = { doc: <File size={14} />, folder: <Folder size={14} />, file: <File size={14} />, link: <Link size={14} /> };

// The dial lives in the corner of a documents panel, rendered inside the demo.
export default function Demo() {
  const [docs, setDocs] = useState(START);
  const next = useRef(4);
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const add = (name: string, kind: Doc["kind"], meta: string) => setDocs((d) => [{ id: next.current++, name, kind, meta }, ...d].slice(0, 5));

  return (
    <div ref={root} className="relative h-[400px] w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Documents</p>
        <p className="tabular text-[12px] text-fg-3">{docs.length} items</p>
      </div>
      <ul className="py-1">
        <AnimatePresence initial={false}>
          {docs.map((d) => (
            <motion.li
              key={d.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, ease: ease.out }}
              className="flex items-center gap-2.5 px-4 py-2"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-frame text-fg-3">{glyph[d.kind]}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{d.name}</span>
              <span className="shrink-0 text-[11.5px] text-fg-3">{d.meta}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <SpeedDial label="Create" placement="absolute" container={root}>
        <SpeedDialAction icon={<Link />} onClick={() => add("Roadmap (linked)", "link", "Just now")}>Add a link</SpeedDialAction>
        <SpeedDialAction icon={<Upload />} onClick={() => add("contract-signed.pdf", "file", "412 KB")}>Upload a file</SpeedDialAction>
        <SpeedDialAction icon={<Folder />} onClick={() => add("Untitled folder", "folder", "Empty")}>New folder</SpeedDialAction>
        <SpeedDialAction icon={<File />} onClick={() => add("Untitled document", "doc", "Just now")}>New document</SpeedDialAction>
      </SpeedDial>
    </div>
  );
}
