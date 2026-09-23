"use client";
import { PreviewCard } from "@base-ui/react/preview-card";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, isValidElement, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight, ChevronDown } from "@/lib/icons";
import { spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Data and context
 * -----------------------------------------------------------------------------------------------*/

export type CitationSource = {
  id: string;
  url: string;
  title: string;
  /** The passage the claim rests on. Keep it short; it's clamped to three lines. */
  snippet?: string;
  /** A URL, or your own node. Falls back to the site's first letter. */
  favicon?: string | React.ReactNode;
  /** Shown instead of the host when given, e.g. "Postgres docs". */
  siteName?: string;
  /** Preformatted, e.g. "12 Mar 2026" or "Updated 3d ago". */
  meta?: string;
};

type Active = { ids: string[]; from: "inline" | "list" } | null;

type Ctx = {
  sources: CitationSource[];
  byId: Map<string, { source: CitationSource; n: number }>;
  active: Active;
  setActive: (a: Active) => void;
  listId: string;
};

const CitationsContext = createContext<Ctx | null>(null);

function useCitations() {
  const ctx = useContext(CitationsContext);
  if (!ctx) throw new Error("Citation parts must be inside <Citations>");
  return ctx;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export type CitationsProps = React.ComponentProps<"div"> & {
  /** Every source the reply cites, in the order they're numbered. */
  sources: CitationSource[];
};

/** Numbers the sources and links each inline marker to its row in the list, both ways. */
export function Citations({ sources, className, children, ...rest }: CitationsProps) {
  const [active, setActive] = useState<Active>(null);
  const listId = useId();
  const byId = useMemo(() => new Map(sources.map((s, i) => [s.id, { source: s, n: i + 1 }])), [sources]);
  return (
    <CitationsContext value={{ sources, byId, active, setActive, listId }}>
      <div className={cn("min-w-0", className)} {...rest}>
        {children}
      </div>
    </CitationsContext>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Inline marker
 * -----------------------------------------------------------------------------------------------*/

export type CitationProps = Omit<PreviewCard.Trigger.Props, "className" | "children" | "id"> & {
  /** One source id, or several when a claim rests on more than one. */
  id: string | string[];
  className?: string;
};

/**
 * A numbered pill inside the text. Hover or focus previews the source; pressing opens it.
 * Several ids show the first number and a count, and the preview lists each.
 */
export function Citation({ id, className, delay = 250, closeDelay = 120, ...rest }: CitationProps) {
  const { byId, active, setActive } = useCitations();
  const ids = (Array.isArray(id) ? id : [id]).filter((x) => byId.has(x));
  if (ids.length === 0) return null; // No source, no claim of one.
  const entries = ids.map((x) => byId.get(x)!);
  const first = entries[0];
  const lit = active?.from === "list" && active.ids.some((x) => ids.includes(x));
  const label =
    entries.length === 1
      ? `Source ${first.n}: ${first.source.title} (opens in a new tab)`
      : `Sources ${entries.map((e) => e.n).join(", ")}: ${entries.map((e) => e.source.title).join("; ")} (opens in a new tab)`;

  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        href={first.source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        delay={delay}
        closeDelay={closeDelay}
        data-active={lit ? "" : undefined}
        onPointerEnter={() => setActive({ ids, from: "inline" })}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive({ ids, from: "inline" })}
        onBlur={() => setActive(null)}
        className={cn(
          // Sits on the baseline like a superscript would, without changing the line height.
          "relative mx-[0.15em] inline-flex h-[17px] min-w-[17px] -translate-y-px select-none items-center justify-center gap-0.5 rounded-full px-[5px] align-[0.08em]",
          "border border-line-2 bg-raised font-mono text-[10.5px] font-medium leading-none tabular text-fg-2 no-underline",
          "outline-none transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.92] active:duration-75",
          "hover:border-fg hover:bg-fg hover:text-frame data-popup-open:border-fg data-popup-open:bg-fg data-popup-open:text-frame",
          "data-active:border-fg data-active:bg-fg data-active:text-frame",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          // A touch target of 44px around a 17px pill.
          "before:absolute before:-inset-3.5 before:content-[''] pointer-fine:before:hidden motion-reduce:active:scale-100",
          className,
        )}
        {...rest}
      >
        {first.n}
        {entries.length > 1 && <span className="text-[9.5px] opacity-70">+{entries.length - 1}</span>}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="top" align="center" sideOffset={8} collisionPadding={12} className="z-(--z-popover)">
          <PreviewCard.Popup
            className={cn(
              "w-[min(20rem,calc(100vw-24px))] origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-left text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-160 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1",
              "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
            )}
          >
            <div className="divide-y divide-line">
              {entries.slice(0, 3).map(({ source, n }) => (
                <SourcePreview key={source.id} source={source} n={n} compact={entries.length > 1} />
              ))}
            </div>
            {entries.length > 3 && <p className="border-t border-line px-3 py-2 text-[11.5px] text-fg-3">and {entries.length - 3} more below</p>}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function SourcePreview({ source, n, compact }: { source: CitationSource; n: number; compact: boolean }) {
  const host = hostOf(source.url);
  return (
    <div className="flex flex-col gap-1.5 p-3">
      <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-fg-3">
        <Favicon src={source.favicon} host={host} />
        <span className="min-w-0 truncate text-fg-2">{source.siteName ?? host}</span>
        {source.meta && (
          <>
            <span aria-hidden className="text-fg-4">·</span>
            <span className="shrink-0 text-fg-3">{source.meta}</span>
          </>
        )}
        <span className="ms-auto shrink-0 font-mono text-[10.5px] text-fg-4 tabular">[{n}]</span>
      </div>
      <p className={cn("text-[13px] font-medium leading-[1.35] tracking-[-0.01em] text-fg", compact ? "line-clamp-1" : "line-clamp-2")}>{source.title}</p>
      {source.snippet && (
        <p className={cn("border-l-2 border-line-2 pl-2 text-[12px] leading-[1.5] text-fg-2", compact ? "line-clamp-2" : "line-clamp-3")}>{source.snippet}</p>
      )}
    </div>
  );
}

function Favicon({ src, host, size = 16 }: { src?: CitationSource["favicon"]; host: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const box = "grid shrink-0 place-items-center overflow-hidden rounded-[4px]";
  if (isValidElement(src))
    return (
      <span aria-hidden className={cn(box, "text-fg")} style={{ width: size, height: size }}>
        {src}
      </span>
    );
  if (typeof src === "string" && src && failed !== src)
    // eslint-disable-next-line @next/next/no-img-element -- favicons come from any host
    return <img src={src} alt="" width={size} height={size} onError={() => setFailed(src)} className={box} />;
  // No icon, or it failed: the site's first letter on a quiet tile, the same size as the icon.
  return (
    <span
      aria-hidden
      className={cn(box, "border border-line-2 bg-hover font-medium uppercase leading-none text-fg-2")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
    >
      {host.charAt(0)}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Sources list
 * -----------------------------------------------------------------------------------------------*/

export type CitationSourcesProps = Omit<React.ComponentProps<"section">, "children"> & {
  /** Rows shown before "Show more". Everything shows when there are at most this many plus one. */
  visible?: number;
  title?: string;
};

export function CitationSources({ visible = 3, title = "Sources", className, ...rest }: CitationSourcesProps) {
  const { sources, active, setActive, listId } = useCitations();
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(36);
  const opacity = useMotionValue(0);
  const shown = useRef(false);

  // Hiding a single row behind a button costs more than showing it.
  const collapsible = sources.length > visible + 1;
  const head = collapsible ? sources.slice(0, visible) : sources;
  const tail = collapsible ? sources.slice(visible) : [];
  const headingId = `${listId}-title`;

  // One highlight for the list, glided to whichever row is active, whether the pointer is on the
  // row or on its marker up in the text.
  const activeId = active?.ids[0];
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const row = activeId ? el.querySelector<HTMLElement>(`[data-source="${CSS.escape(activeId)}"]`) : null;
    const visibleRow = row && row.offsetParent !== null && row.getClientRects().length > 0 && !row.closest("[inert]") ? row : null;
    if (!visibleRow) {
      animate(opacity, 0, { duration: reduce ? 0 : 0.12 });
      shown.current = false;
      return;
    }
    const top = visibleRow.offsetTop;
    if (!shown.current || reduce) {
      y.jump(top);
      height.jump(visibleRow.offsetHeight);
    } else {
      animate(y, top, spring.follow);
      animate(height, visibleRow.offsetHeight, spring.follow);
    }
    animate(opacity, 1, { duration: reduce ? 0 : 0.1 });
    shown.current = true;
  }, [activeId, open, reduce, y, height, opacity]);

  if (sources.length === 0) return null;

  const row = (s: CitationSource, i: number) => {
    const host = hostOf(s.url);
    const lit = !!active && active.ids.includes(s.id);
    return (
      <li key={s.id} data-source={s.id}>
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          data-active={lit ? "" : undefined}
          onPointerEnter={() => setActive({ ids: [s.id], from: "list" })}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive({ ids: [s.id], from: "list" })}
          onBlur={() => setActive(null)}
          className={cn(
            "group/row relative flex h-9 min-w-0 items-center gap-2.5 rounded-lg px-2 text-[12.5px] no-underline outline-none",
            "transition-[scale] duration-100 active:scale-[0.99] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          )}
        >
          <span
            className={cn(
              "grid h-4 min-w-4 shrink-0 place-items-center rounded-full border border-line-2 px-1 font-mono text-[10px] font-medium leading-none tabular text-fg-3",
              "transition-[background-color,border-color,color] duration-150 group-data-active/row:border-fg group-data-active/row:bg-fg group-data-active/row:text-frame",
            )}
          >
            {i + 1}
          </span>
          <Favicon src={s.favicon} host={host} />
          <span className="min-w-0 flex-1 truncate text-fg">{s.title}</span>
          <span className="hidden max-w-[40%] shrink-0 truncate text-fg-3 sm:block">{s.siteName ?? host}</span>
          <ArrowUpRight
            size={14}
            className="shrink-0 text-fg-4 transition-[color,translate] duration-150 ease-out group-data-active/row:translate-x-px group-data-active/row:-translate-y-px group-data-active/row:text-fg-2"
          />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </li>
    );
  };

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)} {...rest}>
      <h3 id={headingId} className="mb-1.5 flex items-center gap-1.5 px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-3">
        {title}
        <span className="text-fg-4 tabular">{sources.length}</span>
      </h3>
      <div ref={list} className="relative isolate">
        <motion.span aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-0 top-0 -z-10 rounded-lg bg-fg/[0.05]" />
        <ol className="flex flex-col">{head.map((s, i) => row(s, i))}</ol>
        {collapsible && (
          <div
            // Grows to its content with grid rows, so nothing is measured and nothing jumps.
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-240 ease-in-out-quart motion-reduce:transition-none",
              open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            inert={!open}
          >
            <ol start={visible + 1} className="flex min-h-0 flex-col overflow-hidden">
              {tail.map((s, i) => row(s, visible + i))}
            </ol>
          </div>
        )}
      </div>
      {collapsible && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "mt-0.5 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-3 outline-none",
            "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97]",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          )}
        >
          {!open && (
            <span className="flex -space-x-0.5" aria-hidden>
              {tail.slice(0, 3).map((s) => (
                <span key={s.id} className="rounded-[5px] ring-2 ring-frame">
                  <Favicon src={s.favicon} host={hostOf(s.url)} size={14} />
                </span>
              ))}
            </span>
          )}
          {open ? "Show fewer" : `Show ${tail.length} more`}
          <ChevronDown size={14} className={cn("transition-transform duration-200 ease-out-expo", open && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
