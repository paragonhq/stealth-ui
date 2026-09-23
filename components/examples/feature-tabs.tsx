"use client";
import { Eye, Message, Undo } from "@/lib/icons";
import { FeatureTabs, FeatureTabsList, FeatureTabsPanel, FeatureTabsPanels, FeatureTabsPlayToggle, FeatureTabsTab } from "@/components/ui/feature-tabs";

// A deploy product's feature section: three tabs that tour on their own, a
// visual for each, and the control to stop the tour.
export default function Demo() {
  return (
    <FeatureTabs defaultValue="previews" interval={5000} className="w-full max-w-[720px]">
      <div className="flex min-w-0 flex-col gap-4">
        <FeatureTabsList aria-label="Features">
          <FeatureTabsTab value="previews" title="Preview every pull request" icon={<Eye />}>
            Each push gets its own URL, so reviewers open a link instead of pulling a branch.
          </FeatureTabsTab>
          <FeatureTabsTab value="comments" title="Comment on the exact pixel" icon={<Message />}>
            Feedback pins to the element it’s about and follows it through every redeploy.
          </FeatureTabsTab>
          <FeatureTabsTab value="rollbacks" title="Roll back in one click" icon={<Undo />}>
            Every deploy stays warm for 30 days. Promote an old one and traffic moves in seconds.
          </FeatureTabsTab>
        </FeatureTabsList>
        <div className="pl-5">
          <FeatureTabsPlayToggle />
        </div>
      </div>

      <FeatureTabsPanels>
        <FeatureTabsPanel value="previews">
          <PreviewVisual />
        </FeatureTabsPanel>
        <FeatureTabsPanel value="comments">
          <CommentVisual />
        </FeatureTabsPanel>
        <FeatureTabsPanel value="rollbacks">
          <RollbackVisual />
        </FeatureTabsPanel>
      </FeatureTabsPanels>
    </FeatureTabs>
  );
}

function Window({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="flex size-full flex-col overflow-hidden rounded-lg border border-line-2 bg-frame">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line px-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[7px] rounded-full bg-line-2" />
        ))}
        <span className="ml-2 flex h-[18px] min-w-0 items-center truncate rounded-md bg-hover px-2 font-mono text-[10px] text-fg-3">{url}</span>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

const Line = ({ w, strong }: { w: string; strong?: boolean }) => <span className={`block h-1.5 rounded-full ${strong ? "bg-fg-4" : "bg-line-2"}`} style={{ width: w }} />;

function PreviewVisual() {
  return (
    <div aria-hidden className="flex size-full flex-col gap-3 p-4 sm:p-5">
      <div className="min-h-0 flex-1">
        <Window url="pr-482.acme-web.preview.dev">
          <div className="flex flex-col gap-2.5 p-4">
            <Line w="42%" strong />
            <Line w="78%" />
            <Line w="64%" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-12 rounded-md border border-line bg-raised" />
              ))}
            </div>
          </div>
        </Window>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-frame px-3 py-2">
        <span className="size-1.5 shrink-0 rounded-full bg-success" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
          Ready <span className="text-fg-3">· fix: keep checkout button above the fold</span>
        </span>
        <span className="tabular shrink-0 font-mono text-[10.5px] text-fg-3">38s</span>
      </div>
    </div>
  );
}

function CommentVisual() {
  return (
    <div aria-hidden className="size-full p-4 sm:p-5">
      <Window url="acme.com/checkout">
        <div className="flex flex-col gap-2.5 p-4">
          <Line w="36%" strong />
          <Line w="70%" />
          <div className="relative mt-3 flex items-center justify-between rounded-md border border-line bg-raised px-3 py-2.5">
            <Line w="40%" />
            <span className="rounded-md bg-fg px-2.5 py-1 text-[10.5px] font-medium text-frame">Pay $48.00</span>
            {/* The pin sits on the element, the thread hangs off it. */}
            <span className="absolute -right-1.5 -top-2.5 grid size-5 place-items-center rounded-full rounded-bl-none bg-fg text-[8.5px] font-semibold text-frame ring-2 ring-frame">
              MC
            </span>
          </div>
          <div className="ml-auto mt-1 w-[82%] max-w-[240px] rounded-lg border border-line-2 bg-raised p-2.5 shadow-pop">
            <div className="flex items-center gap-1.5 text-[10.5px]">
              <span className="font-medium text-fg">Maya Chen</span>
              <span className="text-fg-4">2m</span>
            </div>
            <p className="mt-1 text-[11.5px] leading-[1.45] text-fg-2">Can this stay pinned on mobile? It scrolls away on small phones.</p>
          </div>
        </div>
      </Window>
    </div>
  );
}

const deploys = [
  { msg: "Add annual billing toggle", sha: "8f3c2a1", age: "12m", current: true },
  { msg: "Tighten checkout spacing", sha: "e41b09d", age: "3h" },
  { msg: "Upgrade image pipeline", sha: "2c7d5e8", age: "Yesterday" },
  { msg: "Fix tax on EU invoices", sha: "91a4f36", age: "2d" },
];

function RollbackVisual() {
  return (
    <div aria-hidden className="flex size-full flex-col justify-center p-4 sm:p-5">
      <div className="overflow-hidden rounded-lg border border-line-2 bg-frame">
        <div className="flex h-8 items-center justify-between border-b border-line px-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-3">Production</span>
          <span className="text-[10.5px] text-fg-4">4 deploys</span>
        </div>
        <ul>
          {deploys.map((d, i) => (
            <li key={d.sha} className={`flex h-11 items-center gap-3 px-3 ${i ? "border-t border-line" : ""} ${i === 1 ? "bg-hover" : ""}`}>
              <span className={`size-1.5 shrink-0 rounded-full ${d.current ? "bg-success" : "bg-fg-4"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-fg">{d.msg}</span>
                <span className="block font-mono text-[10px] text-fg-3">
                  {d.sha} · {d.age}
                </span>
              </span>
              {d.current ? (
                <span className="rounded-full border border-line-2 px-2 py-0.5 text-[10.5px] text-fg-2">Current</span>
              ) : i === 1 ? (
                <span className="rounded-md border border-line-2 bg-raised px-2 py-1 text-[10.5px] font-medium text-fg shadow-[var(--shadow)]">Promote</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
