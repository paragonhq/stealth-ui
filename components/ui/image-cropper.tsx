"use client";
import { Slider } from "@base-ui/react/slider";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { animate, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ geometry */

/** A rectangle in the rotated image's own pixels. */
export type CropArea = { x: number; y: number; width: number; height: number };
export type CropRotation = 0 | 90 | 180 | 270;
export type CropAspect = { label: string; value: number | "free" };

type Rect = { x: number; y: number; w: number; h: number };
type View = { s: number; ox: number; oy: number };
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const PAD = 20; // air between the stage edge and the fitted image or crop
const MIN = 44; // smallest crop on screen, px

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The largest rect of `ratio` centered in w × h (or 90% of it for a free crop). */
function initialCrop(w: number, h: number, ratio: number | "free"): Rect {
  if (ratio === "free") return { x: w * 0.05, y: h * 0.05, w: w * 0.9, h: h * 0.9 };
  let cw = w;
  let ch = w / ratio;
  if (ch > h) {
    ch = h;
    cw = h * ratio;
  }
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

/** Re-fit an existing crop to a new ratio around its center, staying inside the image. */
function refit(c: Rect, W: number, H: number, ratio: number | "free"): Rect {
  if (ratio === "free") return c;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const area = c.w * c.h;
  let w = Math.sqrt(area * ratio);
  let h = w / ratio;
  const scale = Math.min(1, W / w, H / h);
  w *= scale;
  h *= scale;
  return { x: clamp(cx - w / 2, 0, W - w), y: clamp(cy - h / 2, 0, H - h), w, h };
}

/** CSS transform that draws the natural image into rotated space, before the view scale. */
function orient(r: CropRotation, nw: number, nh: number) {
  if (r === 90) return `translate(${nh}px, 0) rotate(90deg)`;
  if (r === 180) return `translate(${nw}px, ${nh}px) rotate(180deg)`;
  if (r === 270) return `translate(0, ${nw}px) rotate(270deg)`;
  return "";
}

/**
 * Draws the crop to a canvas and returns it as a Blob. `area` is in the rotated
 * image's pixels, exactly what the cropper reports. Remote images need CORS
 * (the cropper sets crossOrigin="anonymous").
 */
export async function cropImage(
  source: string | HTMLImageElement,
  area: CropArea,
  { rotation = 0, type = "image/jpeg", quality = 0.92, maxWidth }: { rotation?: CropRotation; type?: string; quality?: number; maxWidth?: number } = {},
): Promise<Blob> {
  const img =
    typeof source === "string"
      ? await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.crossOrigin = "anonymous";
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error("Couldn’t load the image"));
          i.src = source;
        })
      : source;
  const scale = maxWidth && area.width > maxWidth ? maxWidth / area.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn’t available");
  ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);
  ctx.translate(-area.x, -area.y);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  // Same mapping as the on-screen transform: natural pixels into rotated space.
  if (rotation === 90) ctx.transform(0, 1, -1, 0, nh, 0);
  else if (rotation === 180) ctx.transform(-1, 0, 0, -1, nw, nh);
  else if (rotation === 270) ctx.transform(0, -1, 1, 0, 0, nw);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t export the crop"))), type, quality));
}

/* ------------------------------------------------------------------ component */

export const defaultAspects: CropAspect[] = [
  { label: "Free", value: "free" },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
];

export type ImageCropperProps = Omit<React.ComponentProps<"div">, "children" | "onChange"> & {
  src: string;
  /** Describes the image for assistive tech. */
  alt?: string;
  aspects?: CropAspect[];
  /** The chosen preset's label. */
  aspect?: string;
  defaultAspect?: string;
  onAspectChange?: (label: string) => void;
  maxZoom?: number;
  /** Round mask for avatars. The area reported is still the square around it. */
  shape?: "rect" | "round";
  /** Stage height in px. The width follows the container. */
  height?: number;
  /** Called when a gesture ends (release, key up, preset, rotate) with the crop in rotated-image pixels. */
  onCropComplete?: (area: CropArea, rotation: CropRotation) => void;
};

export function ImageCropper({
  src,
  alt = "",
  aspects = defaultAspects,
  aspect: aspectProp,
  defaultAspect,
  onAspectChange,
  maxZoom = 4,
  shape = "rect",
  height = 320,
  onCropComplete,
  className,
  ...rest
}: ImageCropperProps) {
  const reduce = !!useReducedMotion();
  const hintId = useId();
  const [aspectLabel, setAspectLabel] = useControllableState({
    value: aspectProp,
    defaultValue: defaultAspect ?? (shape === "round" ? (aspects.find((a) => a.value === 1)?.label ?? aspects[0].label) : aspects[0].label),
    onChange: onAspectChange,
  });
  const ratio = shape === "round" ? 1 : (aspects.find((a) => a.label === aspectLabel)?.value ?? "free");

  const stageRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: height });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rotation, setRotation] = useState<CropRotation>(0);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [view, setView] = useState<View>({ s: 1, ox: 0, oy: 0 });
  const [gesture, setGesture] = useState<null | "move" | "resize" | "pan">(null);
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null);
  const [announce, setAnnounce] = useState("");
  const drag = useRef<{ kind: "move" | "resize" | "pan"; handle?: Handle; px: number; py: number; crop: Rect; view: View } | null>(null);
  const settleTimer = useRef<number>(undefined);
  const tween = useRef<{ stop: () => void } | null>(null);
  const keyTimer = useRef<number>(undefined);

  // Rotated image size.
  const W = natural ? (rotation % 180 ? natural.h : natural.w) : 0;
  const H = natural ? (rotation % 180 ? natural.w : natural.h) : 0;
  const fitScale = W && stage.w ? Math.min((stage.w - PAD * 2) / W, (stage.h - PAD * 2) / H) : 1;
  const zoom = view.s / fitScale;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(keyTimer.current);
      tween.current?.stop();
    },
    [],
  );

  /** A view that shows the whole rotated image, centered. */
  const fitView = useCallback((w: number, h: number): View => {
    const s = Math.min((stage.w - PAD * 2) / w, (stage.h - PAD * 2) / h);
    return { s, ox: (stage.w - w * s) / 2, oy: (stage.h - h * s) / 2 };
  }, [stage.w, stage.h]);

  const report = useCallback(
    (c: Rect | null, r: CropRotation) => {
      if (!c) return;
      onCropComplete?.({ x: Math.round(c.x), y: Math.round(c.y), width: Math.round(c.w), height: Math.round(c.h) }, r);
    },
    [onCropComplete],
  );
  // First layout, and again whenever the stage resizes: fit the image, keep the crop.
  const laidOut = useRef("");
  useEffect(() => {
    if (!natural || !stage.w) return;
    const key = `${stage.w}x${stage.h}`;
    if (laidOut.current === key) return;
    laidOut.current = key;
    const t = window.setTimeout(() => {
      setView(fitView(W, H));
      if (!crop) {
        const c = initialCrop(W, H, ratio);
        setCrop(c);
        report(c, rotation);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [natural, stage.w, stage.h, W, H, ratio, fitView, crop, report, rotation]);



  /** Tween the view (zoom and pan) on a spring; instant under reduced motion. */
  const glide = useCallback(
    (to: View) => {
      tween.current?.stop();
      if (reduce) return setView(to);
      const from = view;
      tween.current = animate(0, 1, {
        ...spring.soft,
        onUpdate: (t) => setView({ s: from.s + (to.s - from.s) * t, ox: from.ox + (to.ox - from.ox) * t, oy: from.oy + (to.oy - from.oy) * t }),
      });
    },
    [reduce, view],
  );

  /** Keep the crop on screen: pan the view the least amount needed. */
  const keepVisible = (v: View, c: Rect): View => {
    const left = v.ox + c.x * v.s;
    const top = v.oy + c.y * v.s;
    const right = left + c.w * v.s;
    const bottom = top + c.h * v.s;
    let dx = 0;
    let dy = 0;
    if (right - left > stage.w - PAD * 2) dx = stage.w / 2 - (left + right) / 2;
    else if (left < PAD) dx = PAD - left;
    else if (right > stage.w - PAD) dx = stage.w - PAD - right;
    if (bottom - top > stage.h - PAD * 2) dy = stage.h / 2 - (top + bottom) / 2;
    else if (top < PAD) dy = PAD - top;
    else if (bottom > stage.h - PAD) dy = stage.h - PAD - bottom;
    return { ...v, ox: v.ox + dx, oy: v.oy + dy };
  };

  /** Zoom around a screen point, never so far that the crop can't fit on the stage. */
  const zoomTo = (z: number, around?: { x: number; y: number }) => {
    if (!crop) return;
    const maxByCrop = Math.min((stage.w - PAD * 2) / crop.w, (stage.h - PAD * 2) / crop.h);
    const s = clamp(z * fitScale, fitScale, Math.min(maxZoom * fitScale, maxByCrop));
    const p = around ?? { x: view.ox + (crop.x + crop.w / 2) * view.s, y: view.oy + (crop.y + crop.h / 2) * view.s };
    const ix = (p.x - view.ox) / view.s;
    const iy = (p.y - view.oy) / view.s;
    tween.current?.stop();
    setView(keepVisible({ s, ox: p.x - ix * s, oy: p.y - iy * s }, crop));
  };
  const zoomCap = crop && stage.w ? Math.max(1, Math.min(maxZoom, Math.min((stage.w - PAD * 2) / crop.w, (stage.h - PAD * 2) / crop.h) / fitScale)) : maxZoom;

  /* ---------------------------------------------------------------- aspect, rotate, reset */

  const chooseAspect = (label: string) => {
    const next = aspects.find((a) => a.label === label);
    if (!next || !crop) return;
    setAspectLabel(label);
    const c = refit(crop, W, H, next.value);
    setCrop(c);
    glide(fitView(W, H));
    report(c, rotation);
  };

  const rotate = () => {
    if (!natural || !crop) return;
    // Counter-clockwise, like every photo tool: the crop rotates with the picture.
    const next = (((rotation - 90) % 360) + 360) % 360 as CropRotation;
    const nW = H;
    const nH = W;
    let c: Rect = { x: crop.y, y: W - (crop.x + crop.w), w: crop.h, h: crop.w };
    if (ratio !== "free") c = refit(c, nW, nH, ratio);
    const to = fitView(nW, nH);
    const k = view.s / to.s;
    tween.current?.stop();
    setRotation(next);
    setCrop(c);
    setView(to);
    report(c, next);
    setAnnounce(`Rotated to ${next} degrees`);
    // FLIP: start the new layout turned back 90° at the old size, then let it settle.
    const el = flipRef.current;
    if (el && !reduce) animate(el, { rotate: [90, 0], scale: [k, 1] }, spring.soft);
  };

  const reset = () => {
    if (!natural) return;
    const c = initialCrop(natural.w, natural.h, ratio);
    setRotation(0);
    setCrop(c);
    glide(fitView(natural.w, natural.h));
    report(c, 0);
  };

  const dirty = !!crop && !!natural && (rotation !== 0 || Math.abs(zoom - 1) > 0.01 || JSON.stringify(roundRect(crop)) !== JSON.stringify(roundRect(initialCrop(W, H, ratio))));

  /* ---------------------------------------------------------------- pointer */

  const onDown = (e: React.PointerEvent, kind: "move" | "resize" | "pan", handle?: Handle) => {
    if (!crop || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    window.clearTimeout(settleTimer.current);
    tween.current?.stop();
    drag.current = { kind, handle, px: e.clientX, py: e.clientY, crop, view };
    setGesture(kind);
    setActiveHandle(handle ?? null);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / d.view.s;
    const dy = (e.clientY - d.py) / d.view.s;
    if (d.kind === "pan") {
      setView(keepVisible({ ...d.view, ox: d.view.ox + (e.clientX - d.px), oy: d.view.oy + (e.clientY - d.py) }, d.crop));
      return;
    }
    if (d.kind === "move") {
      setCrop({ ...d.crop, x: clamp(d.crop.x + dx, 0, W - d.crop.w), y: clamp(d.crop.y + dy, 0, H - d.crop.h) });
      return;
    }
    setCrop(resize(d.crop, d.handle!, dx, dy, W, H, ratio, MIN / d.view.s));
  };

  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGesture(null);
    setActiveHandle(null);
    report(crop, rotation);
    if (d.kind === "resize" && crop) {
      // After a resize settles, bring the crop back to the middle at a comfortable size.
      const c = crop;
      settleTimer.current = window.setTimeout(() => {
        const s = clamp(Math.min((stage.w - PAD * 4) / c.w, (stage.h - PAD * 4) / c.h), fitScale, fitScale * maxZoom);
        glide({ s, ox: stage.w / 2 - (c.x + c.w / 2) * s, oy: stage.h / 2 - (c.y + c.h / 2) * s });
      }, 450);
    }
  };

  /* ---------------------------------------------------------------- keyboard */

  const onKey = (e: React.KeyboardEvent) => {
    if (!crop) return;
    const step = (e.shiftKey ? 10 : 1) / view.s; // 1 or 10 screen pixels
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    let c: Rect | null = null;
    if (dir && e.altKey) c = resize(crop, "se", dir[0] * step, dir[1] * step, W, H, ratio, MIN / view.s);
    else if (dir) c = { ...crop, x: clamp(crop.x + dir[0] * step, 0, W - crop.w), y: clamp(crop.y + dir[1] * step, 0, H - crop.h) };
    else if (e.key === "+" || e.key === "=") return (e.preventDefault(), zoomTo(zoom * 1.2));
    else if (e.key === "-") return (e.preventDefault(), zoomTo(zoom / 1.2));
    else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) return (e.preventDefault(), rotate());
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    setCrop(c);
    setView(keepVisible(view, c));
    const done = c;
    window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => {
      report(done, rotation);
      setAnnounce(`Crop ${Math.round(done.w)} by ${Math.round(done.h)} pixels, at ${Math.round(done.x)}, ${Math.round(done.y)}`);
    }, 400);
  };

  /* ---------------------------------------------------------------- render */

  const box = crop ? { left: view.ox + crop.x * view.s, top: view.oy + crop.y * view.s, width: crop.w * view.s, height: crop.h * view.s } : null;
  const handles: Handle[] = ratio === "free" ? ["nw", "n", "ne", "e", "se", "s", "sw", "w"] : ["nw", "ne", "se", "sw"];
  const size = crop ? `${Math.round(crop.w)} × ${Math.round(crop.h)}` : "";
  const aspectOptions = shape === "round" ? [] : aspects;

  return (
    <div data-state={status} className={cn("flex w-full min-w-0 flex-col gap-2.5", className)} {...rest}>
      {/* The stage is dark in both themes: judging a crop needs the picture, not the page, to be brightest. */}
      <div
        ref={stageRef}
        data-theme="dark"
        data-gesture={gesture ?? undefined}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-page ring-1 ring-line"
        style={{ height }}
        onPointerDown={(e) => onDown(e, "pan")}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => {
          if (!crop || !(e.ctrlKey || e.metaKey)) return;
          // Pinch on a trackpad arrives as ctrl+wheel: zoom around the fingers.
          const r = e.currentTarget.getBoundingClientRect();
          zoomTo(zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
        }}
      >
        <div ref={flipRef} className={cn("absolute inset-0 transition-opacity duration-200", status === "ready" && crop ? "opacity-100" : "opacity-0")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the natural size and CORS pixels are needed for the crop */}
          <img
            src={src}
            alt={alt}
            crossOrigin="anonymous"
            draggable={false}
            ref={(i) => {
              // A cached image can finish before hydration, and then onLoad never fires.
              if (i?.complete && !natural) {
                if (i.naturalWidth) {
                  setNatural({ w: i.naturalWidth, h: i.naturalHeight });
                  setStatus("ready");
                } else setStatus("error");
              }
            }}
            onLoad={(e) => {
              const i = e.currentTarget;
              setNatural({ w: i.naturalWidth, h: i.naturalHeight });
              setStatus("ready");
            }}
            onError={() => setStatus("error")}
            className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
            style={natural ? { width: natural.w, height: natural.h, transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.s}) ${orient(rotation, natural.w, natural.h)}` } : { opacity: 0 }}
          />
          {box && (
            <div
              role="group"
              tabIndex={0}
              aria-roledescription="crop area"
              aria-label={`Crop area, ${size} pixels`}
              aria-describedby={hintId}
              onKeyDown={onKey}
              onPointerDown={(e) => onDown(e, "move")}
              data-dragging={gesture === "move" || gesture === "resize" ? "" : undefined}
              className={cn(
                "group/crop absolute cursor-move outline-none",
                // Everything outside the crop is dimmed by one huge spread shadow.
                "shadow-[0_0_0_9999px_var(--overlay)] transition-[box-shadow] duration-200",
                "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-fg-2",
                shape === "round" ? "rounded-full" : "ring-1 ring-fg/80",
              )}
              style={box}
            >
              {shape === "round" && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-fg/80" />}
              {/* Thirds, only while you're adjusting: a guide for the gesture, not decoration at rest. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-300 group-data-dragging/crop:opacity-100 group-data-dragging/crop:duration-100",
                  shape === "round" && "rounded-full",
                  "opacity-0",
                )}
              >
                <span className="absolute inset-y-0 left-1/3 w-px bg-fg/40" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-fg/40" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-fg/40" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-fg/40" />
              </span>
              {handles.map((h) => (
                <HandleGrip key={h} handle={h} active={activeHandle === h} onPointerDown={(e) => onDown(e, "resize", h)} />
              ))}
              {/* Live size while adjusting. */}
              <span
                aria-hidden
                className={cn(
                  "tabular pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-page/80 px-1.5 py-0.5 font-mono text-[11px] text-fg",
                  "transition-opacity duration-150",
                  gesture === "resize" ? "opacity-100" : "opacity-0",
                )}
              >
                {size}
              </span>
            </div>
          )}
        </div>

        {status === "loading" && (
          <div aria-hidden className="absolute inset-5 grid place-items-center rounded-lg bg-hover animate-pulse-soft motion-reduce:animate-none">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="text-fg-4">
              <rect x="2.5" y="3" width="11" height="10" rx="1.75" />
              <circle cx="6" cy="6.5" r="1.1" />
              <path d="m2.75 11.5 3.4-3 2.4 2 1.6-1.4 3.1 2.6" />
            </svg>
          </div>
        )}
        {status === "error" && (
          <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-1">
              <p className="text-[13px] font-medium text-fg">Couldn’t load this image</p>
              <p className="text-[12px] text-fg-3">Check the file or your connection, then choose it again.</p>
            </div>
          </div>
        )}
      </div>

      <p id={hintId} className="sr-only">
        Arrow keys move the crop, Shift moves further, Option or Alt with arrows resizes. Plus and minus zoom, R rotates.
      </p>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {aspectOptions.length > 1 && (
          <AspectPicker options={aspectOptions} value={aspectLabel} onChange={chooseAspect} disabled={status !== "ready"} reduce={reduce} />
        )}
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <ToolButton label="Zoom out" onClick={() => zoomTo(zoom / 1.25)} disabled={status !== "ready" || zoom <= 1.001}>
            <path d="M4 8h8" />
          </ToolButton>
          <Slider.Root
            value={Math.min(zoom, zoomCap)}
            min={1}
            max={Math.max(zoomCap, 1.0001)}
            step={0.01}
            disabled={status !== "ready" || zoomCap <= 1.001}
            onValueChange={(v) => zoomTo(v)}
            className="w-24 sm:w-28"
          >
            <Slider.Control className="flex h-8 w-full touch-none items-center data-disabled:opacity-50">
              <Slider.Track className="relative h-[3px] w-full rounded-full bg-fg/15">
                <Slider.Indicator className="rounded-full bg-fg" />
                <Slider.Thumb
                  aria-label="Zoom"
                  getAriaValueText={(_, v) => `${Math.round(v * 100)}%`}
                  className={cn(
                    "size-3.5 rounded-full border border-line-2 bg-raised shadow-[var(--shadow)] transition-[scale] duration-150 ease-out-quart data-dragging:scale-110 motion-reduce:transition-none",
                    "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg-3",
                  )}
                />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
          <ToolButton label="Zoom in" onClick={() => zoomTo(zoom * 1.25)} disabled={status !== "ready" || zoom >= zoomCap - 0.001}>
            <path d="M4 8h8M8 4v8" />
          </ToolButton>
          <span aria-hidden className="mx-1 h-4 w-px bg-line-2" />
          <ToolButton label="Rotate left" shortcut="R" onClick={rotate} disabled={status !== "ready"}>
            <path d="M3.5 6.5h6.25a2.75 2.75 0 0 1 2.75 2.75v3.25" />
            <path d="M5.75 4.25 3.5 6.5l2.25 2.25" />
          </ToolButton>
          <ToolButton label="Reset crop" onClick={reset} disabled={!dirty}>
            <path d="M3 8a5 5 0 1 0 1.5-3.55M3 2.75V5h2.25" />
          </ToolButton>
        </div>
      </div>
    </div>
  );
}

const roundRect = (r: Rect) => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)];

/** Drag a handle: the opposite edge or corner stays put; a locked ratio is kept from the longer pull. */
function resize(c: Rect, h: Handle, dx: number, dy: number, W: number, H: number, ratio: number | "free", min: number): Rect {
  let { x, y, w, h: ht } = c;
  const east = h.includes("e");
  const west = h.includes("w");
  const north = h.includes("n");
  const south = h.includes("s");
  if (ratio === "free") {
    if (east) w = clamp(c.w + dx, min, W - c.x);
    if (west) {
      const nx = clamp(c.x + dx, 0, c.x + c.w - min);
      w = c.w + (c.x - nx);
      x = nx;
    }
    if (south) ht = clamp(c.h + dy, min, H - c.y);
    if (north) {
      const ny = clamp(c.y + dy, 0, c.y + c.h - min);
      ht = c.h + (c.y - ny);
      y = ny;
    }
    return { x, y, w, h: ht };
  }
  const ax = east ? c.x : c.x + c.w; // anchor
  const ay = south ? c.y : c.y + c.h;
  const pullW = c.w + (east ? dx : -dx);
  const pullH = c.h + (south ? dy : -dy);
  let nw = Math.max(pullW, pullH * ratio);
  const maxW = Math.min(east ? W - ax : ax, (south ? H - ay : ay) * ratio);
  nw = clamp(nw, Math.max(min, min * ratio), maxW);
  const nh = nw / ratio;
  return { x: east ? ax : ax - nw, y: south ? ay : ay - nh, w: nw, h: nh };
}

const CURSOR: Record<Handle, string> = { n: "cursor-ns-resize", s: "cursor-ns-resize", e: "cursor-ew-resize", w: "cursor-ew-resize", ne: "cursor-nesw-resize", sw: "cursor-nesw-resize", nw: "cursor-nwse-resize", se: "cursor-nwse-resize" };

function HandleGrip({ handle, active, onPointerDown }: { handle: Handle; active: boolean; onPointerDown: (e: React.PointerEvent) => void }) {
  const corner = handle.length === 2;
  const pos: Record<Handle, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  };
  // Corners are L-shaped brackets that hug the frame; edges are short bars.
  // Each bracket starts on the handle's center (the crop corner) and hugs the frame line.
  const bracket: Record<string, string> = {
    nw: "left-[calc(50%-1.5px)] top-[calc(50%-1.5px)] border-l-[3px] border-t-[3px] rounded-tl-[3px]",
    ne: "right-[calc(50%-1.5px)] top-[calc(50%-1.5px)] border-r-[3px] border-t-[3px] rounded-tr-[3px]",
    se: "right-[calc(50%-1.5px)] bottom-[calc(50%-1.5px)] border-r-[3px] border-b-[3px] rounded-br-[3px]",
    sw: "left-[calc(50%-1.5px)] bottom-[calc(50%-1.5px)] border-l-[3px] border-b-[3px] rounded-bl-[3px]",
  };
  return (
    <span
      aria-hidden
      data-active={active ? "" : undefined}
      onPointerDown={onPointerDown}
      className={cn("group/handle absolute z-10 size-6 pointer-coarse:size-11", pos[handle], CURSOR[handle])}
    >
      {corner ? (
        <span
          className={cn(
            "absolute size-4 border-fg transition-[scale] duration-150 ease-out-quart group-hover/handle:scale-110 group-data-active/handle:scale-125 motion-reduce:transition-none",
            bracket[handle],
          )}
          // Grow from the corner itself, so the bracket stretches along the frame rather than drifting.
          style={{ transformOrigin: `${handle.includes("w") ? "left" : "right"} ${handle.includes("n") ? "top" : "bottom"}` }}
        />
      ) : (
        <span
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg transition-[scale] duration-150 ease-out-quart group-hover/handle:scale-110 group-data-active/handle:scale-125 motion-reduce:transition-none",
            handle === "n" || handle === "s" ? "h-[3px] w-4" : "h-4 w-[3px]",
          )}
        />
      )}
    </span>
  );
}

function AspectPicker({ options, value, onChange, disabled, reduce }: { options: CropAspect[]; value: string; onChange: (v: string) => void; disabled: boolean; reduce: boolean }) {
  const layoutId = useId();
  return (
    <ToggleGroup
      aria-label="Aspect ratio"
      value={[value]}
      onValueChange={(v) => {
        if (v[0]) onChange(v[0]);
      }}
      disabled={disabled}
      className="relative flex h-8 items-center rounded-lg border border-line bg-raised p-0.5 shadow-[var(--shadow)] data-disabled:opacity-50"
    >
      {options.map((o) => (
        <Toggle
          key={o.label}
          value={o.label}
          className={cn(
            "relative h-full rounded-md px-2.5 font-mono text-[11.5px] text-fg-3 outline-none",
            "transition-[color,scale] duration-150 ease-out-quart hover:text-fg active:scale-[0.96] data-pressed:text-fg",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          )}
        >
          {o.label === value && (
            // One pill slides between presets.
            <motion.span layoutId={layoutId} aria-hidden className="absolute inset-0 rounded-md bg-hover ring-1 ring-line-2" transition={reduce ? { duration: 0 } : spring.snappy} />
          )}
          <span className="relative">{o.label}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

function ToolButton({ label, shortcut, onClick, disabled, children }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-lg text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-40",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
