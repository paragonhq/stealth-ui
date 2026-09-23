"use client";
import { useEffect, useRef, useState } from "react";
import { Download, File, Link, Message, MoreH, Refresh, Trash } from "@/lib/icons";
import { IconButton, IconButtonProvider } from "@/components/ui/icon-button";

const files = [
  { name: "q3-forecast.xlsx", meta: "2.4 MB · Maya Chen" },
  { name: "board-deck-final-v7-with-appendix.pdf", meta: "11.8 MB · Theo Park" },
];

// A document header: a warm row of tooltips, a sync that spins in place, and
// dense row actions that still take a full tap on a phone.
export default function Demo() {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState("4m ago");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const sync = () => {
    setSyncing(true);
    timer.current = window.setTimeout(() => {
      setSyncing(false);
      setSynced("just now");
    }, 1400);
  };

  return (
    <IconButtonProvider>
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center gap-3 border-b border-line py-2.5 pl-4 pr-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Q3 planning</p>
            <p className="text-[12px] text-fg-3" aria-live="polite">
              {syncing ? "Syncing…" : `Synced ${synced}`}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label={syncing ? "Syncing" : "Sync now"} loading={syncing} onClick={sync}>
              <Refresh />
            </IconButton>
            <IconButton label="Comments" shortcut="⌘ ⇧ M">
              <Message />
            </IconButton>
            <IconButton label="Copy link" shortcut="⌘ L">
              <Link />
            </IconButton>
            <IconButton label="More actions" variant="secondary" className="ml-1.5">
              <MoreH />
            </IconButton>
          </div>
        </div>

        <ul aria-label="Attachments" className="flex flex-col p-1.5">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-2.5 rounded-lg py-1.5 pl-2.5 pr-1.5 hover:bg-hover">
              <File className="size-4 shrink-0 text-fg-3" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-fg">{f.name}</p>
                <p className="truncate text-[11.5px] text-fg-3">{f.meta}</p>
              </div>
              <IconButton size="sm" label={`Download ${f.name}`} tooltip="Download">
                <Download />
              </IconButton>
              <IconButton size="sm" label={`Delete ${f.name}`} tooltip="Delete" tooltipSide="bottom">
                <Trash />
              </IconButton>
            </li>
          ))}
        </ul>
      </div>
    </IconButtonProvider>
  );
}
