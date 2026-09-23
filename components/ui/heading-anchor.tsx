"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/** "Rate limits & retries" → "rate-limits-retries". Deterministic, so server and client agree. */
export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const textOf = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
};

async function writeText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("The browser refused the copy command");
}

type LinkState = "idle" | "copied" | "failed";

/**
 * The section-link lifecycle on its own: builds the URL for `#id`, copies it, puts the hash in
 * the address bar without a jump, and reports whether the page was opened at this section.
 */
export function useSectionLink(id: string, { timeout = 1600, updateHash = true }: { timeout?: number; updateHash?: boolean } = {}) {
  const [state, setState] = useState<LinkState>("idle");
  const [targeted, setTargeted] = useState(false);
  const timer = useRef<number>(undefined);
  const flash = useRef<number>(undefined);

  const mark = useCallback(() => {
    setTargeted(true);
    window.clearTimeout(flash.current);
    flash.current = window.setTimeout(() => setTargeted(false), 1400);
  }, []);

  useEffect(() => {
    // Arriving at #id (on load, or from a link elsewhere) briefly marks the heading so the eye finds it.
    const check = () => {
      if (decodeURIComponent(window.location.hash.slice(1)) === id) mark();
    };
    const first = window.setTimeout(check, 0);
    window.addEventListener("hashchange", check);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("hashchange", check);
      window.clearTimeout(flash.current);
      window.clearTimeout(timer.current);
    };
  }, [id, mark]);

  const copy = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`;
    // The hash updates even when the clipboard refuses, so the address bar still has the link.
    if (updateHash) window.history.replaceState(window.history.state, "", `#${encodeURIComponent(id)}`);
    mark();
    window.clearTimeout(timer.current);
    let next: LinkState = "copied";
    try {
      await writeText(url);
    } catch {
      next = "failed";
    }
    setState(next);
    timer.current = window.setTimeout(() => setState("idle"), timeout);
    return next === "copied" ? url : null;
  }, [id, timeout, updateHash, mark]);

  return { state, targeted, copy };
}

const levels = {
  h1: "text-[24px] leading-[1.15] tracking-[-0.025em]",
  h2: "text-[19px] leading-[1.25] tracking-[-0.02em]",
  h3: "text-[15px] leading-[1.35] tracking-[-0.015em]",
  h4: "text-[13.5px] leading-[1.4] tracking-[-0.01em]",
  h5: "text-[13px] leading-[1.45]",
  h6: "text-[12.5px] leading-[1.45] text-fg-2",
} as const;

export type HeadingAnchorProps = Omit<React.ComponentProps<"h2">, "onCopy"> & {
  as?: keyof typeof levels;
  /** The section id. Derived from the heading text when omitted. */
  id?: string;
  /** Put #id in the address bar when the link is used. */
  updateHash?: boolean;
  /** Called with the URL that reached the clipboard. */
  onCopied?: (url: string) => void;
  /** Accessible name for the link. Receives the heading text. */
  linkLabel?: (text: string) => string;
  /** Where the link's tooltip portals to. */
  container?: Tooltip.Portal.Props["container"];
};

export function HeadingAnchor({
  as: Tag = "h2",
  id: idProp,
  updateHash = true,
  onCopied,
  linkLabel = (t) => `Copy link to “${t}”`,
  container,
  className,
  children,
  ...rest
}: HeadingAnchorProps) {
  const text = textOf(children);
  const id = idProp ?? slugify(text);
  const { state, targeted, copy } = useSectionLink(id, { updateHash });
  const reduce = useReducedMotion();
  const active = state !== "idle";
  const [hoverOpen, setHoverOpen] = useState(false);

  return (
    <Tag
      id={id}
      data-targeted={targeted ? "" : undefined}
      className={cn(
        // Right padding keeps room for the link at the end of the longest line, so it never hangs outside.
        "group/heading relative scroll-mt-(--anchor-offset,16px) pr-8 font-medium text-balance text-fg",
        // Landing on the section washes the heading once, then lets go.
        "before:pointer-events-none before:absolute before:-inset-x-2 before:-inset-y-1 before:rounded-md before:bg-fg/[0.07] before:opacity-0 before:transition-opacity before:duration-1000 before:ease-out-quart before:content-['']",
        "data-targeted:before:opacity-100 data-targeted:before:duration-150",
        levels[Tag],
        className,
      )}
      {...rest}
    >
      <span className="relative">{children}</span>
      {/* No space in the DOM before the link: the gap is margin, so the link never wraps alone onto a new line. */}
      <span className="relative inline-block h-[0.7em] w-0 align-baseline whitespace-nowrap">
        <Tooltip.Root open={hoverOpen || active} onOpenChange={(open) => setHoverOpen(open)}>
          <Tooltip.Trigger
            delay={400}
            render={
              <a
                href={`#${encodeURIComponent(id)}`}
                aria-label={linkLabel(text)}
                data-state={state}
                onClick={(e) => {
                  // Modified clicks keep their native meaning (new tab, copy link address).
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  copy().then((url) => url && onCopied?.(url));
                }}
              />
            }
            className={cn(
              "absolute top-1/2 left-1 inline-grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-3",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
              "-translate-x-0.5 opacity-0 transition-[opacity,translate,background-color,color,scale] duration-150 ease-out",
              "group-hover/heading:translate-x-0 group-hover/heading:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100",
              // Without hover there is nothing to reveal it, so it stays faintly visible.
              "pointer-coarse:translate-x-0 pointer-coarse:opacity-60",
              "hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75 motion-reduce:translate-x-0",
              active && "translate-x-0 opacity-100",
              state === "failed" && "text-danger hover:text-danger",
              "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <span className="relative grid size-4 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={state}
                  className="absolute inset-0 grid place-items-center"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                >
                  <Glyph state={state} reduce={!!reduce} />
                </motion.span>
              </AnimatePresence>
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal container={container}>
            <Tooltip.Positioner side="top" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
              <Tooltip.Popup
                className={cn(
                  "rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 font-normal tracking-normal whitespace-nowrap text-fg-2 shadow-pop",
                  "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-out-expo",
                  "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
                  "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
                  state === "failed" && "text-danger",
                )}
              >
                {state === "copied" ? "Link copied" : state === "failed" ? "Couldn’t copy. The link is in the address bar" : "Copy link to section"}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <span role="status" aria-live="polite" className="sr-only">
          {state === "copied" ? "Link copied" : state === "failed" ? "Couldn’t copy the link" : ""}
        </span>
      </span>
    </Tag>
  );
}

function Glyph({ state, reduce }: { state: LinkState; reduce: boolean }) {
  const draw = reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.3, ease: ease.out, delay: 0.04 } };
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (state === "copied")
    return (
      <svg {...common}>
        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw} />
      </svg>
    );
  if (state === "failed")
    return (
      <svg {...common}>
        <motion.path d="m4.5 4.5 7 7" {...draw} />
        <motion.path d="m11.5 4.5-7 7" {...draw} />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5.75 2.75 4.75 13.25M11.25 2.75l-1 10.5M3 6h10.5M2.5 10H13" />
    </svg>
  );
}
