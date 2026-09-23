"use client";
import { Toggle } from "@base-ui/react/toggle";
import { useState } from "react";
import { Highlight, HighlightGroup } from "@/components/ui/highlight";

// A terms update that marks what changed. The group draws the marks in reading
// order the first time the notice is seen, each starting as the one before it
// finishes, the long one carrying on onto its second line; the toggle wipes
// them back out and draws them again.

// Changed phrases step up to full contrast while they're marked.
const changed = "data-[state=on]:text-fg";

export default function Demo() {
  const [show, setShow] = useState(true);
  // undefined hands control back to the group's on-view trigger (already seen, so on); false wipes them.
  const active = show ? undefined : false;

  return (
    <article aria-labelledby="terms-title" className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line-2 bg-raised p-5 shadow-[var(--shadow)]">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Effective 1 Oct 2026</span>
        <h3 id="terms-title" className="text-[15px] font-medium tracking-[-0.015em] text-fg">
          Changes to our terms
        </h3>
      </header>

      <HighlightGroup active={active} delay={0.1} className="flex flex-col gap-3 text-[13.5px] leading-[1.65] text-fg-2 text-pretty">
        <p>
          We now bill usage{" "}
          <Highlight tone="warning" className={changed}>
            at the end of each calendar month instead of every 30 days
          </Highlight>
          , so invoices line up with your accounting period.
        </p>
        <p>
          Preview deployments are{" "}
          <Highlight tone="success" className={changed}>
            kept for 90 days
          </Highlight>{" "}
          after their branch merges, and you can{" "}
          <Highlight variant="underline" className={changed}>
            export audit logs at any time
          </Highlight>
          .
        </p>
      </HighlightGroup>

      <footer className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[12px] text-fg-3 tabular">3 changes since 12 Jun</span>
        <Toggle
          pressed={show}
          onPressedChange={setShow}
          className="group/t inline-flex h-7 shrink-0 items-center whitespace-nowrap gap-2 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
        >
          {/* A tiny switch track, so the state reads without relying on the label alone. */}
          <span aria-hidden className="relative h-3.5 w-6 rounded-full border border-line-2 bg-frame transition-colors duration-200 group-data-pressed/t:border-fg group-data-pressed/t:bg-fg">
            <span className="absolute left-0.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-fg-3 transition-[translate,background-color] duration-200 ease-out-expo group-data-pressed/t:translate-x-2.5 group-data-pressed/t:bg-frame" />
          </span>
          Show changes
        </Toggle>
      </footer>
    </article>
  );
}
