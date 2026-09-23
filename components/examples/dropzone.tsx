"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { Dropzone, formatBytes, middleTruncate } from "@/components/ui/dropzone";

type Item = { id: string; name: string; size: number };

// An expense claim: receipts go in the big zone, the signed approval in the compact one.
export default function Demo() {
  const reduce = useReducedMotion();
  const [receipts, setReceipts] = useState<Item[]>([{ id: "seed", name: "uber-sfo-to-hotel-0914.pdf", size: 212_000 }]);
  const [approval, setApproval] = useState<Item | null>(null);

  const toItems = (files: File[]) => files.map((f) => ({ id: `${f.name}-${f.size}-${f.lastModified}`, name: f.name, size: f.size }));

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-medium tracking-[-0.01em] text-fg">Receipts</h3>
          <span className="text-[12px] text-fg-3 tabular">{receipts.length} of 10</span>
        </div>
        <Dropzone
          accept={["image/*", ".pdf"]}
          maxSize={10 * 1024 * 1024}
          maxFiles={10 - receipts.length}
          disabled={receipts.length >= 10}
          onFilesAccepted={(files) => setReceipts((r) => [...r, ...toItems(files).filter((n) => !r.some((o) => o.id === n.id))])}
        />
        <ul aria-label="Attached receipts" className="flex flex-col">
          <AnimatePresence initial={false}>
            {receipts.map((r) => (
              <motion.li
                key={r.id}
                layout={reduce ? false : "position"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.in } }}
                transition={{ duration: 0.24, ease: ease.out }}
                className="overflow-hidden"
              >
                <div className="flex h-9 items-center gap-2.5 border-b border-line pl-1 pr-0.5">
                  <FileGlyph />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg" title={r.name}>{middleTruncate(r.name, 34)}</span>
                  <span className="shrink-0 text-[12px] text-fg-3 tabular">{formatBytes(r.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => setReceipts((all) => all.filter((x) => x.id !== r.id))}
                    className={cn(
                      "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3",
                      "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                      "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92]",
                      "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
                      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
                    </svg>
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-medium tracking-[-0.01em] text-fg">Manager approval</h3>
        <Dropzone
          size="sm"
          accept=".pdf"
          maxSize={5 * 1024 * 1024}
          multiple={false}
          paste={false}
          title={approval ? middleTruncate(approval.name, 30) : "Signed approval form"}
          hint={approval ? `${formatBytes(approval.size)} · Drop a PDF to replace` : undefined}
          browseLabel={approval ? "Replace" : "Browse"}
          label={approval ? "Replace approval form" : "Choose approval form"}
          onFilesAccepted={(files) => setApproval(toItems(files)[0])}
        />
      </section>
    </div>
  );
}

function FileGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="shrink-0 text-fg-3" aria-hidden>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
    </svg>
  );
}
