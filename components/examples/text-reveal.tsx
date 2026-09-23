"use client";
import { ArrowRight } from "@/lib/icons";
import { TextReveal } from "@/components/ui/text-reveal";

// A release note as it lands on a changelog: the title word by word, the body
// line by line as it wraps at this width, then the action. Use the stage's
// replay button to watch it again.
export default function Demo() {
  return (
    <article className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line-2 bg-raised p-5 shadow-[var(--shadow)] sm:p-6">
      <div className="flex items-center gap-2 font-mono text-2xs text-fg-3">
        <span className="rounded-full border border-line-2 px-1.5 py-px text-fg-2">v4.12</span>
        <span aria-hidden className="text-fg-4">·</span>
        <time dateTime="2026-09-22" className="uppercase tracking-[0.08em] tabular">22 Sep 2026</time>
      </div>

      <TextReveal as="h2" className="text-[24px] font-medium leading-[1.15] tracking-[-0.025em] text-fg text-balance">
        Branch previews for every pull request
      </TextReveal>

      <TextReveal as="p" by="line" delay={0.22} className="text-[13.5px] leading-[1.6] text-fg-2 text-pretty">
        Each push to a branch now builds its own preview with a stable URL, posted on the pull request and torn down the moment it merges.
      </TextReveal>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-[12px] text-fg-3">
          <span className="tabular text-fg-2">38s</span> median build
        </span>
        <a
          href="#changelog"
          className="group/link inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
        >
          Read the changelog
          <ArrowRight size={14} className="text-fg-3 transition-transform duration-200 ease-out-expo group-hover/link:translate-x-0.5" />
        </a>
      </div>
    </article>
  );
}
