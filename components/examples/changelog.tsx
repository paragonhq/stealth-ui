"use client";
import { useState } from "react";
import { Clock } from "@/lib/icons";
import { Changelog, type ChangelogRelease } from "@/components/ui/changelog";

const recent: ChangelogRelease[] = [
  {
    version: "v2.14.0",
    date: "2026-09-18",
    title: "Boards now work offline",
    summary: "Open, edit and reorder cards on a plane or a bad hotel connection. Everything syncs the moment you’re back, and conflicts are shown side by side instead of overwritten.",
    media: <OfflineBoard />,
    changes: [
      { type: "new", text: "Boards, cards and comments open without a connection and queue your edits." },
      { type: "new", text: <>A <strong>Sync</strong> panel lists what’s waiting and lets you retry one change at a time.</> },
      { type: "improved", text: "Search returns results from cached boards while offline." },
      { type: "fixed", text: "Dragging a card onto a collapsed column no longer drops it at the top." },
    ],
  },
  {
    version: "v2.13.2",
    date: "2026-09-09",
    title: "Fixes for due dates and exports",
    changes: [
      { type: "fixed", text: "Due dates set near midnight kept the right day across time zones." },
      { type: "fixed", text: <>CSV exports escape commas in card titles, so <code>q3-forecast.xlsx</code> imports cleanly.</> },
      { type: "fixed", text: "The mention menu closes when you press Escape inside a comment." },
    ],
  },
  {
    version: "v2.13.0",
    date: "2026-08-28",
    title: "Custom fields on every card",
    summary: "Add a number, date, person or dropdown to any card, then sort and filter the board by it.",
    changes: [
      { type: "new", text: "Five field types, shared across every board in a workspace." },
      { type: "new", text: "Sort a column by any field, including people and dates." },
      { type: "improved", text: "Card previews show up to three fields without opening the card." },
      { type: "improved", text: "Filters remember your last choice per board." },
    ],
  },
  {
    version: "v2.12.0",
    date: "2026-08-12",
    title: "Large boards load twice as fast",
    image: {
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1100&q=70",
      alt: "A performance dashboard charting page load times",
      width: 1100,
      height: 620,
      caption: "Median load for a 2,000-card board fell from 2.1s to 0.9s.",
    },
    changes: [
      { type: "improved", text: "Boards with 2,000+ cards render the visible columns first and stream the rest." },
      { type: "improved", text: "Opening a card no longer refetches the whole board." },
      { type: "fixed", text: "Archived cards stopped reappearing after a refresh." },
    ],
  },
];

const older: ChangelogRelease[] = [
  {
    version: "v2.11.0",
    date: "2026-07-30",
    title: "Guests can comment",
    summary: "Invite clients to a single board. They can read and comment, and nothing else.",
    changes: [
      { type: "new", text: "Guest invites, limited to the boards you share." },
      { type: "improved", text: "The share dialog shows who can see a board and why." },
    ],
  },
  {
    version: "v2.10.1",
    date: "2026-07-18",
    title: "Fixes for notifications",
    changes: [{ type: "fixed", text: "Email digests stopped repeating yesterday’s mentions." }],
  },
];

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A product changelog in the scroll box a docs page gives it. Scroll to watch the
// rail follow you, hover a title to copy its link, filter to just the fixes.
export default function Demo() {
  const [releases, setReleases] = useState(recent);
  return (
    <div className="h-[480px] w-full max-w-[640px] overflow-y-auto overscroll-contain rounded-xl border border-line bg-frame px-4 pt-5 sm:px-6">
      <Changelog
        releases={releases}
        headingLevel={3}
        hasMore={releases.length === recent.length}
        onLoadMore={async () => {
          await pause(900);
          setReleases((r) => [...r, ...older]);
        }}
      />
    </div>
  );
}

// The release's screenshot, drawn in the page's own tokens so it follows the theme.
function OfflineBoard() {
  const columns = [
    { name: "In progress", cards: [{ title: "Draft Q3 pricing page", waiting: true }, { title: "Audit onboarding emails" }] },
    { name: "Review", cards: [{ title: "Export q3-forecast.xlsx", waiting: true }, { title: "Rename billing plans" }] },
  ];
  return (
    <figure className="flex max-w-[640px] flex-col gap-2">
      <div role="img" aria-label="A board offline, with two cards waiting to sync" className="flex flex-col gap-2.5 rounded-lg border border-line bg-raised p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-fg">Launch board</span>
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-2 text-[11px] font-medium text-warning">Offline · 2 waiting</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {columns.map((c) => (
            <div key={c.name} className="flex min-w-0 flex-col gap-1.5 rounded-md bg-hover p-1.5">
              <span className="px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">{c.name}</span>
              {c.cards.map((card) => (
                <div key={card.title} className="flex min-w-0 items-center gap-1.5 rounded-[5px] border border-line bg-frame px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg-2">{card.title}</span>
                  {card.waiting && <Clock size={12} className="shrink-0 text-fg-3" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="text-[12px] text-fg-3">Cards changed offline carry a small clock until they sync.</figcaption>
    </figure>
  );
}
