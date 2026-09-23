"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useCopy } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Alert, ArrowUp, Check, Hash, Image as ImageIcon, Loader, Sparkle } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ChangeType = "new" | "improved" | "fixed";

export type ChangelogChange = { type: ChangeType; text: React.ReactNode };

export type ChangelogRelease = {
  /** Anchor id. Defaults to the version, slugged: "v2.14.0" → "v2-14-0". */
  id?: string;
  version: string;
  /** ISO date, "2026-09-18". Formatted in UTC so the server and browser agree. */
  date: string;
  title: string;
  summary?: React.ReactNode;
  /** A screenshot. Width and height reserve its box before it loads. */
  image?: { src: string; alt: string; width: number; height: number; caption?: React.ReactNode };
  /** Anything else in the image slot: a video, a drawn mock. Wins over image. */
  media?: React.ReactNode;
  changes: ChangelogChange[];
};

export type ChangelogFilter = "all" | ChangeType;

const TYPES: { type: ChangeType; label: string; icon: typeof Sparkle }[] = [
  { type: "new", label: "New", icon: Sparkle },
  { type: "improved", label: "Improved", icon: ArrowUp },
  { type: "fixed", label: "Fixed", icon: Check },
];

const EMPTY: Record<ChangeType, string> = {
  new: "No new features in these releases",
  improved: "No improvements in these releases",
  fixed: "No fixes in these releases",
};

export const releaseId = (r: ChangelogRelease) => r.id ?? r.version.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The nearest ancestor that scrolls, or null for the window. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (/(auto|scroll|overlay)/.test(overflowY) && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export type ChangelogProps = Omit<React.ComponentProps<"div">, "children"> & {
  releases: ChangelogRelease[];
  /** Which changes show. Controlled… */
  filter?: ChangelogFilter;
  /** …or where it starts. */
  defaultFilter?: ChangelogFilter;
  onFilterChange?: (filter: ChangelogFilter) => void;
  /** Hide the New / Improved / Fixed switcher. */
  hideFilter?: boolean;
  /** Older releases exist. Shows the load button under the last one. */
  hasMore?: boolean;
  /** Fetch and append older releases. Reject to show an error beside the button. */
  onLoadMore?: () => Promise<void> | void;
  /** Height of a sticky site header, so dates and anchors land below it. */
  stickyTop?: number;
  /** Heading level of each release title; change groups sit one level below. */
  headingLevel?: 2 | 3 | 4;
  /** Fixed locale for dates and counts, so the server and the browser print the same thing. */
  locale?: string;
  latestLabel?: string;
};

/**
 * Releases on a timeline rail. The dot of the release you are reading lights
 * up as you scroll, dates stick beside long entries, every title copies a
 * link to itself, and arriving at one by its link washes it once so the eye
 * finds it.
 */
export function Changelog({
  releases,
  filter: filterProp,
  defaultFilter = "all",
  onFilterChange,
  hideFilter = false,
  hasMore = false,
  onLoadMore,
  stickyTop = 0,
  headingLevel = 2,
  locale = "en-US",
  latestLabel = "Latest",
  className,
  style,
  ...rest
}: ChangelogProps) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useControllableState({ value: filterProp, defaultValue: defaultFilter, onChange: onFilterChange });
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Releases on screen at first paint never animate; ones loaded later rise in once.
  const [known, setKnown] = useState(() => new Set(releases.map(releaseId)));
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const visible = releases
    .map((r) => ({ ...r, changes: filter === "all" ? r.changes : r.changes.filter((c) => c.type === filter) }))
    .filter((r) => filter === "all" || r.changes.length > 0);

  const counts = { all: 0, new: 0, improved: 0, fixed: 0 } as Record<ChangelogFilter, number>;
  for (const r of releases)
    for (const c of r.changes) {
      counts[c.type]++;
      counts.all++;
    }

  // The lit dot: the last release whose top has passed a line just under the
  // sticky header. At the very bottom the last release wins, however short.
  const visibleKey = visible.map(releaseId).join(",");
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const sp = scrollParent(el);
    let frame = 0;
    const check = () => {
      frame = 0;
      const items = Array.from(el.querySelectorAll<HTMLElement>("[data-release]"));
      if (!items.length) return setActive(null);
      const top = (sp ? sp.getBoundingClientRect().top : 0) + stickyTop + 48;
      let id = items[0].id;
      for (const a of items) if (a.getBoundingClientRect().top <= top) id = a.id;
      const atEnd = sp ? sp.scrollTop + sp.clientHeight >= sp.scrollHeight - 2 : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atEnd && (sp ? sp.scrollTop : window.scrollY) > 0) {
        const bottom = sp ? sp.getBoundingClientRect().bottom : window.innerHeight;
        const last = items.filter((a) => a.getBoundingClientRect().top < bottom - 40).pop();
        if (last) id = last.id;
      }
      setActive((a) => (a === id ? a : id));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    (sp ?? window).addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      (sp ?? window).removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [visibleKey, stickyTop]);

  // Arriving by a release's link washes it once.
  useEffect(() => {
    const read = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && root.current?.querySelector(`[data-release][id="${CSS.escape(id)}"]`)) setFlash(id);
    };
    const frame = requestAnimationFrame(read);
    window.addEventListener("hashchange", read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(t);
  }, [flash]);

  // The spinner shows only if loading outlasts 150ms.
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setSlow(true), 150);
    return () => {
      window.clearTimeout(t);
      setSlow(false);
    };
  }, [loading]);

  const loadMore = async () => {
    if (loading || !onLoadMore) return;
    setLoading(true);
    setLoadError(false);
    const started = performance.now();
    try {
      await onLoadMore();
    } catch {
      if (alive.current) setLoadError(true);
    } finally {
      const elapsed = performance.now() - started;
      if (elapsed > 150 && elapsed < 450) await new Promise((r) => setTimeout(r, 450 - elapsed));
      if (alive.current) setLoading(false);
    }
  };

  const dateFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const numFmt = new Intl.NumberFormat(locale);
  const latest = releases[0] ? releaseId(releases[0]) : null;
  let entering = 0;

  return (
    <div
      ref={root}
      data-slot="changelog"
      data-filter={filter}
      className={cn("@container w-full min-w-0", className)}
      style={{ ...style, ["--cl-top" as string]: `${stickyTop}px` }}
      {...rest}
    >
      {!hideFilter && <FilterBar value={filter} onChange={setFilter} counts={counts} fmt={numFmt} reduce={!!reduce} />}

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-2 px-4 py-6">
          <p className="text-[13px] text-fg-2">{filter === "all" ? "No releases yet" : EMPTY[filter]}</p>
          {filter !== "all" && (
            <button type="button" onClick={() => setFilter("all")} className={secondaryButton}>
              Show all changes
            </button>
          )}
        </div>
      ) : (
        <ol className="flex flex-col">
          {visible.map((r, i) => {
            const id = releaseId(r);
            const fresh = !known.has(id);
            const delay = fresh ? Math.min(entering++, 8) * 0.04 : 0;
            return (
              <Release
                key={id}
                id={id}
                release={r}
                first={i === 0}
                last={i === visible.length - 1 && !hasMore}
                active={active === id}
                flashing={flash === id}
                latest={id === latest ? latestLabel : null}
                level={headingLevel}
                date={dateFmt.format(new Date(`${r.date}T00:00:00Z`))}
                enter={fresh ? { delay, reduce: !!reduce, done: () => setKnown((k) => new Set(k).add(id)) } : null}
              />
            );
          })}
        </ol>
      )}

      {hasMore && onLoadMore && (
        <div
          className={cn(
            "relative flex flex-wrap items-center gap-x-3 gap-y-2 pb-2 pl-6 @min-[36rem]:ml-32 @min-[36rem]:pl-8",
            // The rail runs on into the button and fades out, so the timeline reads as unfinished.
            "before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-linear-to-b before:from-line before:to-transparent before:content-['']",
          )}
        >
          <button type="button" onClick={loadMore} aria-disabled={loading || undefined} data-busy={loading || undefined} className={cn(secondaryButton, "data-busy:pointer-events-none")}>
            <span className="grid place-items-center">
              <span className={cn("col-start-1 row-start-1 transition-[opacity,filter] duration-150", loading && "opacity-60", slow && "opacity-0 blur-[2px] motion-reduce:blur-none")}>
                {loadError ? "Try again" : "Load older releases"}
              </span>
              <span aria-hidden className={cn("col-start-1 row-start-1 transition-[opacity,scale] duration-200 ease-out-expo", slow ? "scale-100 opacity-100" : "scale-75 opacity-0")}>
                <Loader size={14} className={cn(slow && "animate-spin motion-reduce:animate-spin-slow")} />
              </span>
            </span>
            {loading && <span className="sr-only">Loading older releases</span>}
          </button>
          {loadError && (
            <p role="alert" className="flex items-center gap-1.5 text-[12px] text-danger">
              <Alert size={14} className="shrink-0" />
              Couldn’t load older releases.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const secondaryButton = cn(
  "relative inline-flex h-8 shrink-0 select-none items-center justify-center rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium tracking-[-0.005em] text-fg shadow-[var(--shadow)]",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
  "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
);

function Release({
  id,
  release: r,
  first,
  last,
  active,
  flashing,
  latest,
  level,
  date,
  enter,
}: {
  id: string;
  release: ChangelogRelease;
  first: boolean;
  last: boolean;
  active: boolean;
  flashing: boolean;
  latest: string | null;
  level: 2 | 3 | 4;
  date: string;
  enter: { delay: number; reduce: boolean; done: () => void } | null;
}) {
  const H = `h${level}` as "h2";
  const G = `h${level + 1}` as "h3";
  const titleId = useId();
  const groups = TYPES.map((t) => ({ ...t, items: r.changes.filter((c) => c.type === t.type) })).filter((g) => g.items.length);

  const meta = (
    <>
      <time dateTime={r.date} className="text-[12.5px] text-fg-2 tabular">
        {date}
      </time>
      <span className="inline-flex h-5 items-center rounded-md border border-line-2 bg-raised px-1.5 font-mono text-[11px] text-fg">{r.version}</span>
      {latest && <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{latest}</span>}
    </>
  );

  return (
    <motion.li
      id={id}
      data-release
      data-active={active || undefined}
      data-flash={flashing || undefined}
      aria-labelledby={titleId}
      initial={enter ? (enter.reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(3px)" }) : false}
      animate={enter ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined}
      transition={{ duration: enter?.reduce ? 0.15 : 0.4, ease: ease.out, delay: enter?.delay ?? 0 }}
      onAnimationComplete={enter?.done}
      style={{ scrollMarginTop: "calc(var(--cl-top) + 16px)" }}
      className="group/rel relative grid @min-[36rem]:grid-cols-[8rem_minmax(0,1fr)]"
    >
      {/* Wide containers: the date and version stick beside the entry while it scrolls. */}
      <div className="hidden @min-[36rem]:block">
        <div className="sticky top-[calc(var(--cl-top)+16px)] flex flex-col items-end gap-1.5 pr-6 pt-px text-right">{meta}</div>
      </div>

      <div
        className={cn(
          "relative min-w-0 pb-12 pl-6 @min-[36rem]:pl-8",
          // The rail: a hairline segment per release, joined into one line; it starts at the first dot and fades out after the last.
          "before:absolute before:bottom-0 before:left-0 before:w-px before:bg-line before:content-['']",
          first ? "before:top-2.5" : "before:top-0",
          last && "before:bg-transparent before:bg-linear-to-b before:from-line before:to-transparent",
        )}
      >
        {/* The arrival wash sits behind the content and fades out on its own. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-3 bottom-6 left-3 -right-3 rounded-xl bg-hover transition-opacity ease-out-quart",
            flashing ? "opacity-100 duration-150" : "opacity-0 duration-[1200ms]",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-[5.5px] size-[9px] -translate-x-1/2 rounded-full border transition-[background-color,border-color,box-shadow] duration-200 ease-out",
            active ? "border-fg bg-fg shadow-[0_0_0_3px_var(--frame)]" : "border-fg-4 bg-frame shadow-[0_0_0_3px_var(--frame)]",
          )}
        />

        <div className="relative flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 @min-[36rem]:hidden">{meta}</div>

          <div className="flex flex-col gap-1.5">
            <H id={titleId} className="flex min-w-0 items-start gap-1.5 text-[15px] font-medium leading-5 tracking-[-0.015em] text-fg text-balance">
              <span className="min-w-0">{r.title}</span>
              <AnchorLink id={id} version={r.version} />
            </H>
            {r.summary != null && <div className="max-w-[62ch] text-pretty text-[13px] leading-[1.55] text-fg-2">{r.summary}</div>}
          </div>

          {r.media ?? (r.image && <Shot image={r.image} />)}

          {groups.map((g) => (
            <section key={g.type} className="flex flex-col gap-1.5" aria-label={`${g.label} in ${r.version}`}>
              <G className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
                <g.icon size={12} className="shrink-0" />
                {g.label}
              </G>
              <ul className="flex max-w-[62ch] flex-col gap-1">
                {g.items.map((c, i) => (
                  <li key={i} className="relative pl-4 text-pretty text-[13px] leading-[1.55] text-fg-2 [&_code]:rounded-[4px] [&_code]:bg-hover [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-fg [&_strong]:font-medium [&_strong]:text-fg">
                    <span aria-hidden className="absolute left-0.5 top-[9px] h-px w-2 bg-fg-4" />
                    {c.text}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </motion.li>
  );
}

/** Copies the link to a release and puts its hash in the address bar, without scrolling. */
function AnchorLink({ id, version }: { id: string; version: string }) {
  const { state, copy } = useCopy({ timeout: 1600 });
  const reduce = useReducedMotion();
  return (
    <>
      <a
        href={`#${id}`}
        aria-label={`Copy link to ${version}`}
        data-state={state}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          history.replaceState(history.state, "", `#${id}`);
          copy(() => location.href);
        }}
        className={cn(
          "relative mt-px grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] text-fg-4 outline-none",
          "transition-[opacity,color,background-color,scale] duration-150 hover:bg-hover hover:text-fg-2 active:scale-[0.9]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          // Quiet until the release is hovered; always there on touch and while it confirms.
          "pointer-fine:opacity-0 pointer-fine:group-hover/rel:opacity-100 focus-visible:opacity-100 data-[state=copied]:opacity-100 data-[state=failed]:opacity-100",
          "data-[state=copied]:text-fg data-[state=failed]:text-danger",
          "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            className="grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            {state === "copied" ? <Check size={14} /> : state === "failed" ? <Alert size={14} /> : <Hash size={14} />}
          </motion.span>
        </AnimatePresence>
      </a>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? `Link to ${version} copied` : state === "failed" ? "Couldn’t copy the link" : ""}
      </span>
    </>
  );
}

/** A screenshot in a box sized before it loads; fades in when decoded, and a quiet placeholder if it fails. */
function Shot({ image }: { image: NonNullable<ChangelogRelease["image"]> }) {
  const img = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  // The image may finish before hydration, when onLoad can't fire; check once mounted.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = img.current;
      if (el?.complete) setStatus(el.naturalWidth ? "loaded" : "failed");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <figure className="flex max-w-[640px] flex-col gap-2">
      <div
        className="relative overflow-hidden rounded-lg border border-line bg-hover"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        {status !== "failed" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={img}
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("failed")}
            className={cn("absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out", status === "loaded" ? "opacity-100" : "opacity-0")}
          />
        )}
        {status === "failed" && (
          <div role="img" aria-label={image.alt} className="absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
              <ImageIcon size={14} />
              Image unavailable
            </span>
          </div>
        )}
      </div>
      {image.caption != null && <figcaption className="text-pretty text-[12px] text-fg-3">{image.caption}</figcaption>}
    </figure>
  );
}

function FilterBar({
  value,
  onChange,
  counts,
  fmt,
  reduce,
}: {
  value: ChangelogFilter;
  onChange: (v: ChangelogFilter) => void;
  counts: Record<ChangelogFilter, number>;
  fmt: Intl.NumberFormat;
  reduce: boolean;
}) {
  const id = useId();
  const options: { value: ChangelogFilter; label: string }[] = [{ value: "all", label: "All" }, ...TYPES.map((t) => ({ value: t.type, label: t.label }))];
  return (
    <ToggleGroup
      value={[value]}
      // One filter is always on: pressing the current one again keeps it.
      onValueChange={(v) => v[0] && onChange(v[0] as ChangelogFilter)}
      aria-label="Show changes"
      className="mb-8 flex w-fit max-w-full overflow-x-auto rounded-lg border border-line bg-raised p-0.5 [scrollbar-width:none] @min-[36rem]:ml-40"
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          className={cn(
            "relative isolate flex h-7 shrink-0 select-none items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-fg-3",
            "outline-none transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] data-pressed:text-fg",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          )}
        >
          {o.value === value && (
            <motion.span
              layoutId={`${id}-pill`}
              className="absolute inset-0 -z-10 rounded-md border border-line-2 bg-frame"
              transition={reduce ? { duration: 0 } : spring.snappy}
            />
          )}
          {o.label}
          <span className="text-[11.5px] font-normal text-fg-4 tabular">{fmt.format(counts[o.value])}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
