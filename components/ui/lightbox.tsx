"use client";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";
import { createContext, use, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import { useZoomPan } from "@/components/ui/zoom-pan-image";

export type LightboxImage = {
  src: string;
  alt: string;
  /** Intrinsic size, so the image is fitted and the flight is planned before it loads. */
  width: number;
  height: number;
  /** A smaller file already on the page. Shown instantly while `src` loads. Defaults to `src`. */
  thumb?: string;
  caption?: React.ReactNode;
};

type Phase = "closed" | "opening" | "open" | "closing";
type Rect = { left: number; top: number; width: number; height: number; radius: number };

type Ctx = {
  images: LightboxImage[];
  index: number;
  phase: Phase;
  openAt: (i: number, from: HTMLElement) => void;
  register: (i: number, el: HTMLElement | null) => void;
};
const LightboxContext = createContext<Ctx | null>(null);
const useLightbox = () => {
  const ctx = use(LightboxContext);
  if (!ctx) throw new Error("Lightbox parts must be inside <Lightbox>");
  return ctx;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const band = (over: number, size: number) => (over * size * 0.55) / (size + 0.55 * over);

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
}

export type LightboxProps = {
  images: LightboxImage[];
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Render the viewer inside this element instead of over the whole page. The element needs
   * position: relative and overflow: hidden; page scroll isn't locked.
   */
  container?: HTMLElement | null;
  /**
   * Finds the on-page image for an index when the thumbnails aren't LightboxTriggers (a gallery
   * grid, say), so the viewer can still fly out of and back into them.
   */
  getThumbnail?: (index: number) => HTMLElement | null;
  /** Accessible label of the viewer. Defaults to "Photo 3 of 8". */
  getLabel?: (index: number, total: number) => string;
  children: React.ReactNode;
};

export function Lightbox({
  images,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  container,
  getThumbnail,
  getLabel = (i, n) => `Photo ${i + 1} of ${n}`,
  children,
}: LightboxProps) {
  const [index, setIndex] = useControllableState({ value: indexProp, defaultValue: defaultIndex, onChange: onIndexChange });
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const thumbs = useRef(new Map<number, HTMLElement>());
  // The phase runs a step behind `open`: the viewer stays mounted while it flies back.
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const [from, setFrom] = useState<Rect | null>(null);
  const [instant, setInstant] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // An open or close requested from outside (controlled) still flies.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open && (phase === "closed" || phase === "closing")) {
      setFrom(null);
      setPhase("opening");
    }
    if (!open && (phase === "open" || phase === "opening")) setPhase("closing");
  }

  const register = useCallback((i: number, el: HTMLElement | null) => {
    if (el) thumbs.current.set(i, el);
    else thumbs.current.delete(i);
  }, []);

  const openAt = useCallback(
    (i: number, el: HTMLElement) => {
      setFrom(rectOf(el));
      setInstant(false);
      setIndex(i);
      setPhase("opening");
      setOpen(true);
    },
    [setIndex, setOpen],
  );

  const requestClose = useCallback(
    (quick = false) => {
      setInstant(quick);
      setPhase((p) => (p === "closed" ? p : "closing"));
      setOpen(false);
    },
    [setOpen],
  );

  const mounted = phase !== "closed";

  return (
    <LightboxContext value={{ images, index, phase, openAt, register }}>
      <Dialog.Root
        open={mounted}
        modal={container ? "trap-focus" : true}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        {children}
        {mounted && (
          <Dialog.Portal container={container}>
            <Viewer
              images={images}
              index={index}
              setIndex={setIndex}
              phase={phase}
              from={from}
              instant={instant}
              contained={container != null}
              label={getLabel(index, images.length)}
              thumbFor={(i) => thumbs.current.get(i) ?? getThumbnail?.(i) ?? null}
              onOpened={() => setPhase((p) => (p === "opening" ? "open" : p))}
              onClosed={() => setPhase((p) => (p === "closing" ? "closed" : p))}
              requestClose={requestClose}
            />
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </LightboxContext>
  );
}

export type LightboxTriggerProps = Omit<React.ComponentProps<"button">, "children"> & {
  index: number;
  /** Classes for the thumbnail image. */
  imgClassName?: string;
};

/** A thumbnail that opens the viewer. The image flies out of it, and back into it on close. */
export function LightboxTrigger({ index, className, imgClassName, onClick, ref, ...rest }: LightboxTriggerProps) {
  const { images, index: current, phase, openAt, register } = useLightbox();
  const image = images[index];
  // While its image is up in the viewer, the thumbnail's slot stays empty: that's where it will land.
  const lifted = phase !== "closed" && current === index;
  return (
    <button
      type="button"
      aria-label={`View ${image.alt}`}
      aria-haspopup="dialog"
      data-lifted={lifted || undefined}
      ref={(el) => {
        register(index, el);
        if (typeof ref === "function") return ref(el);
        if (ref) ref.current = el;
      }}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) openAt(index, e.currentTarget);
      }}
      className={cn(
        "group/thumb relative block overflow-hidden rounded-lg bg-hover",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
        "after:absolute after:inset-0 after:rounded-[inherit] after:bg-page/0 after:transition-colors after:duration-150 hover:after:bg-page/15",
        className,
      )}
      {...rest}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.thumb ?? image.src}
        alt=""
        draggable={false}
        decoding="async"
        className={cn("size-full object-cover group-data-lifted/thumb:opacity-0", imgClassName)}
      />
    </button>
  );
}

type ViewerProps = {
  images: LightboxImage[];
  index: number;
  setIndex: (i: number) => void;
  phase: Phase;
  from: Rect | null;
  instant: boolean;
  contained: boolean;
  label: string;
  thumbFor: (i: number) => HTMLElement | null;
  onOpened: () => void;
  onClosed: () => void;
  requestClose: (quick?: boolean) => void;
};

const GAP = 24;

function Viewer({ images, index, setIndex, phase, from, instant, contained, label, thumbFor, onOpened, onClosed, requestClose }: ViewerProps) {
  const reduce = !!useReducedMotion();
  const image = images[index];
  const count = images.length;
  const live = phase === "open";
  // Lets a close drop a swipe that is still under the finger.
  const cancelSwipe = useRef<() => void>(() => {});
  const {
    viewportRef,
    contentRef,
    x,
    y,
    scale,
    zoomed,
    reset,
    toggle,
    onKeyDown: zoomKeys,
  } = useZoomPan({ max: 4, doubleTapScale: 2.5, wheel: "modifier", disabled: !live });
  const track = useMotionValue(0);
  const veil = useMotionValue(0);
  // How far the image is cropped toward its thumbnail: insets in the content's own pixels, and a radius.
  const crop = useMotionValue({ t: 0, r: 0, b: 0, l: 0, radius: 0 });
  const clipPath = useTransform(() => {
    const c = crop.get();
    return c.t || c.r || c.b || c.l || c.radius ? `inset(${c.t}px ${c.r}px ${c.b}px ${c.l}px round ${c.radius}px)` : "none";
  });
  const chrome = useTransform(() => clamp((veil.get() - 0.6) / 0.4, 0, 1));
  const flight = useRef<AnimationPlaybackControls | null>(null);
  const [settledIndex, setSettledIndex] = useState(index);
  // Where a pointer navigation is heading: the counter and caption change as the move starts, not after it.
  const [heading, setHeading] = useState<{ from: number; to: number } | null>(null);
  const shown = heading && heading.from === index ? heading.to : index;
  const shownImage = images[shown];

  // Plan a flight between the fitted image and a thumbnail rect (client px). Returns the values
  // that make the content sit exactly over the thumbnail, cropped like object-fit: cover.
  const plan = useCallback(
    (target: Rect) => {
      const v = viewportRef.current;
      const c = contentRef.current;
      if (!v || !c) return null;
      const vr = v.getBoundingClientRect();
      const R = { left: c.offsetLeft, top: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight };
      if (!R.w || !R.h) return null;
      const T = { left: target.left - vr.left, top: target.top - vr.top, w: target.width, h: target.height };
      const k = Math.max(T.w / R.w, T.h / R.h);
      const cropX = (R.w - T.w / k) / 2;
      const cropY = (R.h - T.h / k) / 2;
      return {
        s: k,
        // Content is scaled from its top-left; place it so the visible (cropped) window lands on T.
        x: T.left - R.left - cropX * k,
        y: T.top - R.top - cropY * k,
        crop: { t: cropY, r: cropX, b: cropY, l: cropX, radius: target.radius / k },
        visible: T.left + T.w > 0 && T.top + T.h > 0 && T.left < vr.width && T.top < vr.height,
      };
    },
    [viewportRef, contentRef],
  );

  // Drive x, y, scale, crop and the veil from one progress value, so they can never drift apart.
  const fly = useCallback(
    (to: { s: number; x: number; y: number; crop: { t: number; r: number; b: number; l: number; radius: number }; veil: number }, transition: object, done: () => void) => {
      flight.current?.stop();
      const f = { s: scale.get(), x: x.get(), y: y.get(), crop: crop.get(), veil: veil.get() };
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      flight.current = animate(0, 1, {
        ...transition,
        onUpdate: (t) => {
          scale.set(lerp(f.s, to.s, t));
          x.set(lerp(f.x, to.x, t));
          y.set(lerp(f.y, to.y, t));
          veil.set(clamp(lerp(f.veil, to.veil, t), 0, 1));
          crop.set({
            t: Math.max(0, lerp(f.crop.t, to.crop.t, t)),
            r: Math.max(0, lerp(f.crop.r, to.crop.r, t)),
            b: Math.max(0, lerp(f.crop.b, to.crop.b, t)),
            l: Math.max(0, lerp(f.crop.l, to.crop.l, t)),
            radius: Math.max(0, lerp(f.crop.radius, to.crop.radius, t)),
          });
        },
        onComplete: done,
      });
    },
    [scale, x, y, crop, veil],
  );

  const none = { t: 0, r: 0, b: 0, l: 0, radius: 0 };

  // Opening: start exactly over the thumbnail, before the first paint, then fly out.
  useLayoutEffect(() => {
    if (phase !== "opening") return;
    const el = from ? null : thumbFor(index);
    const rect = from ?? (el ? rectOf(el) : null);
    const p = rect && !reduce ? plan(rect) : null;
    if (!p) {
      scale.set(reduce ? 1 : 0.96);
      veil.set(0);
      fly({ s: 1, x: 0, y: 0, crop: none, veil: 1 }, { duration: reduce ? 0.15 : 0.22, ease: ease.out }, onOpened);
      return;
    }
    scale.set(p.s);
    x.set(p.x);
    y.set(p.y);
    crop.set(p.crop);
    veil.set(0);
    fly({ s: 1, x: 0, y: 0, crop: none, veil: 1 }, spring.soft, onOpened);
    // Runs once per opening; the values it reads are fixed for that flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Closing: back into the thumbnail of whichever image is showing now, from wherever it is.
  useLayoutEffect(() => {
    if (phase !== "closing") return;
    cancelSwipe.current();
    track.set(0);
    const el = thumbFor(index);
    const p = el && !reduce && !instant ? plan(rectOf(el)) : null;
    if (!p || !p.visible) {
      // The thumbnail is off screen (or motion is reduced): fade where it stands instead.
      fly({ s: reduce || instant ? scale.get() : scale.get() * 0.96, x: x.get(), y: y.get(), crop: crop.get(), veil: 0 }, { duration: instant ? 0 : reduce ? 0.12 : 0.16, ease: ease.in }, onClosed);
      return;
    }
    fly({ s: p.s, x: p.x, y: p.y, crop: p.crop, veil: 0 }, spring.snappy, onClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => flight.current?.stop(), []);

  // A new image starts unzoomed; the strip snaps back under it in the same frame.
  if (settledIndex !== index) setSettledIndex(index);
  useLayoutEffect(() => {
    if (phase !== "open") return;
    track.set(0);
    reset({ instant: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledIndex]);

  const go = useCallback(
    (dir: 1 | -1, how: "pointer" | "key") => {
      const next = index + dir;
      if (next < 0 || next >= count || phase !== "open") return;
      const w = viewportRef.current?.clientWidth ?? 0;
      if (how === "key" || reduce || !w) return setIndex(next);
      flight.current?.stop();
      setHeading({ from: index, to: next });
      flight.current = animate(track, -dir * (w + GAP), { ...spring.snappy, onComplete: () => setIndex(next) });
    },
    [index, count, phase, reduce, setIndex, track, viewportRef],
  );

  // Single-pointer drags at rest: sideways to move between images, down (or up) to dismiss.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || phase !== "open") return;
    let start: { x: number; y: number; id: number } | null = null;
    let axis: "x" | "y" | null = null;
    let active = 0;
    let startedOn: EventTarget | null = null;

    const cancel = () => {
      if (!start) return;
      start = null;
      axis = null;
      animate(track, 0, spring.snappy);
      animate(y, 0, spring.snappy);
      animate(scale, 1, spring.snappy);
      animate(veil, 1, { duration: 0.2 });
    };
    cancelSwipe.current = cancel;

    const down = (e: PointerEvent) => {
      active++;
      if (active > 1 || scale.get() > 1.001 || (e.pointerType === "mouse" && e.button !== 0)) {
        if (start) cancel();
        return;
      }
      if ((e.target as HTMLElement).closest("button")) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      startedOn = e.target;
      axis = null;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!axis) {
        if (Math.hypot(dx, dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        el.setPointerCapture(e.pointerId);
        flight.current?.stop();
      }
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (axis === "x") {
        const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
        track.set(atEdge ? Math.sign(dx) * band(Math.abs(dx), w) : dx);
      } else {
        // The image follows the finger 1:1 and shrinks a little; the veil thins as it goes.
        const d = Math.abs(dy);
        y.set(dy);
        scale.set(1 - Math.min(d / h, 1) * 0.25);
        veil.set(1 - Math.min(d / (h * 0.6), 1));
      }
    };
    const up = (e: PointerEvent) => {
      active = Math.max(0, active - 1);
      if (!start || e.pointerId !== start.id) return;
      const s = start;
      start = null;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!axis) {
        // A plain click on the dark around the image closes it.
        if (e.type === "pointerup" && startedOn === el && !contentRef.current?.contains(e.target as Node)) requestClose();
        return;
      }
      if (axis === "x") {
        const v = track.getVelocity();
        const w = el.clientWidth;
        const dir = dx < 0 ? 1 : -1;
        const next = index + dir;
        if ((Math.abs(dx) > w * 0.2 || Math.abs(v) > 500) && Math.sign(v || dx) === -dir && next >= 0 && next < count) {
          setHeading({ from: index, to: next });
          flight.current = animate(track, -dir * (w + GAP), { ...spring.snappy, velocity: v, onComplete: () => setIndex(next) });
        } else animate(track, 0, { ...spring.snappy, velocity: v });
      } else {
        const v = y.getVelocity();
        if (Math.abs(dy) > 110 || Math.abs(v) > 700) requestClose();
        else {
          animate(y, 0, { ...spring.snappy, velocity: v });
          animate(scale, 1, spring.snappy);
          animate(veil, 1, { duration: 0.2, ease: ease.out });
        }
      }
      axis = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      cancelSwipe.current = () => {};
    };
  }, [phase, index, count, viewportRef, contentRef, track, y, scale, veil, setIndex, requestClose]);

  const slides = [index - 1, index, index + 1].filter((i) => i >= 0 && i < count);
  const chromeHidden = phase !== "open";

  return (
    <>
      <Dialog.Backdrop
        render={<motion.div style={{ opacity: veil }} />}
        className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-overlay) bg-page")}
      />
      <Dialog.Popup
        finalFocus={() => thumbFor(index) ?? true}
        className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-dialog) outline-none")}
        onKeyDown={(e) => {
          zoomKeys(e);
          if (e.defaultPrevented) return;
          if (e.key === "ArrowRight") go(1, "key");
          else if (e.key === "ArrowLeft") go(-1, "key");
          else return;
          e.preventDefault();
        }}
      >
        <div
          ref={viewportRef}
          data-zoomed={zoomed || undefined}
          className="absolute inset-0 touch-none select-none overflow-hidden [container-type:size] [--lb-x:24px] sm:[--lb-x:128px]"
        >
          <motion.div className="absolute inset-0" style={{ x: track }}>
            {slides.map((i) => {
              const img = images[i];
              const ratio = img.width / img.height;
              const isActive = i === index;
              return (
                <div
                  key={i}
                  aria-hidden={!isActive || undefined}
                  className="absolute inset-0"
                  style={{ transform: `translateX(calc(${(i - index) * 100}% + ${(i - index) * GAP}px))` }}
                >
                  <motion.div
                    ref={isActive ? contentRef : undefined}
                    // Fitted inside the space the chrome leaves, at the image's own ratio.
                    className={cn(
                      "absolute inset-x-3 bottom-[76px] top-14 m-auto sm:inset-x-16",
                      isActive && live && (zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"),
                    )}
                    style={{
                      width: `min(100cqw - var(--lb-x), (100cqh - 132px) * ${ratio})`,
                      height: `min(100cqh - 132px, (100cqw - var(--lb-x)) / ${ratio})`,
                      ...(isActive ? { x, y, scale, originX: 0, originY: 0, clipPath } : {}),
                    }}
                  >
                    <SlideImage image={img} priority={isActive} />
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Chrome: fades in once the image has landed, and out the moment it leaves. */}
        <motion.div style={{ opacity: chrome }} className={cn("pointer-events-none absolute inset-0", !chromeHidden && "*:pointer-events-auto")}>
          <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
            <Dialog.Title className="flex h-7 items-center gap-1 rounded-full border border-line-2 bg-raised/80 px-2.5 font-mono text-[11.5px] text-fg-2 shadow-[var(--shadow)] backdrop-blur-sm tabular">
              <span className="sr-only">
                {label}: {image.alt}
              </span>
              <NumberFlow aria-hidden value={shown + 1} animated={!reduce} className="text-fg" />
              <span aria-hidden className="text-fg-3">
                / {count}
              </span>
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <ChromeButton label={zoomed ? "Zoom out" : "Zoom in"} onClick={() => toggle()}>
                {zoomed ? <ZoomOut /> : <ZoomIn />}
              </ChromeButton>
              <Dialog.Close
                aria-label="Close"
                className={chromeButtonClass}
              >
                <X />
              </Dialog.Close>
            </div>
          </div>

          <NavButton side="left" label="Previous photo" disabled={index === 0} onClick={() => go(-1, "pointer")} />
          <NavButton side="right" label="Next photo" disabled={index === count - 1} onClick={() => go(1, "pointer")} />

          <div className="pointer-events-none! absolute inset-x-0 bottom-0 flex h-[76px] items-center justify-center px-14 sm:px-16">
            <p
              key={shown}
              className={cn(
                "line-clamp-2 max-w-[60ch] text-balance text-center text-[12.5px] leading-[18px] text-fg-2 transition-opacity duration-200 starting:opacity-0",
                // Out of the way while zoomed: the photo has the whole frame.
                zoomed && "opacity-0",
              )}
            >
              {shownImage.caption ?? shownImage.alt}
            </p>
          </div>
        </motion.div>
      </Dialog.Popup>
    </>
  );
}

// The thumbnail (already decoded on the page) shows at once; the full file fades in over it.
function SlideImage({ image, priority }: { image: LightboxImage; priority: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {image.thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.thumb} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={(img) => {
          if (img?.complete && img.naturalWidth) setLoaded(true);
        }}
        src={image.src}
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        onLoad={() => setLoaded(true)}
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out",
          loaded || !image.thumb ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}

// Chrome sits on its own small surfaces, so it stays legible over a zoomed photo in either theme.
const chromeButtonClass = cn(
  "relative grid size-8 place-items-center rounded-full border border-line-2 bg-raised/80 text-fg-2 shadow-[var(--shadow)] backdrop-blur-sm",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
);

function ChromeButton({ label, children, ...rest }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={chromeButtonClass} {...rest}>
      {children}
    </button>
  );
}

function NavButton({ side, label, ...rest }: React.ComponentProps<"button"> & { side: "left" | "right"; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "group/nav absolute bottom-5 grid size-9 place-items-center rounded-full border border-line-2 bg-raised/80 text-fg-2 shadow-[var(--shadow)] backdrop-blur-sm sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2",
        side === "left" ? "left-3 sm:left-4" : "right-3 sm:right-4",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,color,scale,opacity] duration-150 enabled:hover:bg-hover enabled:hover:text-fg enabled:active:scale-[0.92] enabled:active:duration-75",
        "disabled:opacity-0",
        "before:absolute before:-inset-1 before:content-['']",
      )}
      {...rest}
    >
      {side === "left" ? (
        <ChevronLeft className="transition-transform duration-150 ease-out group-enabled/nav:group-hover/nav:-translate-x-px" />
      ) : (
        <ChevronRight className="transition-transform duration-150 ease-out group-enabled/nav:group-hover/nav:translate-x-px" />
      )}
    </button>
  );
}
