"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { Folder, Inbox, Lock } from "@/lib/icons";
import { Draggable, DropTarget, DropTargetProvider } from "@/components/ui/drop-target";

type FileItem = { id: string; name: string; ext: "pdf" | "xlsx" | "zip" };
const files: FileItem[] = [
  { id: "inv", name: "invoice-0423.pdf", ext: "pdf" },
  { id: "fc", name: "q3-forecast.xlsx", ext: "xlsx" },
  { id: "msa", name: "acme-msa-signed.pdf", ext: "pdf" },
  { id: "img", name: "offsite-photos.zip", ext: "zip" },
];

const folders = [
  { id: "finance", label: "Finance", accept: (f: FileItem) => f.ext !== "zip", reject: "No archives" },
  { id: "legal", label: "Legal", accept: (f: FileItem) => f.ext === "pdf", reject: "Only PDFs" },
  { id: "archive", label: "Archive", accept: () => false, reject: "Read-only", empty: "Nothing archived" },
];

// Sorting new uploads into folders. Drag a file, or tap it (Enter on a keyboard) and then a folder.
// Legal only takes PDFs and Archive is read-only, so some drops come back.
export default function Demo() {
  const [where, setWhere] = useState<Record<string, string>>(() => Object.fromEntries(files.map((f) => [f.id, "inbox"])));
  const byId = (id: string) => files.find((f) => f.id === id)!;
  const inside = (zone: string) => files.filter((f) => where[f.id] === zone);

  return (
    <DropTargetProvider onDrop={(item, target) => setWhere((w) => ({ ...w, [item]: target }))}>
      <div className="grid w-full max-w-[540px] gap-3 sm:grid-cols-[1fr_1.1fr]">
        <DropTarget id="inbox" label="Uploads" className="flex flex-col p-3 sm:min-h-[236px]">
          <Header icon={<Inbox size={14} />} title="Uploads" count={inside("inbox").length} />
          <div className="mt-2.5 flex flex-col gap-1.5">
            {inside("inbox").map((f) => (
              <FileChip key={f.id} file={f} />
            ))}
            {!inside("inbox").length && <p className="py-6 text-center text-[12px] text-fg-4">All sorted</p>}
          </div>
        </DropTarget>

        <div className="flex flex-col gap-2">
          {folders.map((folder) => (
            <DropTarget
              key={folder.id}
              id={folder.id}
              label={folder.label}
              accept={(item) => folder.accept(byId(item))}
              rejectLabel={folder.reject}
              className="min-h-[72px] p-3"
            >
              {({ active, canDrop, home, flash }) => (
                <>
                  <Header
                    icon={folder.id === "archive" ? <Lock size={14} /> : <Folder size={14} />}
                    title={folder.label}
                    count={inside(folder.id).length}
                    note={(active && !canDrop && !home) || flash === "rejected" ? folder.reject : undefined}
                  />
                  {inside(folder.id).length === 0 ? (
                    <p className="mt-2 text-[12px] leading-7 text-fg-4">{"empty" in folder ? folder.empty : "Drop files here"}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {inside(folder.id).map((f) => (
                        <FileChip key={f.id} file={f} compact />
                      ))}
                    </div>
                  )}
                </>
              )}
            </DropTarget>
          ))}
        </div>
      </div>
    </DropTargetProvider>
  );
}

function Header({ icon, title, count, note }: { icon: React.ReactNode; title: string; count: number; note?: string }) {
  return (
    <div className="flex h-5 items-center gap-2 text-[13px]">
      <span className="text-fg-3">{icon}</span>
      <span className="font-medium tracking-[-0.005em] text-fg">{title}</span>
      <span className="font-mono text-[11px] text-fg-3 tabular">
        <NumberFlow value={count} />
      </span>
      {note && <span className="ms-auto truncate text-[11.5px] text-danger">{note}</span>}
    </div>
  );
}

function FileChip({ file, compact = false }: { file: FileItem; compact?: boolean }) {
  return (
    <Draggable
      id={file.id}
      label={file.name}
      className={
        compact
          ? "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line-2 bg-frame px-2 text-[12px] text-fg"
          : "flex h-9 w-full items-center gap-2 rounded-lg border border-line-2 bg-frame px-2.5 text-start text-[12.5px] text-fg hover:border-fg-4"
      }
    >
      <span className="w-9 shrink-0 rounded-[3px] border border-line-2 text-center font-mono text-[9.5px] uppercase leading-[14px] tracking-[0.04em] text-fg-3">
        {file.ext}
      </span>
      <span className="min-w-0 truncate">{file.name}</span>
    </Draggable>
  );
}
