"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Download, Folder, Trash } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { BulkAction, RowSelectionTable, type SelectionColumn } from "@/components/ui/row-selection";

type FileRow = { id: string; name: string; owner: string; modified: string; size: string };

const initial: FileRow[] = [
  { id: "f1", name: "q3-forecast.xlsx", owner: "Priya Raman", modified: "2h ago", size: "184 KB" },
  { id: "f2", name: "board-deck-september.pdf", owner: "Marcus Lee", modified: "Yesterday", size: "12.4 MB" },
  { id: "f3", name: "pricing-experiment-results-final-v3.csv", owner: "Priya Raman", modified: "Sep 18", size: "2.1 MB" },
  { id: "f4", name: "onboarding-flow.fig", owner: "Ana Duarte", modified: "Sep 16", size: "38 MB" },
  { id: "f5", name: "vendor-contract-signed.pdf", owner: "Tom Becker", modified: "Sep 12", size: "640 KB" },
  { id: "f6", name: "churn-model.ipynb", owner: "Marcus Lee", modified: "Sep 9", size: "3.8 MB" },
];

const columns: SelectionColumn<FileRow>[] = [
  {
    key: "name",
    header: "Name",
    className: "max-w-0",
    cell: (r) => (
      <span title={r.name} className="block truncate">
        {r.name}
      </span>
    ),
  },
  { key: "owner", header: "Owner", width: 120, cell: (r) => <span className="block truncate text-fg-2">{r.owner}</span> },
  { key: "modified", header: "Modified", width: 92, cell: (r) => <span className="text-fg-2">{r.modified}</span> },
  { key: "size", header: "Size", width: 76, numeric: true, cell: (r) => <span className="text-fg-2">{r.size}</span> },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Demo() {
  const [files, setFiles] = useState(initial);
  const [selected, setSelected] = useState<string[]>(["f2", "f3"]);
  const [removed, setRemoved] = useState<{ rows: FileRow[]; before: FileRow[] } | null>(null);
  const timer = useRef<number>(undefined);
  const reduce = useReducedMotion();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const remove = async (ids: string[], clear: () => void) => {
    await wait(700);
    const before = files;
    setRemoved({ rows: files.filter((f) => ids.includes(f.id)), before });
    setFiles((fs) => fs.filter((f) => !ids.includes(f.id)));
    clear();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRemoved(null), 6000);
  };

  const undo = () => {
    if (!removed) return;
    setFiles(removed.before);
    setSelected(removed.rows.map((r) => r.id));
    setRemoved(null);
  };

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2.5">
      <div className="flex h-7 items-center justify-between gap-3 px-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Project files</h3>
        <AnimatePresence initial={false} mode="popLayout">
          {removed && (
            <motion.p
              key={removed.rows.map((r) => r.id).join()}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.in } }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="flex min-w-0 items-center gap-2 text-[12.5px] text-fg-2"
            >
              <span className="truncate">
                Deleted {removed.rows.length === 1 ? removed.rows[0].name : `${removed.rows.length} files`}
              </span>
              <button
                type="button"
                onClick={undo}
                className="h-7 shrink-0 rounded-md px-2 font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
              >
                Undo
              </button>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <RowSelectionTable
        caption="Project files"
        columns={columns}
        rows={files}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        selected={selected}
        onSelectedChange={setSelected}
        noun={{ one: "file", other: "files" }}
        minWidth={480}
        empty="No files in this project"
        actions={({ selected: ids, clear }) => (
          <>
            <BulkAction icon={<Download size={14} />} onAction={() => wait(900)}>
              Download
            </BulkAction>
            <BulkAction icon={<Folder size={14} />} onAction={clear}>
              Move
            </BulkAction>
            <BulkAction icon={<Trash size={14} />} variant="danger" onAction={() => remove(ids, clear)}>
              Delete
            </BulkAction>
          </>
        )}
      />
      <p className="px-1 text-[12px] text-fg-3">Shift-click to select a range. Esc clears.</p>
    </div>
  );
}
