"use client";
import { Switch } from "@base-ui/react/switch";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { File, Hash, User } from "@/lib/icons";
import { CommandPaletteTrigger } from "@/components/ui/command-palette";
import { Kbd } from "@/components/ui/kbd";
import { SearchDialog, type SearchResult } from "@/components/ui/search-dialog";

const data: SearchResult[] = [
  {
    id: "d1", kind: "docs", title: "Webhook retries and backoff", subtitle: "Docs › Webhooks", icon: <File />, href: "https://acme.dev/docs/webhooks/retries",
    excerpt: "Failed deliveries are retried up to 8 times over 24 hours with exponential backoff. After the last attempt the endpoint is marked unhealthy and you get an email.",
    meta: [["Updated", "2 days ago"], ["Owner", "Platform team"], ["Reading time", "4 min"]],
  },
  {
    id: "d2", kind: "docs", title: "Verifying webhook signatures", subtitle: "Docs › Webhooks", icon: <File />, href: "https://acme.dev/docs/webhooks/signatures",
    excerpt: "Every webhook carries an Acme-Signature header. Compute an HMAC of the raw body with your signing secret and compare it in constant time before trusting the payload.",
    meta: [["Updated", "3 weeks ago"], ["Owner", "Security"], ["Reading time", "6 min"]],
  },
  {
    id: "d3", kind: "docs", title: "Billing plans and proration", subtitle: "Docs › Billing", icon: <File />, href: "https://acme.dev/docs/billing/proration",
    excerpt: "Upgrades take effect immediately and are prorated to the day. Downgrades apply at the end of the billing period so nobody loses paid time.",
    meta: [["Updated", "Yesterday"], ["Owner", "Billing"], ["Reading time", "5 min"]],
  },
  {
    id: "d4", kind: "docs", title: "Rotating API keys without downtime", subtitle: "Docs › Security", icon: <File />, href: "https://acme.dev/docs/security/api-keys",
    excerpt: "Create the new key, deploy it alongside the old one, then revoke the old key once traffic has moved. Both keys work during the overlap.",
    meta: [["Updated", "1 month ago"], ["Owner", "Security"], ["Reading time", "3 min"]],
  },
  {
    id: "d5", kind: "docs", title: "Rate limits", subtitle: "Docs › API reference", icon: <File />, href: "https://acme.dev/docs/api/rate-limits",
    excerpt: "Requests are limited to 100 per second per key. Responses include RateLimit headers; back off when you receive a 429 and retry after the reset.",
    meta: [["Updated", "5 days ago"], ["Owner", "Platform team"], ["Reading time", "2 min"]],
  },
  {
    id: "i1", kind: "issues", title: "Retry failed webhooks with backoff", subtitle: "ENG-482 · In progress", icon: <Hash />, href: "https://acme.dev/issues/ENG-482",
    excerpt: "Deliveries that time out are dropped today. Retry with exponential backoff, cap at 8 attempts, then mark the endpoint unhealthy and notify the owner.",
    meta: [["Assignee", "Maya Chen"], ["Priority", "High"], ["Cycle", "Cycle 32"]],
  },
  {
    id: "i2", kind: "issues", title: "Billing page shows stale plan after upgrade", subtitle: "ENG-479 · Todo", icon: <Hash />, href: "https://acme.dev/issues/ENG-479",
    excerpt: "After upgrading from Starter to Team the billing page keeps showing Starter until a hard refresh. The plan cache isn't invalidated on the webhook.",
    meta: [["Assignee", "Jonas Weber"], ["Priority", "Medium"], ["Cycle", "Cycle 32"]],
  },
  {
    id: "i3", kind: "issues", title: "Rate limit the public search endpoint", subtitle: "ENG-466 · Todo", icon: <Hash />, href: "https://acme.dev/issues/ENG-466",
    excerpt: "Anonymous search traffic spiked to 4k requests per minute. Add a per-IP rate limit and return Retry-After.",
    meta: [["Assignee", "Priya Raman"], ["Priority", "Urgent"], ["Cycle", "Cycle 33"]],
  },
  {
    id: "i4", kind: "issues", title: "Audit log misses API key rotations", subtitle: "ENG-460 · Done", icon: <Hash />, href: "https://acme.dev/issues/ENG-460",
    excerpt: "Rotating a key didn't write an audit event. Fixed by emitting key.rotated from the rotation job.",
    meta: [["Assignee", "Sam Okafor"], ["Priority", "Low"], ["Cycle", "Cycle 31"]],
  },
  {
    id: "p1", kind: "people", title: "Maya Chen", subtitle: "Staff engineer · Platform", icon: <User />,
    excerpt: "Owns webhooks, delivery and the retry pipeline. Ask about backoff, signing and endpoint health.",
    meta: [["Email", "maya@acme.co"], ["Local time", "9:41 AM, Berlin"], ["Team", "Platform"]],
  },
  {
    id: "p2", kind: "people", title: "Jonas Weber", subtitle: "Engineer · Billing", icon: <User />,
    excerpt: "Works on plans, invoices and proration. On call this week for billing incidents.",
    meta: [["Email", "jonas@acme.co"], ["Local time", "9:41 AM, Berlin"], ["Team", "Billing"]],
  },
  {
    id: "p3", kind: "people", title: "Priya Raman", subtitle: "Engineering manager · Search", icon: <User />,
    excerpt: "Leads the search team: indexing, ranking and the public search endpoint.",
    meta: [["Email", "priya@acme.co"], ["Local time", "1:11 PM, Bengaluru"], ["Team", "Search"]],
  },
];

// A workspace search that really waits for the network. Turn the connection off to see it fail.
export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  const [offline, setOffline] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);

  const search = (query: string, { signal }: { signal: AbortSignal }) =>
    new Promise<SearchResult[]>((resolve, reject) => {
      const tokens = query.toLowerCase().split(/\s+/);
      const t = window.setTimeout(() => {
        if (offline) return reject(new Error("Couldn’t reach search. Check your connection."));
        resolve(data.filter((r) => tokens.every((tok) => `${r.title} ${r.subtitle} ${r.excerpt}`.toLowerCase().includes(tok))));
      }, 260 + query.length * 40);
      signal.addEventListener("abort", () => window.clearTimeout(t));
    });

  return (
    <div
      ref={frame}
      tabIndex={-1}
      className="relative flex h-[460px] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)] outline-none"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Acme</span>
        <span className="text-[12px] text-fg-4">/</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-3">Platform</span>
        <SearchDialog
          search={search}
          filters={[
            { value: "docs", label: "Docs" },
            { value: "issues", label: "Issues" },
            { value: "people", label: "People" },
          ]}
          placeholder="Search docs, issues and people…"
          defaultRecent={["webhook retries", "proration", "rate limit"]}
          container={frame}
          hotkeyTarget={frame}
          onSelect={(r) => setOpened(r.title)}
        >
          <CommandPaletteTrigger label="Search…" shortcut="/" className="max-w-[180px]" />
        </SearchDialog>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[13px] text-fg-2">{opened ? <>Opened <span className="text-fg">{opened}</span></> : "Nothing open"}</p>
        <p className="text-[12px] text-fg-3">
          Click in the window and press <Kbd keys="/" size="sm" className="mx-0.5" /> to search
        </p>
      </div>

      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-line px-3 text-[12px] text-fg-3">
        <span className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full transition-colors", offline ? "bg-danger" : "bg-success")} />
          {offline ? "Offline" : "Connected"}
        </span>
        <label className="flex cursor-default items-center gap-2 select-none">
          Simulate offline
          <Switch.Root
            checked={offline}
            onCheckedChange={setOffline}
            className={cn(
              "relative flex h-[18px] w-[30px] items-center rounded-full border border-line-2 bg-fg/[0.08] p-px outline-none transition-colors duration-150",
              "data-checked:border-transparent data-checked:bg-fg",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            )}
          >
            <Switch.Thumb className="size-3.5 rounded-full bg-fg shadow-[var(--shadow)] transition-[translate,background-color] duration-200 ease-out-quart data-checked:translate-x-3 data-checked:bg-frame" />
          </Switch.Root>
        </label>
      </div>
    </div>
  );
}
