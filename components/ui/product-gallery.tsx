"use client";
import { Tabs } from "@base-ui/react/tabs";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";
import { BlurUpImage } from "@/components/ui/blur-up-image";

export type ProductImage = {
  src: string;
  alt: string;
  /** A small version for the thumbnail strip; also the blurred placeholder while `src` loads. */
  thumb?: string;
  /** A larger file for the zoom lens. Defaults to `src`. */
  zoomSrc?: string;
};

type Via = "click" | "key" | "swipe";

export type ProductGalleryProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  images: ProductImage[];
  /** The index of the image showing. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  /** Shape of the main image. */
  aspectRatio?: number | string;
  /** Where the thumbnails sit. */
  thumbnails?: "bottom" | "left";
  /** Magnification of the hover lens. */
  zoom?: number;
  /** Show a magnifying lens under the mouse. Touch devices never get it. */
  lens?: boolean;
  /** Accessible name for the thumbnail list. */
  label?: string;
};

export function ProductGallery({
  images,
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  aspectRatio = "1 / 1",
  thumbnails = "bottom",
  zoom = 2.5,
  lens = true,
  label = "Product images",
  className,
  ...rest
}: ProductGalleryProps) {
  const [index, setIndex] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [via, setVia] = useState<Via>("click");
  const [dragging, setDragging] = useState(false);
  const [lensOn, setLensOn] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const lensEl = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null; dx: number; t: number; v: number } | null>(null);
  const count = images.length;
  const vertical = thumbnails === "left";

  const go = (next: number, how: Via) => {
    if (next < 0 || next >= count || next === index) return;
    setVia(how);
    setIndex(next);
  };

  // --- Swipe on touch: the photo follows the finger with its neighbour peeking in beside it. ---
  const setDrag = (px: number) => stage.current?.style.setProperty("--pg-drag", `${px}px`);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || count < 2) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, dx: 0, t: e.timeStamp, v: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "y") return;
      // Capture can fail if the pointer already ended; the drag still works without it.
      try {
        stage.current?.setPointerCapture(e.pointerId);
      } catch {}
      setDragging(true);
    }
    if (d.axis !== "x") return;
    const w = stage.current?.clientWidth ?? 1;
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
    // Past the first or last photo it gives a little and no more.
    const moved = atEdge ? (Math.sign(dx) * (Math.abs(dx) * w * 0.55)) / (w + 0.55 * Math.abs(dx)) : dx;
    d.v = ((moved - d.dx) / Math.max(1, e.timeStamp - d.t)) * 1000;
    d.dx = moved;
    d.t = e.timeStamp;
    setDrag(moved);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.axis !== "x") return;
    const w = stage.current?.clientWidth ?? 1;
    const dir = d.dx < 0 ? 1 : -1;
    const next = index + dir;
    const commit = e.type === "pointerup" && next >= 0 && next < count && (Math.abs(d.dx) > w * 0.2 || (Math.abs(d.v) > 400 && Math.sign(d.v) === -dir));
    // The strip carries on from wherever the finger left it: to the next photo, or back.
    if (commit) go(next, "swipe");
    setDrag(0);
    setDragging(false);
  };

  // --- Hover lens: a loupe that follows the mouse 1:1 over the photo. ---
  const moveLens = (e: React.PointerEvent) => {
    const s = stage.current;
    const l = lensEl.current;
    if (!s || !l) return;
    const r = s.getBoundingClientRect();
    const img = s.querySelector<HTMLImageElement>("[data-pg-active] img:last-of-type");
    const nw = img?.naturalWidth || r.width;
    const nh = img?.naturalHeight || r.height;
    // The photo covers the stage, so it may overflow one axis; work in its rendered box.
    const k = Math.max(r.width / nw, r.height / nh);
    const iw = nw * k;
    const ih = nh * k;
    const ox = (r.width - iw) / 2;
    const oy = (r.height - ih) / 2;
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    const size = l.offsetWidth;
    l.style.translate = `${x - size / 2}px ${y - size / 2}px`;
    l.style.backgroundSize = `${iw * zoom}px ${ih * zoom}px`;
    l.style.backgroundPosition = `${-((x - ox) * zoom - size / 2)}px ${-((y - oy) * zoom - size / 2)}px`;
  };

  const active = images[index];

  return (
    <Tabs.Root
      value={index}
      onValueChange={(v, details) => go(v as number, details.event?.type === "keydown" ? "key" : "click")}
      orientation={vertical ? "vertical" : "horizontal"}
      data-via={via}
      data-mode={dragging || via === "swipe" ? "track" : "fade"}
      className={cn("group/pg flex w-full gap-2.5", vertical ? "flex-row-reverse items-start" : "flex-col", className)}
      {...rest}
    >
      <div
        ref={stage}
        data-dragging={dragging || undefined}
        data-lens={lensOn || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          onPointerMove(e);
          if (lensOn) moveLens(e);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={(e) => {
          if (!lens || e.pointerType !== "mouse") return;
          setLensOn(true);
          moveLens(e);
        }}
        onPointerLeave={() => setLensOn(false)}
        className={cn(
          "relative isolate grid min-w-0 flex-1 touch-pan-y select-none overflow-hidden rounded-xl bg-hover [--pg-drag:0px]",
          // The photo clips its own outline, so a focused photo rings the frame instead.
          "outline-offset-2 outline-fg-3 has-[[role=tabpanel]:focus-visible]:outline-1 has-[[role=tabpanel]:focus-visible]:outline-solid",
          lens && "data-lens:cursor-none",
        )}
        style={{ aspectRatio }}
      >
        {images.map((img, i) => (
          <Tabs.Panel
            key={i}
            value={i}
            // Every photo stays mounted and laid out (hidden from assistive tech and focus instead of
            // display: none), so the next one is already decoded when it's chosen.
            keepMounted
            render={(props, state) => <div {...props} hidden={undefined} aria-hidden={state.hidden || undefined} inert={state.hidden || undefined} />}
            data-pg-active={i === index || undefined}
            aria-label={`${i + 1} of ${count}: ${img.alt}`}
            className={cn(
              "col-start-1 row-start-1 outline-none",
              // Choosing a thumbnail: the new photo fades in over the old one and settles from a touch
              // larger; the old one stays solid underneath until it's covered, so the two never dip together.
              "group-data-[mode=fade]/pg:transition-[opacity,scale] group-data-[mode=fade]/pg:duration-300 ease-out-expo",
              "group-data-[mode=fade]/pg:data-pg-active:z-1",
              "group-data-[mode=fade]/pg:not-data-pg-active:scale-[1.04] group-data-[mode=fade]/pg:not-data-pg-active:opacity-0 group-data-[mode=fade]/pg:not-data-pg-active:delay-300 group-data-[mode=fade]/pg:not-data-pg-active:duration-0",
              // Swiping: the photos sit side by side in a strip that follows the finger.
              "group-data-[mode=track]/pg:translate-x-[calc(var(--pg-offset)*(100%+12px)+var(--pg-drag))]",
              "group-data-[mode=track]/pg:transition-[translate] group-data-[mode=track]/pg:duration-[380ms] group-data-[mode=track]/pg:ease-out-quart",
              "group-data-dragging/pg:transition-none! group-data-[via=key]/pg:transition-none!",
              "motion-reduce:scale-100! motion-reduce:transition-opacity",
            )}
            style={{ "--pg-offset": i - index } as React.CSSProperties}
          >
            <BlurUpImage
              src={img.src}
              placeholder={img.thumb}
              alt={img.alt}
              priority={i === defaultValue}
              aspectRatio={aspectRatio}
              className="size-full"
            />
          </Tabs.Panel>
        ))}

        {lens && (
          <div
            ref={lensEl}
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-10 size-[clamp(96px,38%,168px)] rounded-full bg-raised bg-no-repeat shadow-pop ring-2 ring-raised dark:ring-fg/80",
              "opacity-0 transition-[opacity,scale] duration-150 ease-out-expo [scale:0.85]",
              "group-data-dragging/pg:hidden data-[show]:opacity-100 data-[show]:[scale:1] motion-reduce:[scale:1]",
            )}
            data-show={lensOn || undefined}
            style={{ backgroundImage: `url("${active.zoomSrc ?? active.src}")` }}
          />
        )}

        {count > 1 && (
          <span aria-hidden className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 rounded-full bg-page/70 px-2 py-0.5 font-mono text-[11px] text-fg-2 backdrop-blur-sm tabular pointer-fine:hidden">
            {index + 1}/{count}
          </span>
        )}
      </div>

      {count > 1 && (
        <Tabs.List
          activateOnFocus
          aria-label={label}
          className={cn(
            "relative flex shrink-0 gap-2 p-1 [scrollbar-width:none]",
            vertical ? "max-h-full flex-col overflow-y-auto" : "-m-1 overflow-x-auto",
          )}
        >
          {images.map((img, i) => (
            <Tabs.Tab
              key={i}
              value={i}
              aria-label={`Image ${i + 1} of ${count}: ${img.alt}`}
              className={cn(
                "group/thumb relative size-14 shrink-0 overflow-hidden rounded-lg bg-hover sm:size-16",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[5px] focus-visible:outline-fg-3",
                "transition-[opacity,scale] duration-150 ease-out active:scale-[0.95] active:duration-75",
                "opacity-60 hover:opacity-90 data-active:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumb ?? img.src} alt="" draggable={false} loading="lazy" className="size-full object-cover" />
            </Tabs.Tab>
          ))}
          {/* One ring for the whole strip, sliding to the chosen thumbnail. */}
          <Tabs.Indicator
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-10 rounded-[10px]",
              "h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top)",
              "shadow-[0_0_0_2px_var(--frame),0_0_0_3.5px_var(--fg)]",
              "transition-[translate,width,height] duration-[260ms] ease-in-out-quart group-data-[via=key]/pg:transition-none motion-reduce:transition-none",
            )}
          />
        </Tabs.List>
      )}
    </Tabs.Root>
  );
}
