"use client";
import { Toolbar } from "@base-ui/react/toolbar";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Code, External, Link, Refresh, Settings } from "@/lib/icons";
import { Tooltip, TooltipGroup, TooltipGroupTrigger, TooltipProvider } from "@/components/ui/tooltip";

// Two places tooltips earn their keep: icon actions in a header, where the first
// hover waits and its neighbors answer at once, and an editor toolbar, where one
// tooltip slides along with the pointer instead of blinking between buttons.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <DeployHeader />
      <Editor />
    </div>
  );
}

const iconButton = cn(
  "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-2 outline-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
  "data-popup-open:text-fg before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
);

function DeployHeader() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 border-b border-line py-2.5 pl-3.5 pr-2">
        <Tooltip content="Ready · built in 48s" side="bottom" align="start" arrow>
          <button
            type="button"
            aria-label="Deployment ready, built in 48 seconds"
            className="relative grid size-4 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            <span className="size-2 rounded-full bg-success" />
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">atlas-web</p>
          <p className="truncate font-mono text-[11px] text-fg-3">main · g7k2p · 2m ago</p>
        </div>
        <div className="flex items-center">
          <Tooltip content="Redeploy">
            <button type="button" aria-label="Redeploy" className={iconButton}>
              <Refresh />
            </button>
          </Tooltip>
          <Tooltip content="Copy URL" shortcut={["mod", "shift", "C"]}>
            <button type="button" aria-label="Copy URL" className={iconButton}>
              <Link />
            </button>
          </Tooltip>
          <Tooltip content="Open in new tab" shortcut={["O"]}>
            <button type="button" aria-label="Open in new tab" className={iconButton}>
              <External />
            </button>
          </Tooltip>
          <Tooltip content="Project settings" shortcut={["mod", ","]}>
            <button type="button" aria-label="Project settings" className={iconButton}>
              <Settings />
            </button>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

type Mark = "bold" | "italic" | "strike" | "code";

const marks: { id: Mark; label: string; keys: string[]; icon: React.ReactNode }[] = [
  { id: "bold", label: "Bold", keys: ["mod", "B"], icon: <Glyph d="M5 3.25h3.6a2.4 2.4 0 0 1 0 4.8H5zm0 4.8h4.1a2.6 2.6 0 0 1 0 5.2H5z" /> },
  { id: "italic", label: "Italic", keys: ["mod", "I"], icon: <Glyph d="M9.75 3.25H6.5m3 9.5H6.25M9.25 3.25 6.75 12.75" /> },
  { id: "strike", label: "Strikethrough", keys: ["mod", "shift", "X"], icon: <Glyph d="M2.75 8h10.5M10.9 4.6c-.4-.9-1.5-1.5-2.9-1.5-1.7 0-2.9.9-2.9 2.1 0 .9.5 1.5 1.6 2M5 11.2c.4 1 1.6 1.7 3.1 1.7 1.8 0 3-.9 3-2.2 0-.5-.2-1-.6-1.4" /> },
  { id: "code", label: "Inline code", keys: ["mod", "E"], icon: <Code /> },
];

function Editor() {
  const [on, setOn] = useState<Set<Mark>>(() => new Set(["bold"]));
  const toggle = (m: Mark) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  return (
    <div className="flex flex-col gap-3 p-3.5">
      <TooltipGroup side="top">
        <Toolbar.Root aria-label="Formatting" className="flex w-fit items-center gap-0.5 rounded-lg border border-line bg-frame p-0.5">
          {marks.map((m) => (
            <TooltipGroupTrigger key={m.id} content={m.label} shortcut={m.keys}>
              <Toolbar.Button
                aria-label={m.label}
                aria-pressed={on.has(m.id)}
                onClick={() => toggle(m.id)}
                className={cn(
                  "relative inline-flex size-7 items-center justify-center rounded-md text-fg-3 outline-none",
                  "transition-[background-color,color,scale] duration-150 hover:text-fg active:scale-[0.92] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "aria-pressed:bg-raised aria-pressed:text-fg aria-pressed:shadow-[var(--shadow)]",
                  "before:absolute before:-inset-1 before:content-[''] pointer-fine:before:hidden",
                )}
              >
                {m.icon}
              </Toolbar.Button>
            </TooltipGroupTrigger>
          ))}
          <Toolbar.Separator className="mx-1 h-4 w-px bg-line-2" />
          <TooltipGroupTrigger content="Add link" shortcut={["mod", "K"]}>
            <Toolbar.Button
              aria-label="Add link"
              className="relative inline-flex size-7 items-center justify-center rounded-md text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg active:scale-[0.92] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3"
            >
              <Link />
            </Toolbar.Button>
          </TooltipGroupTrigger>
          <TooltipGroupTrigger content="Comment on the selection so reviewers see it in context" shortcut={["mod", "alt", "M"]}>
            <Toolbar.Button
              aria-label="Add comment"
              className="relative inline-flex size-7 items-center justify-center rounded-md text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg active:scale-[0.92] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3"
            >
              <Glyph d="M2.75 4.25c0-.8.7-1.5 1.5-1.5h7.5c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5H7.5L4.75 13.5v-2.25h-.5c-.8 0-1.5-.7-1.5-1.5z" />
            </Toolbar.Button>
          </TooltipGroupTrigger>
        </Toolbar.Root>
      </TooltipGroup>
      <p
        className={cn(
          "text-[13px] leading-[1.6] text-pretty",
          on.has("bold") ? "font-medium text-fg" : "text-fg-2",
          on.has("italic") && "italic",
          on.has("strike") && "line-through decoration-fg-3",
          on.has("code") && "font-mono text-[12px]",
        )}
      >
        Release notes for 4.2: the new billing page ships behind a flag on Thursday.
      </p>
    </div>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
