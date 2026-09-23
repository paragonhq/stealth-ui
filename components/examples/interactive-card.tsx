"use client";
import { useState } from "react";
import { Star } from "@/lib/icons";
import { InteractiveCard, InteractiveCardAction, InteractiveCardArrow, InteractiveCardLink } from "@/components/ui/interactive-card";

const projects = [
  { slug: "stealth-web", domain: "stealth.pm", commit: "Fix double charge when 3-D Secure redirects back", branch: "main", when: "4m ago", status: "Ready" },
  { slug: "billing-worker", domain: "billing.internal", commit: "Retry failed webhooks with exponential backoff", branch: "retry-queue", when: "1h ago", status: "Building" },
];

export default function Demo() {
  return (
    <div className="grid w-full max-w-[560px] gap-3 sm:grid-cols-2">
      {projects.map((p) => (
        <InteractiveCard key={p.slug} glow className="gap-3 p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-hover font-mono text-[12px] text-fg-2 ring-1 ring-inset ring-line-2">
              {p.slug[0].toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="truncate text-[13px] font-medium leading-[18px] tracking-[-0.005em]">
                <InteractiveCardLink href={`#${p.slug}`}>{p.slug}</InteractiveCardLink>
              </h3>
              <p className="truncate text-[12px] text-fg-3">{p.domain}</p>
            </div>
            <InteractiveCardAction className="-mr-1.5 -mt-1.5">
              <StarButton name={p.slug} />
            </InteractiveCardAction>
          </div>
          <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-fg-2">{p.commit}</p>
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <span aria-hidden className={p.status === "Ready" ? "size-1.5 rounded-full bg-success" : "size-1.5 animate-pulse-soft rounded-full bg-warning"} />
            <span className="text-fg-2">{p.status}</span>
            <span className="min-w-0 truncate font-mono text-[11px]">{p.branch}</span>
            <span className="shrink-0 tabular">· {p.when}</span>
            <InteractiveCardArrow className="ml-auto" />
          </div>
        </InteractiveCard>
      ))}
    </div>
  );
}

function StarButton({ name }: { name: string }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Star ${name}`}
      onClick={() => setOn((v) => !v)}
      className="group/star relative grid size-8 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 aria-pressed:text-fg pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5 pointer-coarse:before:content-['']"
    >
      <Star className="transition-[fill] duration-200 ease-out group-aria-pressed/star:fill-current" />
    </button>
  );
}
