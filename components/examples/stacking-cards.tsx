"use client";
import { useRef } from "react";
import { ArrowRight, Check, Globe, Terminal } from "@/lib/icons";
import { StackingCard, StackingCards } from "@/components/ui/stacking-cards";

const steps = [
  {
    n: "01",
    title: "Connect a repository",
    body: "Pick a repo and a production branch. Nothing to configure for most frameworks.",
    art: (
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-frame px-3 py-2.5">
        <span className="grid size-6 place-items-center rounded-md border border-line-2 bg-raised text-fg-2">
          <Check size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg">northwind/atlas-web</span>
        <span className="font-mono text-2xs text-fg-3">main</span>
      </div>
    ),
  },
  {
    n: "02",
    title: "Push a branch",
    body: "Every push builds in its own environment, with the same settings as production.",
    art: (
      <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-line bg-frame px-3 py-2.5 font-mono text-[12px]">
        <Terminal size={14} className="shrink-0 text-fg-3" />
        <span className="truncate text-fg-2">
          git push origin <span className="text-fg">fix/invoice-rounding</span>
        </span>
      </div>
    ),
  },
  {
    n: "03",
    title: "Review the preview",
    body: "A preview URL lands on the pull request. Reviewers comment on the page itself.",
    art: (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-frame px-3 py-2.5">
        <Globe size={14} className="shrink-0 text-fg-3" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">atlas-web-git-fix-invoice.preview.app</span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-success">
          <span className="size-1.5 rounded-full bg-success" />
          Ready
        </span>
      </div>
    ),
  },
  {
    n: "04",
    title: "Promote to production",
    body: "Promote the exact build you reviewed. Rolling back is one click and takes seconds.",
    art: (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-frame py-2 pl-3 pr-2">
        <span className="text-[12px] text-fg-2">
          Production · <span className="tabular">38s</span>
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame">
          Promote
          <ArrowRight size={13} />
        </span>
      </div>
    ),
  },
];

// A "how it works" section inside its own scroll area: the steps pile up as you read.
export default function Demo() {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line-2 bg-frame">
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="How deploys work"
        className="h-[440px] overflow-y-auto overscroll-contain px-4 outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-4"
      >
        <header className="flex flex-col gap-1.5 pb-6 pt-8">
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">How it works</span>
          <h3 className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-fg text-balance">From a push to production in four steps</h3>
          <p className="text-[13px] text-fg-2">Scroll to stack them.</p>
        </header>

        <StackingCards root={scroller} top={16} peek={12} aria-label="Deploy steps" className="gap-5 pb-4">
          {steps.map((s) => (
            <StackingCard key={s.n} className="flex flex-col gap-4 p-4">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-fg-3 tabular">{s.n}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h4 className="text-[15px] font-medium tracking-[-0.015em] text-fg">{s.title}</h4>
                  <p className="text-[13px] leading-relaxed text-fg-2 text-pretty">{s.body}</p>
                </div>
              </div>
              {s.art}
            </StackingCard>
          ))}
        </StackingCards>

        <footer className="flex flex-col items-start gap-3 pb-10 pt-16">
          <p className="text-[13px] text-fg-2">Most teams ship their first preview in under ten minutes.</p>
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            Import a repository
          </button>
        </footer>
      </div>
    </div>
  );
}
