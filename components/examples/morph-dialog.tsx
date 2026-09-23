"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, External, Loader } from "@/lib/icons";
import {
  MorphDialog,
  MorphDialogClose,
  MorphDialogContent,
  MorphDialogDescription,
  MorphDialogFade,
  MorphDialogImage,
  MorphDialogSubtitle,
  MorphDialogTitle,
  MorphDialogTrigger,
} from "@/components/ui/morph-dialog";

type Kind = "dashboard" | "docs" | "store";

const templates: { kind: Kind; title: string; subtitle: string; description: string; features: string[] }[] = [
  {
    kind: "dashboard",
    title: "Analytics dashboard",
    subtitle: "Next.js · 14 pages",
    description: "Charts, a date-range filter and CSV export, wired to a sample warehouse so the first screen isn’t empty.",
    features: ["Server-rendered charts", "Role-based access"],
  },
  {
    kind: "docs",
    title: "Documentation",
    subtitle: "MDX · Search built in",
    description: "Versioned guides with a sidebar, on-page contents and instant search across every page.",
    features: ["Versioned content", "Copy buttons on code"],
  },
  {
    kind: "store",
    title: "Storefront",
    subtitle: "Stripe · 9 pages",
    description: "Product grid, cart and a hosted checkout, with inventory kept in sync by webhooks.",
    features: ["Hosted checkout", "Inventory webhooks"],
  },
];

// A template gallery: pick a card, it opens into the details in place, and folds
// back into the grid when you're done. Rendered inside the stage so it never covers the page.
export default function Demo() {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setFrame} className="relative flex h-[500px] w-full max-w-[560px] flex-col justify-center overflow-hidden rounded-2xl p-1 sm:p-3">
      <p className="mb-3 px-1 text-2xs uppercase tracking-[0.08em] text-fg-4">Start from a template</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {templates.map((t) => (
          <MorphDialog key={t.kind} container={frame}>
            <MorphDialogTrigger>
              <MorphDialogImage>
                <Thumb kind={t.kind} />
              </MorphDialogImage>
              <span className="flex flex-col px-1.5 pb-1.5 pt-2.5">
                <MorphDialogTitle>{t.title}</MorphDialogTitle>
                <MorphDialogSubtitle>{t.subtitle}</MorphDialogSubtitle>
              </span>
            </MorphDialogTrigger>
            <MorphDialogContent>
              <MorphDialogImage>
                <Thumb kind={t.kind} />
              </MorphDialogImage>
              <div className="flex flex-col px-3.5 pb-3.5 pt-4">
                <MorphDialogTitle>{t.title}</MorphDialogTitle>
                <MorphDialogSubtitle>{t.subtitle}</MorphDialogSubtitle>
                <MorphDialogFade className="mt-3 flex flex-col gap-4">
                  <MorphDialogDescription>{t.description}</MorphDialogDescription>
                  <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-2">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check size={14} className="text-fg-3" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Actions />
                </MorphDialogFade>
              </div>
            </MorphDialogContent>
          </MorphDialog>
        ))}
      </div>
    </div>
  );
}

function Actions() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const use = () => {
    setState("busy");
    timer.current = window.setTimeout(() => setState("done"), 900);
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <MorphDialogClose className="h-8 whitespace-nowrap rounded-lg max-[400px]:hidden px-2.5 text-[12.5px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75">
        Back
      </MorphDialogClose>
      <div className="ml-auto flex gap-2">
        <a
          href="#preview"
          onClick={(e) => e.preventDefault()}
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
        >
          Preview
          <External size={14} className="text-fg-3" />
        </a>
        <button
          type="button"
          onClick={use}
          aria-busy={state === "busy" || undefined}
          className="relative inline-grid h-8 place-items-center whitespace-nowrap rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 aria-busy:pointer-events-none"
        >
          {/* Both labels hold the width; the live one sits on top. */}
          <span className="invisible col-start-1 row-start-1">Use template</span>
          <span className="invisible col-start-1 row-start-1">Project created</span>
          <span className={cn("col-start-1 row-start-1 flex items-center gap-1.5", state === "busy" && "opacity-0")}>
            {state === "done" && <Check size={14} />}
            {state === "done" ? "Project created" : "Use template"}
          </span>
          {state === "busy" && <Loader size={14} className="col-start-1 row-start-1 animate-spin" />}
        </button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "done" ? "Project created" : ""}
      </span>
    </div>
  );
}

// Theme-aware wireframes of each template, drawn in percentages so they rescale cleanly.
function Thumb({ kind }: { kind: Kind }) {
  const bar = "rounded-[2px] bg-fg/[0.08]";
  return (
    <span aria-hidden className="absolute inset-0 flex bg-frame p-[6%]">
      <span className="flex flex-1 overflow-hidden rounded-[4px] border border-line bg-raised">
        {kind === "dashboard" && (
          <>
            <span className="flex w-[22%] flex-col gap-[8%] border-r border-line p-[5%]">
              {[70, 50, 60, 45].map((w, i) => (
                <span key={i} className={cn(bar, "h-[5%]")} style={{ width: `${w}%` }} />
              ))}
            </span>
            <span className="flex flex-1 flex-col gap-[6%] p-[5%]">
              <span className="flex h-[22%] gap-[4%]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="flex-1 rounded-[3px] border border-line" />
                ))}
              </span>
              <span className="relative flex-1 rounded-[3px] border border-line">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-[10%] h-[80%] w-[80%] overflow-visible text-fg-3">
                  <path d="M0 32 L15 26 L30 29 L45 18 L60 21 L75 10 L100 6" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>
            </span>
          </>
        )}
        {kind === "docs" && (
          <>
            <span className="flex w-[26%] flex-col gap-[7%] border-r border-line p-[5%]">
              <span className={cn(bar, "h-[7%] w-full")} />
              {[80, 60, 70, 55, 65].map((w, i) => (
                <span key={i} className={cn(bar, "h-[4%]")} style={{ width: `${w}%` }} />
              ))}
            </span>
            <span className="flex flex-1 flex-col gap-[5%] p-[6%]">
              <span className="h-[9%] w-[55%] rounded-[2px] bg-fg/[0.14]" />
              {[95, 88, 92, 60].map((w, i) => (
                <span key={i} className={cn(bar, "h-[4%]")} style={{ width: `${w}%` }} />
              ))}
              <span className="mt-[3%] h-[24%] w-full rounded-[3px] border border-line bg-frame" />
            </span>
          </>
        )}
        {kind === "store" && (
          <span className="grid flex-1 grid-cols-3 gap-[5%] p-[6%]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col gap-[8%]">
                <span className="flex-1 rounded-[3px] bg-fg/[0.06]" />
                <span className={cn(bar, "h-[7%] w-[70%]")} />
                <span className={cn(bar, "h-[7%] w-[40%]")} />
              </span>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
