"use client";
import { useState } from "react";
import { UsageMeter } from "@/components/ui/usage-meter";

const archive = 1.8;

// A workspace's plan page: storage by category, with an archive you can keep uploading until it spills over.
export default function Demo() {
  const [archives, setArchives] = useState(0);

  const segments = [
    { label: "Documents", value: 3.1 },
    { label: "Media", value: 2.6 },
    { label: "Backups", value: 1.5 + archives * archive },
  ];

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="px-4 pb-3 pt-4">
        <UsageMeter
          label="Storage"
          max={10}
          unit="GB"
          segments={segments}
          action={
            <button
              type="button"
              className="h-7 shrink-0 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Upgrade plan
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-line px-4 py-3">
        <UsageMeter label="Seats" max={10} value={9} size="sm" decimals={0} />
        <UsageMeter label="Builds" max={3000} value={1240} size="sm" decimals={0} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="min-w-0 truncate font-mono text-[12px] text-fg-3">q3-archive.zip · 1.8 GB</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setArchives(0)}
            disabled={archives === 0}
            className="h-7 rounded-md px-2.5 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            Delete copies
          </button>
          <button
            type="button"
            onClick={() => setArchives((n) => n + 1)}
            disabled={archives >= 3}
            className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
