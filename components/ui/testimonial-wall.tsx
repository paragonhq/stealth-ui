"use client";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { spring, swap } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type Testimonial = {
  /** Stable key. Falls back to the name. */
  id?: string;
  /** The quote. Wrap the line that sells it in <strong> and it steps up to the primary color. */
  quote: React.ReactNode;
  name: string;
  /** Role and company, e.g. "Staff engineer, Northwind". */
  role?: string;
  /** Square image URL. Initials show until it loads, and if it never does. */
  avatar?: string;
};

/** Cards and columns share one gap, so the loop's seam is invisible. */
const GAP = 12;
/** Narrowest a column gets before the wall drops one. */
const MIN_COLUMN = 216;
/** Each column runs at a slightly different pace, so the wall never moves in lockstep. */
const PACE = [1, 0.84, 1.12, 0.93];
/** How long the wall takes to settle when it slows for a reader, and to pick up again. */
const SLOW_MS = 170;
const RESUME_MS = 360;

// Reduced motion changes the markup (a scrollable region instead of a loop), so it
// reads "no preference" while hydrating and switches to the real value right after.
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);
}

/**
 * Deals items into columns, each to the currently shortest one, estimating height
 * from the quote's length. Deterministic, so server and client agree.
 */
function distribute(items: Testimonial[], count: number) {
  const cols: { item: Testimonial; index: number }[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  items.forEach((item, index) => {
    let target = 0;
    for (let c = 1; c < count; c++) if (heights[c] < heights[target] - 1) target = c;
    cols[target].push({ item, index });
    heights[target] += 96 + (typeof item.quote === "string" ? item.quote.length : 140) * 0.55;
  });
  return cols;
}

export type TestimonialWallProps = Omit<React.ComponentProps<"section">, "children"> & {
  items: Testimonial[];
  /** The most columns it will use. It drops to fewer as its container narrows (about 216px each). */
  columns?: 1 | 2 | 3 | 4;
  /** Pixels per second for the average column. */
  speed?: number;
  /** Height of the visible window. */
  height?: number | string;
  /** Whether the columns run. Hover and touch-and-hold still pause them for a moment. */
  playing?: boolean;
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Show the pause button in the corner. Motion longer than five seconds needs one; hide it only if you render your own. */
  showControl?: boolean;
  pauseLabel?: string;
  playLabel?: string;
  /** Draw your own card. Defaults to TestimonialCard. */
  renderItem?: (item: Testimonial, index: number) => React.ReactNode;
};

/**
 * A masonry of testimonials in columns that drift in opposite directions, looping
 * without a seam. A pointer resting on it slows every column to a stop so the card
 * under it can be read, and they ease back up when it leaves. Off screen, in a
 * hidden tab or under reduced motion nothing moves; with reduced motion the wall
 * becomes a plain scrollable region instead.
 */
export function TestimonialWall({
  items,
  columns = 3,
  speed = 18,
  height = 480,
  playing: playingProp,
  defaultPlaying = true,
  onPlayingChange,
  showControl = true,
  pauseLabel = "Pause testimonials",
  playLabel = "Play testimonials",
  renderItem = (item) => <TestimonialCard {...item} />,
  className,
  style,
  "aria-label": ariaLabel = "Testimonials",
  ...rest
}: TestimonialWallProps) {
  const [playing, setPlaying] = useControllableState({ value: playingProp, defaultValue: defaultPlaying, onChange: onPlayingChange });
  const reduce = usePrefersReducedMotion();
  const [section, setSection] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<number>(columns);
  const [hovered, setHovered] = useState(false);
  const [holding, setHolding] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);

  // How many columns fit, and whether anyone can see the wall at all.
  useEffect(() => {
    if (!section) return;
    const ro = new ResizeObserver(([e]) => setFit(Math.max(1, Math.floor((e.contentRect.width + GAP) / (MIN_COLUMN + GAP)))));
    ro.observe(section);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(section);
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [section]);

  const count = Math.max(1, Math.min(columns, fit, items.length));
  const cols = useMemo(() => distribute(items, count), [items, count]);

  const animating = !reduce;
  const moving = animating && playing && !hovered && !holding && visible && !pageHidden;
  // Leaving the screen or the tab stops dead; a reader arriving gets the ease.
  const instant = !visible || pageHidden;

  // One rate for every column, eased toward 0 or 1 on its own frame loop. Setting
  // playbackRate keeps each animation's current time, so nothing ever jumps.
  const anims = useRef(new Set<Animation>());
  const rate = useRef(0);
  const register = useCallback((anim: Animation) => {
    anim.playbackRate = rate.current;
    anims.current.add(anim);
    return () => void anims.current.delete(anim);
  }, []);

  useEffect(() => {
    if (!animating) return;
    const target = moving ? 1 : 0;
    const apply = () => anims.current.forEach((a) => (a.playbackRate = rate.current));
    if (instant) {
      rate.current = target;
      apply();
      return;
    }
    const tau = target ? RESUME_MS / 3 : SLOW_MS / 3;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      rate.current += (target - rate.current) * (1 - Math.exp(-(now - last) / tau));
      last = now;
      if (Math.abs(target - rate.current) < 0.004) rate.current = target;
      apply();
      if (rate.current !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating, moving, instant]);

  if (!items.length) return null;

  return (
    <section
      ref={setSection}
      aria-label={ariaLabel}
      data-slot="testimonial-wall"
      data-state={reduce ? "static" : moving ? "playing" : "paused"}
      data-columns={count}
      className={cn("group/wall @container/wall relative isolate min-w-0", className)}
      style={style}
      {...rest}
    >
      <div
        tabIndex={reduce ? 0 : undefined}
        role={reduce ? "region" : undefined}
        aria-label={reduce ? `${ariaLabel}, scrollable` : undefined}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        // On touch, a finger resting on the wall holds it still; a scroll cancels the hold.
        onPointerDown={(e) => e.pointerType !== "mouse" && setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        className={cn(
          // Bleeds 12px each side so card shadows are not clipped by the overflow.
          "-mx-3 flex min-w-0 gap-3 px-3 outline-none",
          reduce
            ? "peer overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,var(--fg)_calc(100%-40px),transparent)]"
            : "overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,var(--fg)_14%,var(--fg)_86%,transparent)]",
        )}
        style={{ height }}
      >
        {cols.map((col, i) => (
          <Column
            key={i}
            entries={col}
            index={i}
            reverse={i % 2 === 1}
            speed={speed * PACE[i % PACE.length]}
            animate={animating}
            register={register}
            renderItem={renderItem}
          />
        ))}
      </div>

      {/* The mask would clip an outline drawn on the scroller itself, so the ring is a sibling. */}
      {reduce && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden rounded-xl outline-1 outline-offset-2 outline-fg-3 peer-focus-visible:block peer-focus-visible:outline-solid"
        />
      )}

      {showControl && !reduce && (
        <PlayToggle playing={playing} onToggle={() => setPlaying(!playing)} pauseLabel={pauseLabel} playLabel={playLabel} />
      )}
    </section>
  );
}

type Entry = { item: Testimonial; index: number };

function Column({
  entries,
  index,
  reverse,
  speed,
  animate,
  register,
  renderItem,
}: {
  entries: Entry[];
  index: number;
  reverse: boolean;
  speed: number;
  animate: boolean;
  register: (anim: Animation) => () => void;
  renderItem: (item: Testimonial, index: number) => React.ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLUListElement>(null);
  // Copies needed so the column never shows a gap: enough to cover the window, plus one.
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const view = viewport.current;
    const el = track.current;
    const one = first.current;
    if (!animate || !view || !el || !one) return;
    let anim: Animation | null = null;
    let unregister = () => {};
    let lastDistance = 0;
    let lastDuration = 0;

    const build = () => {
      // One copy plus the gap to the next: moving by exactly this lands on an identical frame.
      const distance = one.offsetHeight + GAP;
      setCopies(Math.max(2, Math.ceil(view.clientHeight / distance) + 1));
      if (distance === lastDistance && anim) return;
      lastDistance = distance;
      const duration = (distance / speed) * 1000;
      // Keep the place in the loop across rebuilds. A fresh reverse column starts at the
      // end of its loop, which is the same frame the server rendered.
      const progress = anim && lastDuration ? (Number(anim.currentTime) % lastDuration) / lastDuration : reverse ? 0.9999 : 0;
      lastDuration = duration;
      unregister();
      anim?.cancel();
      anim = el.animate(
        [{ transform: `translate3d(0, ${reverse ? -distance : 0}px, 0)` }, { transform: `translate3d(0, ${reverse ? 0 : -distance}px, 0)` }],
        { duration, iterations: Infinity, easing: "linear" },
      );
      anim.currentTime = progress * duration;
      unregister = register(anim);
    };

    const ro = new ResizeObserver(build);
    ro.observe(one);
    ro.observe(view);
    return () => {
      ro.disconnect();
      unregister();
      anim?.cancel();
    };
  }, [animate, reverse, speed, register]);

  return (
    <div
      ref={viewport}
      data-column={index}
      className={cn(
        "min-w-0 flex-1",
        // Before hydration measures the width, container queries hide the columns that won't fit.
        index === 1 && "@max-[443px]/wall:hidden",
        index === 2 && "@max-[671px]/wall:hidden",
        index === 3 && "@max-[899px]/wall:hidden",
      )}
    >
      <div ref={track} className="flex flex-col gap-3 will-change-transform">
        <Copy ref={first} entries={entries} renderItem={renderItem} />
        {animate &&
          Array.from({ length: copies - 1 }, (_, c) => <Copy key={c} entries={entries} renderItem={renderItem} duplicate />)}
      </div>
    </div>
  );
}

function Copy({
  entries,
  renderItem,
  duplicate,
  ref,
}: {
  entries: Entry[];
  renderItem: (item: Testimonial, index: number) => React.ReactNode;
  duplicate?: boolean;
  ref?: React.Ref<HTMLUListElement>;
}) {
  return (
    // The loop's repeats are for the eye only: hidden from assistive tech and unfocusable.
    <ul ref={ref} aria-hidden={duplicate || undefined} inert={duplicate || undefined} className="flex flex-col gap-3">
      {entries.map(({ item, index }) => (
        <li key={item.id ?? `${item.name}-${index}`}>{renderItem(item, index)}</li>
      ))}
    </ul>
  );
}

export type TestimonialCardProps = Omit<React.ComponentProps<"figure">, "children"> & Omit<Testimonial, "id">;

/** One quote with who said it. Name and role wrap rather than truncate: the company is the point. */
export function TestimonialCard({ quote, name, role, avatar, className, ...rest }: TestimonialCardProps) {
  return (
    <figure
      data-slot="testimonial-card"
      className={cn("flex flex-col gap-3.5 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <blockquote className="text-[13px] leading-[1.55] text-pretty text-fg-2 [&_strong]:font-normal [&_strong]:text-fg">
        <p>{quote}</p>
      </blockquote>
      <figcaption className="flex min-w-0 items-center gap-2.5">
        <Avatar name={name} src={avatar} />
        <span className="flex min-w-0 flex-col">
          <span className="text-[12.5px] font-medium leading-[1.3] tracking-[-0.005em] text-fg">{name}</span>
          {role && <span className="text-[12px] leading-[1.35] text-pretty text-fg-3">{role}</span>}
        </span>
      </figcaption>
    </figure>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border border-line-2 bg-hover text-[10px] font-medium tracking-[0.02em] text-fg-2">
      {initials}
      {src && status !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element -- a copied component can't assume next/image
        <img
          src={src}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out", status === "loaded" ? "opacity-100" : "opacity-0")}
        />
      )}
    </span>
  );
}

function PlayToggle({ playing, onToggle, pauseLabel, playLabel }: { playing: boolean; onToggle: () => void; pauseLabel: string; playLabel: string }) {
  return (
    <button
      type="button"
      data-state={playing ? "playing" : "paused"}
      aria-label={playing ? pauseLabel : playLabel}
      onClick={onToggle}
      className={cn(
        "absolute bottom-2 right-2 z-10 inline-grid size-7 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart hover:border-fg-4 hover:bg-hover hover:text-fg",
        "active:scale-[0.92] active:duration-75",
        "touch-manipulation [-webkit-tap-highlight-color:transparent] pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.svg
          key={playing ? "pause" : "play"}
          width={12}
          height={12}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden
          focusable={false}
          initial={swap.initial}
          animate={swap.animate}
          exit={swap.exit}
          transition={spring.pop}
        >
          {playing ? (
            <>
              <rect x="4" y="3" width="2.75" height="10" rx="1" />
              <rect x="9.25" y="3" width="2.75" height="10" rx="1" />
            </>
          ) : (
            // Nudged right: a triangle looks centered when its mass is, not its box.
            <path d="M5.5 3.6v8.8a.8.8 0 0 0 1.2.7l7-4.4a.8.8 0 0 0 0-1.4l-7-4.4a.8.8 0 0 0-1.2.7z" transform="translate(-0.6 0)" />
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}
