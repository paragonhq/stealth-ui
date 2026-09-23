"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { WhatsNew, WhatsNewContent, WhatsNewTrigger, type ChangelogEntry } from "@/components/ui/whats-new";

// Small drawings on a 160×90 grid, so they read the same as a thumbnail and full width.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" fill="none" aria-hidden>
    {children}
  </svg>
);

const art = {
  previews: (
    <Frame>
      <path d="M20 62h40c10 0 12-26 26-26h54" className="stroke-fg-4" strokeWidth="1.5" />
      <path d="M20 62h120" className="stroke-line-2" strokeWidth="1.5" />
      <circle cx="20" cy="62" r="4" className="fill-raised stroke-fg-3" strokeWidth="1.5" />
      <circle cx="96" cy="36" r="4" className="fill-fg" />
      <rect x="84" y="46" width="62" height="22" rx="5" className="fill-raised stroke-line-2" />
      <circle cx="93" cy="57" r="2.5" className="fill-success" />
      <rect x="99" y="54.5" width="38" height="5" rx="2.5" className="fill-fg-3" />
    </Frame>
  ),
  palette: (
    <Frame>
      <rect x="30" y="14" width="100" height="62" rx="7" className="fill-raised stroke-line-2" />
      <rect x="38" y="22" width="52" height="5" rx="2.5" className="fill-fg-4" />
      <path d="M30 34h100" className="stroke-line-2" />
      <rect x="35" y="39" width="90" height="10" rx="3" className="fill-hover" />
      <rect x="40" y="42.5" width="40" height="3" rx="1.5" className="fill-fg" />
      <rect x="40" y="55" width="54" height="3" rx="1.5" className="fill-fg-4" />
      <rect x="40" y="65" width="32" height="3" rx="1.5" className="fill-fg-4" />
    </Frame>
  ),
  usage: (
    <Frame>
      {[28, 44, 36, 58, 50, 66, 40].map((h, i) => (
        <rect key={i} x={30 + i * 15} y={74 - h} width="9" height={h} rx="2" className={i === 5 ? "fill-fg" : "fill-fg-4"} />
      ))}
      <path d="M24 74h112" className="stroke-line-2" />
    </Frame>
  ),
  comments: (
    <Frame>
      <rect x="28" y="18" width="78" height="22" rx="8" className="fill-raised stroke-line-2" />
      <rect x="36" y="26" width="46" height="4" rx="2" className="fill-fg-3" />
      <rect x="54" y="48" width="78" height="22" rx="8" className="fill-fg" />
      <rect x="62" y="56" width="52" height="4" rx="2" className="fill-frame" />
    </Frame>
  ),
  builds: (
    <Frame>
      {[
        [30, 84, "fill-fg-4"],
        [30, 50, "fill-fg"],
        [30, 96, "fill-fg-4"],
        [30, 34, "fill-fg"],
      ].map(([x, w, c], i) => (
        <g key={i}>
          <rect x={x as number} y={22 + i * 13} width="100" height="6" rx="3" className="fill-hover" />
          <rect x={x as number} y={22 + i * 13} width={w as number} height="6" rx="3" className={c as string} />
        </g>
      ))}
    </Frame>
  ),
};

const entries: ChangelogEntry[] = [
  {
    id: "2026-09-previews",
    title: "Preview deploys for every branch",
    date: "2026-09-19",
    tag: "Feature",
    image: art.previews,
    summary: "Each push gets its own URL, torn down when the branch is merged.",
    body: (
      <>
        <p>Every push to a branch now builds its own preview with a stable URL, posted to the pull request.</p>
        <p>Previews are torn down when the branch merges, so they never count against your limits.</p>
      </>
    ),
    href: "#previews",
  },
  {
    id: "2026-09-palette",
    title: "Jump anywhere with ⌘K",
    date: "2026-09-15",
    tag: "Feature",
    image: art.palette,
    body: "Projects, deploys, settings and people, one shortcut away. Start typing a branch name to open its latest preview.",
  },
  {
    id: "2026-09-usage",
    title: "Usage by project",
    date: "2026-09-08",
    tag: "Improvement",
    image: art.usage,
    body: "Bandwidth and build minutes now break down by project, so you can see which one is behind a spike.",
  },
  {
    id: "2026-08-comments",
    title: "Comments on previews",
    date: "2026-08-27",
    tag: "Feature",
    image: art.comments,
    body: "Pin a comment to any element on a preview. Replies land in the pull request.",
  },
  {
    id: "2026-08-builds",
    title: "Faster builds for large monorepos",
    date: "2026-08-12",
    tag: "Fix",
    image: art.builds,
    body: "Cache keys now include the workspace, so unrelated packages stop invalidating each other. Typical builds are 40% faster.",
  },
];

const deploys = [
  { branch: "main", sha: "a41f9c2", state: "bg-success", when: "2m" },
  { branch: "fix/apple-pay-safari", sha: "9be03d1", state: "bg-warning", when: "14m" },
  { branch: "feat/webhook-retries", sha: "77c2a5e", state: "bg-success", when: "1h" },
  { branch: "chore/deps-september", sha: "e2d9b10", state: "bg-danger", when: "3h" },
];

// A deploy dashboard's top bar, with three updates this person hasn't seen yet.
export default function Demo() {
  const [read, setRead] = useState(["2026-08-comments", "2026-08-builds"]);
  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-12 items-center gap-2 border-b border-line pl-4 pr-2">
        <p className="mr-auto truncate text-[13px] font-medium text-fg">Deployments</p>
        <WhatsNew entries={entries} read={read} onReadChange={setRead}>
          <WhatsNewTrigger />
          <WhatsNewContent changelogHref="#changelog" />
        </WhatsNew>
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-hover text-[10px] font-medium text-fg-2">
          MC
        </span>
      </div>
      <ul className="p-1.5">
        {deploys.map((d) => (
          <li key={d.sha} className="flex h-11 items-center gap-3 rounded-lg px-2.5">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", d.state)} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{d.branch}</span>
            <span className="font-mono text-[11px] text-fg-3 max-[380px]:hidden">{d.sha}</span>
            <span className="tabular w-8 text-right text-[11.5px] text-fg-3">{d.when}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
