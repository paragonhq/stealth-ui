"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { TabBar, TabBarIcons, TabBarItem } from "@/components/ui/tab-bar";

const deploys = [
  { name: "checkout-api", branch: "main", when: "2m", status: "Ready" },
  { name: "web", branch: "feat/pricing-v2", when: "14m", status: "Building" },
  { name: "docs", branch: "main", when: "38m", status: "Ready" },
  { name: "billing-worker", branch: "fix/retry-backoff", when: "1h", status: "Failed" },
  { name: "web", branch: "main", when: "2h", status: "Ready" },
  { name: "auth", branch: "chore/deps", when: "3h", status: "Ready" },
  { name: "checkout-api", branch: "feat/apple-pay", when: "5h", status: "Ready" },
  { name: "search-indexer", branch: "main", when: "6h", status: "Ready" },
];

const initialMessages = [
  { id: 1, from: "Maya Chen", text: "Pricing page is live on staging", unread: true },
  { id: 2, from: "Leo Park", text: "Can you review the retry fix before 4?", unread: true },
  { id: 3, from: "Ana Ruiz", text: "Invoice #1042 was paid", unread: true },
  { id: 4, from: "Jonas Olsen", text: "Thanks, merged.", unread: false },
];

const titles: Record<string, string> = { home: "Deployments", search: "Search", inbox: "Inbox", activity: "Activity", profile: "Account" };

// A phone with a real app in it: the inbox count rolls down as messages are read,
// activity clears when visited, and tapping Home again scrolls the feed to the top.
export default function Demo() {
  const [tab, setTab] = useState("home");
  const [messages, setMessages] = useState(initialMessages);
  const [seenActivity, setSeenActivity] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const unread = messages.filter((m) => m.unread).length;

  const change = (next: string) => {
    setTab(next);
    if (next === "activity") setSeenActivity(true);
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="relative h-[500px] w-[300px] max-w-full overflow-hidden rounded-[32px] border border-line-2 bg-frame shadow-[var(--shadow)]">
      <div className="flex h-9 items-end justify-between px-6 pb-1 font-mono text-2xs text-fg-2 tabular">
        <span>9:41</span>
        <span aria-hidden className="h-2.5 w-5 rounded-[3px] border border-fg-3 p-px"><span className="block h-full w-3/4 rounded-[1px] bg-fg-2" /></span>
      </div>
      <header className="px-5 pb-2 pt-2">
        <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">{titles[tab]}</h3>
      </header>

      <div ref={scroller} className="absolute inset-x-0 bottom-0 top-[84px] overflow-y-auto overscroll-contain pb-28 [scrollbar-width:none]">
        {tab === "home" && (
          <ul className="flex flex-col px-3">
            {deploys.map((d, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", d.status === "Ready" ? "bg-success" : d.status === "Failed" ? "bg-danger" : "bg-warning")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-fg">{d.name}</span>
                  <span className="block truncate font-mono text-[11px] text-fg-3">{d.branch}</span>
                </span>
                <span className="shrink-0 text-[12px] text-fg-3 tabular">{d.when}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "search" && (
          <div className="px-5">
            <div className="flex h-9 items-center rounded-lg bg-hover px-3 text-[15px] text-fg-4">Projects, people, deploys</div>
            <p className="mb-1 mt-5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Recent</p>
            {["checkout-api", "Maya Chen", "invoice 1042"].map((r) => (
              <p key={r} className="border-b border-line py-2.5 text-[14px] text-fg-2">{r}</p>
            ))}
          </div>
        )}

        {tab === "inbox" && (
          <div className="px-3">
            <ul>
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, unread: false } : x)))}
                    className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:bg-hover"
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full transition-colors", m.unread ? "bg-fg" : "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[13.5px]", m.unread ? "font-medium text-fg" : "text-fg-2")}>{m.from}</span>
                      <span className="block truncate text-[12.5px] text-fg-3">{m.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-2 pt-3 text-[12px] text-fg-4">{unread ? "Tap a message to mark it read" : "All caught up"}</p>
          </div>
        )}

        {tab === "activity" && (
          <ul className="px-5">
            {["Leo Park approved your pull request", "web deployed to production", "Ana Ruiz mentioned you in Q3 forecast"].map((a) => (
              <li key={a} className="border-b border-line py-3 text-[13.5px] text-fg-2">{a}</li>
            ))}
          </ul>
        )}

        {tab === "profile" && (
          <div className="px-5">
            <div className="flex items-center gap-3 py-2">
              <span className="grid size-11 place-items-center rounded-full bg-hover text-[14px] font-medium text-fg-2">RS</span>
              <span>
                <span className="block text-[14px] font-medium text-fg">Riley Santos</span>
                <span className="block text-[12.5px] text-fg-3">riley@northwind.dev</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <TabBar
        position="absolute"
        style={{ "--tab-bar-inset": "22px" } as React.CSSProperties}
        value={tab}
        onValueChange={change}
        onReselect={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <TabBarItem value="home" label="Home" icon={<TabBarIcons.Home />} />
        <TabBarItem value="search" label="Search" icon={<TabBarIcons.Search />} />
        <TabBarItem value="inbox" label="Inbox" icon={<TabBarIcons.Inbox />} badge={unread} badgeLabel={`${unread} unread`} />
        <TabBarItem value="activity" label="Activity" icon={<TabBarIcons.Bell />} badge={!seenActivity} />
        <TabBarItem value="profile" label="Account" icon={<TabBarIcons.User />} />
      </TabBar>
      <span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 z-(--z-sticky) h-[4px] w-28 -translate-x-1/2 rounded-full bg-fg/80" />
    </div>
  );
}
