"use client";
import { useEffect, useRef, useState } from "react";
import { ActivityFeed, type ActivityItem } from "@/components/ui/activity-feed";

const min = 60_000;
const hour = 60 * min;

const Code = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-[12px]">{children}</span>;

function seed(now: number): ActivityItem[] {
  return [
    { id: "a1", kind: "merge", actor: { name: "Mara Okafor" }, action: "merged", target: { label: <Code>#412</Code>, href: "#pr-412" }, suffix: "Pin the billing toggle on mobile", at: now - 4 * min },
    {
      id: "a2",
      kind: "comment",
      actor: { name: "Jonah Park" },
      action: "commented on",
      target: { label: <Code>#415</Code>, href: "#pr-415" },
      detail: <p className="border-l-2 border-line-2 pl-2.5 text-fg-2">Can we keep the annual price visible when the toggle is sticky?</p>,
      at: now - 38 * min,
    },
    { id: "a3", kind: "deploy", actor: { name: "Leo Brandt" }, action: "deployed", target: { label: <Code>web@4f2a91c</Code> }, suffix: "to production", at: now - 2 * hour },
    { id: "a4", kind: "approve", actor: { name: "Inès Moreau" }, action: "approved", target: { label: <Code>#412</Code>, href: "#pr-412" }, at: now - 3 * hour },
    { id: "a5", kind: "request-changes", actor: { name: "Priya Raman" }, action: "requested changes on", target: { label: <Code>#409</Code>, href: "#pr-409" }, at: now - 26 * hour },
    { id: "a6", kind: "open", actor: { name: "Sam Whitaker" }, action: "opened", target: { label: <Code>#415</Code>, href: "#pr-415" }, suffix: "Annual price stays visible", at: now - 28 * hour },
    { id: "a7", kind: "release", actor: { name: "Leo Brandt" }, action: "published", target: { label: <Code>v2.8.0</Code> }, at: now - 30 * hour },
  ];
}

const live: Omit<ActivityItem, "id" | "at">[] = [
  { kind: "commit", actor: { name: "Leo Brandt" }, action: "pushed 2 commits to", target: { label: <Code>fix/sticky-toggle</Code> } },
  { kind: "comment", actor: { name: "Mara Okafor" }, action: "commented on", target: { label: <Code>#415</Code>, href: "#pr-415" } },
  { kind: "approve", actor: { name: "Jonah Park" }, action: "approved", target: { label: <Code>#415</Code>, href: "#pr-415" } },
  { kind: "deploy", actor: { name: "Inès Moreau" }, action: "deployed", target: { label: <Code>web@9b1e07d</Code> }, suffix: "to staging" },
];

function older(now: number, page: number): ActivityItem[] {
  const base = now - (3 + page * 2) * 24 * hour;
  return [
    { id: `o${page}-1`, kind: "close", actor: { name: "Priya Raman" }, action: "closed", target: { label: <Code>#{398 - page * 4}</Code> }, suffix: "Duplicate of the pricing work", at: base - hour },
    { id: `o${page}-2`, kind: "invite", actor: { name: "Mara Okafor" }, action: "invited", target: { label: "Sam Whitaker" }, suffix: "to the project", at: base - 3 * hour },
    { id: `o${page}-3`, kind: "upload", actor: { name: "Jonah Park" }, action: "uploaded", target: { label: <Code>pricing-v3.fig</Code> }, at: base - 26 * hour },
  ];
}

// A repository's activity: new events arrive every few seconds while it's on screen.
export default function Demo() {
  const [items, setItems] = useState<ActivityItem[]>(() => seed(Date.now()));
  const [pages, setPages] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  // Live events only while the demo is visible and the tab is in front.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let visible = false;
    let n = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const t = window.setInterval(() => {
      if (!visible || document.hidden) return;
      const next = live[n % live.length];
      n += 1;
      setItems((list) => [{ ...next, id: `l${Date.now()}`, at: Date.now() }, ...list]);
    }, 7000);
    return () => {
      io.disconnect();
      window.clearInterval(t);
    };
  }, []);

  return (
    <div ref={root} className="w-full max-w-[480px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">northwind/web</p>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
          <span aria-hidden className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-success animate-ping-soft" />
            <span className="relative size-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>
      <ActivityFeed
        items={items}
        maxHeight={380}
        hasMore={pages < 2}
        onLoadMore={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setItems((list) => [...list, ...older(Date.now(), pages)]);
              setPages((p) => p + 1);
              resolve();
            }, 900),
          )
        }
        endLabel="Repository created · 14 Aug"
        className="px-3 pb-2"
      />
    </div>
  );
}
