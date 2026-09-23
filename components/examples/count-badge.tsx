"use client";
import { useState } from "react";
import { Bell, Inbox, AtSign, File } from "@/lib/icons";
import { CountBadge } from "@/components/ui/count-badge";

const iconButton =
  "relative grid size-8 place-items-center rounded-lg text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.94] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

const button =
  "inline-flex h-8 items-center gap-2 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

// A workspace header and sidebar: the three places a count actually lives.
export default function Demo() {
  const [inbox, setInbox] = useState(3);
  const [alerts, setAlerts] = useState(97);
  const [mentions, setMentions] = useState(1);
  const [updates, setUpdates] = useState(1);

  const receive = () => {
    setInbox((n) => n + 1);
    setAlerts((n) => n + 1);
    setMentions((n) => n + 1);
    setUpdates((n) => n + 1);
  };
  const clear = () => {
    setInbox(0);
    setAlerts(0);
    setMentions(0);
    setUpdates(0);
  };
  const unread = inbox + alerts + mentions + updates;

  const rows = [
    { label: "Inbox", icon: Inbox, count: inbox },
    { label: "Mentions", icon: AtSign, count: mentions },
    { label: "Drafts", icon: File, count: 0 },
  ];

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)] [--badge-cutout:var(--frame)]">
        <div className="flex h-12 items-center gap-2.5 border-b border-line px-3">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-fg font-mono text-[11px] font-medium text-frame">N</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Northwind</span>
          <button type="button" className={iconButton}>
            <span className="sr-only">Inbox</span>
            <Inbox />
            <CountBadge count={inbox} tone="danger" size="sm" position="top-right" className="right-1! top-1!" label={(n) => `${n} unread`} />
          </button>
          <button type="button" className={iconButton}>
            <span className="sr-only">Notifications</span>
            <Bell />
            <CountBadge count={alerts} size="sm" position="top-right" className="right-1! top-1!" label={(n) => `${n} unread`} />
          </button>
          <CountBadge count={updates} dot overlap="circular" position="top-right" label={() => "New updates on your profile"} className="ml-1.5">
            <span className="grid size-7 place-items-center rounded-full bg-hover text-[11px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">MC</span>
          </CountBadge>
        </div>
        <ul className="flex flex-col p-1.5" aria-label="Folders">
          {rows.map(({ label, icon: Icon, count }) => (
            <li key={label}>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-2 outline-none transition-colors duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
              >
                <Icon className="shrink-0 text-fg-3" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <CountBadge count={count} tone="muted" label={(n) => `${n} unread`} />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[12px] text-fg-3 tabular">{unread === 0 ? "All caught up" : `${unread} unread`}</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={button} onClick={clear} disabled={unread === 0}>
            Mark all read
          </button>
          <button type="button" className={button} onClick={receive}>
            Receive
          </button>
        </div>
      </div>
    </div>
  );
}
