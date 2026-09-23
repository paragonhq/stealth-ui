"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type TocItem = { id: string; title: string; level: number };

/* -------------------------------------------------------------------------------------------------
 * Collect headings from the page
 * -----------------------------------------------------------------------------------------------*/

/** Reads the headings inside a container, and keeps reading them as the content changes. */
export function useHeadings(container: React.RefObject<HTMLElement | null>, selector = "h2[id], h3[id]") {
  const [items, setItems] = useState<TocItem[]>([]);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const read = () =>
      setItems(
        [...el.querySelectorAll<HTMLElement>(selector)].map((h) => ({
          id: h.id,
          title: h.textContent?.trim() ?? "",
          level: Number(h.tagName[1]) || 2,
        })),
      );
    const frame = requestAnimationFrame(read);
    const observer = new MutationObserver(read);
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [container, selector]);
  return items;
}

/* -------------------------------------------------------------------------------------------------
 * Table of contents
 * -----------------------------------------------------------------------------------------------*/

export type TableOfContentsProps = Omit<React.ComponentProps<"nav">, "children"> & {
  items: TocItem[];
  /** The element that scrolls. Leave empty when the page itself scrolls. */
  root?: React.RefObject<HTMLElement | null>;
  /** How far below the top of the scroll area a heading counts as reached: your sticky header's height plus a little. */
  offset?: number;
  /** Write the chosen section into the URL. Replaces rather than pushes, so Back leaves the page. */
  updateHash?: boolean;
  /** The quiet label above the list. Pass null to hide it. */
  label?: React.ReactNode;
  /** A "Back to top" link that appears once you're a screen in. */
  backToTop?: boolean;
  onActiveChange?: (id: string | null) => void;
};

type Geo = { top: number; height: number; x: number }[];
const JOG = 6;

export function TableOfContents({
  items,
  root,
  offset = 72,
  updateHash = true,
  label = "On this page",
  backToTop = true,
  onActiveChange,
  className,
  ...rest
}: TableOfContentsProps) {
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [geo, setGeo] = useState<Geo>([]);
  const listRef = useRef<HTMLOListElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const locked = useRef<string | null>(null);
  const last = useRef<string | null>(null);
  const unlock = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(unlock.current), []);
  const fill = useMotionValue(0);
  const onActive = useRef(onActiveChange);
  useEffect(() => {
    onActive.current = onActiveChange;
  });

  // Row positions for the rail, re-measured whenever the list changes size.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () =>
      setGeo(
        [...list.querySelectorAll<HTMLElement>("[data-toc-row]")].map((el) => ({
          top: el.offsetTop,
          height: el.offsetHeight,
          x: Number(el.dataset.depth) * 10 + 0.5,
        })),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items]);

  const path = railPath(geo);

  // Scroll-spy: the active section is the last heading that has passed the offset line.
  useEffect(() => {
    const scroller = root?.current ?? null;
    const target: HTMLElement | Window = scroller ?? window;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const viewport = scroller ? scroller.clientHeight : window.innerHeight;
      const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
      const max = (scroller ? scroller.scrollHeight : document.documentElement.scrollHeight) - viewport;
      const tops = items.map((it) => document.getElementById(it.id)?.getBoundingClientRect().top ?? Infinity).map((t) => t - top);
      let index = -1;
      tops.forEach((t, i) => t <= offset + 1 && (index = i));
      // At the very bottom, the last heading that's on screen wins even if it never reached the line.
      if (max > 0 && scrollTop >= max - 2) {
        for (let i = tops.length - 1; i > index; i--)
          if (tops[i] < viewport) {
            index = i;
            break;
          }
      }
      const id = locked.current ?? (index >= 0 ? items[index].id : (items[0]?.id ?? null));
      if (id !== last.current) {
        last.current = id;
        setActive(id);
        onActive.current?.(id);
      }
      setScrolled(scrollTop > viewport * 0.8);

      // How far through the active section you are fills the rail inside its row.
      const i = items.findIndex((it) => it.id === id);
      const next = tops[i + 1] ?? (max > 0 ? tops[i] + (max - scrollTop) + offset + 1 : tops[i] + 1);
      const progress = i < 0 ? 0 : Math.min(1, Math.max(0, (offset + 1 - tops[i]) / Math.max(1, next - tops[i])));
      fill.set(i < 0 ? 0 : i + (max > 0 && scrollTop >= max - 2 ? 1 : progress));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // A user scroll releases a click's lock on the active item.
    const release = () => (locked.current = null);
    const settle = () => {
      locked.current = null;
      schedule();
    };
    target.addEventListener("scroll", schedule, { passive: true });
    target.addEventListener("scrollend", settle);
    target.addEventListener("wheel", release, { passive: true });
    target.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      target.removeEventListener("scrollend", settle);
      target.removeEventListener("wheel", release);
      target.removeEventListener("touchstart", release);
      window.removeEventListener("resize", schedule);
    };
  }, [items, root, offset, fill]);

  // A long contents list keeps the active entry in its own view, without moving the page.
  useEffect(() => {
    const nav = navRef.current;
    const row = nav?.querySelector<HTMLElement>(`[data-toc-row][data-active]`);
    if (!nav || !row || nav.scrollHeight <= nav.clientHeight) return;
    const top = row.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
    if (top < nav.scrollTop + 24 || top + row.offsetHeight > nav.scrollTop + nav.clientHeight - 24)
      nav.scrollTo({
        top: top - nav.clientHeight / 3,
        behavior: reduce ? "auto" : "smooth",
      });
  }, [active, reduce]);

  const go = (id: string, e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const scroller = root?.current ?? null;
    const top = scroller ? el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop : el.getBoundingClientRect().top + window.scrollY;
    // The indicator goes straight to the target instead of stepping through every section on the way.
    locked.current = id;
    last.current = id;
    setActive(id);
    onActive.current?.(id);
    (scroller ?? window).scrollTo({
      top: top - offset,
      behavior: reduce ? "auto" : "smooth",
    });
    // Where scrollend isn't supported, the lock lets go on its own once the scroll has surely finished.
    window.clearTimeout(unlock.current);
    unlock.current = window.setTimeout(() => {
      locked.current = null;
      (scroller ?? window).dispatchEvent(new Event("scroll"));
    }, 1200);
    if (updateHash) history.replaceState(history.state, "", `#${id}`);
    // Keyboard users continue from the section they jumped to.
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  const toTop = () => {
    locked.current = null;
    (root?.current ?? window).scrollTo({
      top: 0,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const activeIndex = items.findIndex((it) => it.id === active);
  const depthOf = (level: number) => Math.max(0, level - Math.min(...items.map((i) => i.level)));

  return (
    <nav ref={navRef} aria-label={typeof label === "string" ? label : "On this page"} className={cn("relative flex min-h-0 flex-col text-[12.5px]", className)} {...rest}>
      {label !== null && <p className="mb-2.5 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase">{label}</p>}
      <div className="relative">
        <Rail path={path} geo={geo} activeIndex={activeIndex} fill={fill} reduce={reduce} />
        <ol ref={listRef} className="relative flex flex-col">
          {items.map((item, i) => {
            const on = item.id === active;
            const depth = depthOf(item.level);
            return (
              <li key={item.id} data-toc-row data-depth={depth} data-active={on || undefined} className="flex">
                <a
                  href={`#${item.id}`}
                  aria-current={on ? "location" : undefined}
                  onClick={(e) => go(item.id, e)}
                  style={{ paddingLeft: 12 + depth * 10 }}
                  className={cn(
                    "relative block w-full rounded-md py-[5px] pr-2 leading-[18px] outline-none",
                    "transition-[color] duration-150 ease-out",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                    on ? "text-fg" : i < activeIndex ? "text-fg-3 hover:text-fg-2" : "text-fg-3 hover:text-fg-2",
                    depth > 0 && "text-[12px]",
                  )}
                >
                  {item.title}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
      {backToTop && (
        <AnimatePresence initial={false}>
          {scrolled && (
            <motion.button
              type="button"
              onClick={toTop}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className={cn(
                "group/top mt-3 flex h-7 w-fit items-center gap-1.5 rounded-md pr-2 pl-3 text-[12px] text-fg-3 outline-none",
                "transition-[color,scale] duration-150 hover:text-fg active:scale-[0.97]",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
              )}
            >
              Back to top
              <ArrowUp size={12} className="transition-transform duration-150 ease-out group-hover/top:-translate-y-px motion-reduce:transition-none" />
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The rail: a line that steps in for nested sections, a fill for what you've read, and a
 * thumb that slides along the same path to the section you're in.
 * -----------------------------------------------------------------------------------------------*/

type Path = {
  d: string;
  starts: number[];
  ends: number[];
  total: number;
  height: number;
};

function railPath(geo: Geo): Path {
  let d = "";
  let len = 0;
  const starts: number[] = [];
  const ends: number[] = [];
  geo.forEach((row, i) => {
    const prev = geo[i - 1];
    const bottom = row.top + row.height;
    if (!prev) {
      d += `M${row.x} ${row.top}`;
      starts.push(0);
    } else if (prev.x !== row.x) {
      // Step in or out over the first few pixels of the row.
      d += `L${row.x} ${row.top + JOG}`;
      len += Math.hypot(row.x - prev.x, JOG);
      starts.push(len);
    } else starts.push(len);
    const from = prev && prev.x !== row.x ? row.top + JOG : row.top;
    d += `L${row.x} ${bottom}`;
    len += bottom - from;
    ends.push(len);
  });
  const last = geo[geo.length - 1];
  return {
    d,
    starts,
    ends,
    total: len,
    height: last ? last.top + last.height : 0,
  };
}

function Rail({ path, geo, activeIndex, fill, reduce }: { path: Path; geo: Geo; activeIndex: number; fill: MotionValue<number>; reduce: boolean }) {
  const start = useMotionValue(0);
  const length = useMotionValue(0);
  const shown = useRef(false);

  useEffect(() => {
    if (activeIndex < 0 || !path.total) return;
    const s = path.starts[activeIndex] + 3;
    const l = Math.max(4, path.ends[activeIndex] - path.starts[activeIndex] - 6);
    if (!shown.current || reduce) {
      start.jump(s);
      length.jump(l);
      shown.current = true;
      return;
    }
    const a = animate(start, s, spring.snappy);
    const b = animate(length, l, spring.snappy);
    return () => {
      a.stop();
      b.stop();
    };
  }, [activeIndex, path.total, path.starts, path.ends, start, length, reduce]);

  // Fill is "rows read" as a fractional index; map it onto the path's length.
  const filled = useTransform(fill, (f) => {
    if (!path.total) return 0;
    const i = Math.min(Math.floor(f), geo.length - 1);
    if (i < 0) return 0;
    return path.starts[i] + (path.ends[i] - path.starts[i]) * Math.min(1, f - i);
  });
  const fillDash = useTransform(filled, (v) => `${v} ${path.total + 10}`);
  const thumbDash = useTransform(length, (v) => `${v} ${path.total + 10}`);
  const thumbOffset = useTransform(start, (v) => -v);

  if (!path.total) return null;
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={24} height={path.height} fill="none">
      <path d={path.d} className="stroke-line-2" strokeWidth={1} />
      <motion.path d={path.d} className="stroke-fg-4" strokeWidth={1} style={{ strokeDasharray: fillDash }} />
      <motion.path d={path.d} className="stroke-fg" strokeWidth={1.5} strokeLinecap="round" style={{ strokeDasharray: thumbDash, strokeDashoffset: thumbOffset }} />
    </svg>
  );
}
