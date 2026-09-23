"use client";
import { Avatar } from "@base-ui/react/avatar";
import { Dialog } from "@base-ui/react/dialog";
import { Slider } from "@base-ui/react/slider";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** "Dana Whitfield" → "DW", "cher" → "C". */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const formatBytes = (b: number) => (b >= 1024 * 1024 ? `${Math.round(b / 1024 / 1024)}\u00a0MB` : `${Math.round(b / 1024)}\u00a0KB`);

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type AvatarUploader = (blob: Blob, ctx: { signal: AbortSignal; onProgress: (fraction: number) => void }) => Promise<string | void>;

/** Draws the chosen circle of the image into a square canvas and encodes it. */
async function renderCrop(img: HTMLImageElement, crop: Crop, frame: number, output: number) {
  const s = baseScale(img, frame) * crop.z;
  const side = frame / s;
  const sx = img.naturalWidth / 2 + (-frame / 2 - crop.x) / s;
  const sy = img.naturalHeight / 2 + (-frame / 2 - crop.y) / s;
  const canvas = document.createElement("canvas");
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, output, output);
  // WebP where the browser can encode it; the browser falls back to PNG where it can't.
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/webp", 0.9));
}

type Crop = { x: number; y: number; z: number };
const baseScale = (img: { naturalWidth: number; naturalHeight: number }, frame: number) => frame / Math.min(img.naturalWidth, img.naturalHeight);

// The image always covers the circle: never a sliver of background inside the crop.
function clamp(c: Crop, img: { naturalWidth: number; naturalHeight: number }, frame: number, maxZoom: number): Crop {
  const z = Math.min(maxZoom, Math.max(1, c.z));
  const s = baseScale(img, frame) * z;
  const mx = Math.max(0, (img.naturalWidth * s - frame) / 2);
  const my = Math.max(0, (img.naturalHeight * s - frame) / 2);
  return { z, x: Math.min(mx, Math.max(-mx, c.x)), y: Math.min(my, Math.max(-my, c.y)) };
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

export type AvatarUploadProps = Omit<React.ComponentProps<"div">, "defaultValue"> & {
  /** Used for the initials fallback and the image's alt text. */
  name: string;
  /** The photo URL, or null for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (url: string | null) => void;
  /** Sends the cropped image. Resolve with the stored URL, or nothing to keep the local preview. Report progress as 0–1. */
  upload?: AvatarUploader;
  /** Called with the cropped image before it uploads. */
  onCrop?: (blob: Blob) => void;
  size?: "md" | "lg";
  /** Title beside the avatar. */
  label?: string;
  /** Line under the title at rest. */
  hint?: React.ReactNode;
  /** Show the title, status line and buttons beside the avatar. Off leaves just the avatar. */
  details?: boolean;
  /** Largest file accepted before cropping, in bytes. */
  maxSize?: number;
  /** Smallest side, in pixels, for a photo to look sharp. */
  minDimension?: number;
  /** Side of the square image that's produced, in pixels. */
  outputSize?: number;
  disabled?: boolean;
  /** Where the crop dialog renders. Pass a positioned element to keep it inside a region instead of the viewport. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
};

type Phase =
  { kind: "idle" } | { kind: "uploading"; progress: number } | { kind: "done" } | { kind: "error"; message: string; retry?: Blob } | { kind: "removed"; previous: string };

export function AvatarUpload({
  name,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  upload,
  onCrop,
  size = "md",
  label = "Profile photo",
  hint,
  details = true,
  maxSize = 10 * 1024 * 1024,
  minDimension = 256,
  outputSize = 512,
  disabled = false,
  container,
  className,
  ...rest
}: AvatarUploadProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const [value, setValue] = useControllableState<string | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // The cropped image stays on screen after upload for as long as the value is the URL it became,
  // so a remote URL never flashes the initials while it loads.
  const [preview, setPreview] = useState<{ url: string; for?: string | null } | null>(null);
  const [source, setSource] = useState<{ url: string; img: HTMLImageElement; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timer = useRef<number>(undefined);
  const urls = useRef(new Set<string>());
  const previewRef = useRef<string | null>(null);

  // Every object URL made here is revoked on unmount.
  useEffect(() => {
    const set = urls.current;
    return () => {
      window.clearTimeout(timer.current);
      abortRef.current?.abort();
      set.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  const makeUrl = (b: Blob) => {
    const u = URL.createObjectURL(b);
    urls.current.add(u);
    return u;
  };
  const dropUrl = (u: string | null) => {
    if (u && urls.current.has(u)) {
      URL.revokeObjectURL(u);
      urls.current.delete(u);
    }
  };

  const shown = phase.kind === "uploading" ? (preview?.url ?? value) : preview && preview.for === value ? preview.url : value;
  const uploading = phase.kind === "uploading";

  const choose = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      window.clearTimeout(timer.current);
      if (!ACCEPT.includes(file.type)) {
        setPhase({ kind: "error", message: `${file.name} isn’t supported. Use PNG, JPG or WebP.` });
        return;
      }
      if (file.size > maxSize) {
        setPhase({ kind: "error", message: `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(maxSize)}.` });
        return;
      }
      const url = makeUrl(file);
      const img = new Image();
      img.onload = () => {
        if (Math.min(img.naturalWidth, img.naturalHeight) < minDimension) {
          dropUrl(url);
          setPhase({ kind: "error", message: `That image is ${img.naturalWidth} × ${img.naturalHeight} px. Use one at least ${minDimension}\u00a0px on each side.` });
          return;
        }
        setPhase({ kind: "idle" });
        setSource({ url, img, name: file.name });
      };
      img.onerror = () => {
        dropUrl(url);
        setPhase({ kind: "error", message: "Couldn’t read that image. Try another file." });
      };
      img.src = url;
    },
    [maxSize, minDimension],
  );

  const send = useCallback(
    async (blob: Blob) => {
      const local = makeUrl(blob);
      if (previewRef.current !== value) dropUrl(previewRef.current);
      previewRef.current = local;
      setPreview({ url: local });
      if (!upload) {
        setValue(local);
        setPreview({ url: local, for: local });
        setPhase({ kind: "done" });
        timer.current = window.setTimeout(() => setPhase({ kind: "idle" }), 1600);
        return;
      }
      const c = new AbortController();
      abortRef.current = c;
      setPhase({ kind: "uploading", progress: 0 });
      try {
        const url = await upload(blob, { signal: c.signal, onProgress: (p) => !c.signal.aborted && setPhase({ kind: "uploading", progress: Math.max(0, Math.min(1, p)) }) });
        if (c.signal.aborted) return;
        setPhase({ kind: "uploading", progress: 1 });
        setValue(url || local);
        setPreview({ url: local, for: url || local });
        // Let the ring close before it fades and the tick appears.
        timer.current = window.setTimeout(() => {
          setPhase({ kind: "done" });
          timer.current = window.setTimeout(() => setPhase({ kind: "idle" }), 1600);
        }, 320);
      } catch {
        if (c.signal.aborted) return;
        setPhase({ kind: "error", message: "Couldn’t upload your photo.", retry: blob });
      }
    },
    [upload, setValue, value],
  );

  const cancel = () => {
    abortRef.current?.abort();
    setPhase({ kind: "idle" });
    if (previewRef.current !== value) dropUrl(previewRef.current);
    previewRef.current = null;
    setPreview(null);
  };

  const remove = () => {
    if (!value) return;
    window.clearTimeout(timer.current);
    const previous = value;
    setValue(null);
    // Undo instead of a confirm: the photo comes back with one press for a few seconds.
    setPhase({ kind: "removed", previous });
    timer.current = window.setTimeout(() => setPhase({ kind: "idle" }), 6000);
    buttonRef.current?.focus();
  };

  const undo = () => {
    if (phase.kind !== "removed") return;
    window.clearTimeout(timer.current);
    setValue(phase.previous);
    setPhase({ kind: "idle" });
  };

  const md = size === "md";
  const px = md ? 64 : 96;
  const initials = initialsOf(name);
  const statusId = `${id}-status`;
  const ringR = px / 2 + 4;
  const ringBox = px + 12;
  const progress = phase.kind === "uploading" ? phase.progress : 0;

  const status: React.ReactNode =
    phase.kind === "error" ? (
      <span className="text-danger text-pretty">{phase.message}</span>
    ) : phase.kind === "uploading" ? (
      <span className="tabular">
        Uploading · <NumberFlow value={Math.round(progress * 100)} suffix="%" />
      </span>
    ) : phase.kind === "done" ? (
      <span>Photo updated</span>
    ) : phase.kind === "removed" ? (
      <span>Photo removed</span>
    ) : (
      <span>{hint ?? `PNG, JPG or WebP, at least ${minDimension}\u00a0px`}</span>
    );

  return (
    <div
      data-slot="avatar-upload"
      data-state={phase.kind}
      data-size={size}
      data-disabled={disabled || undefined}
      className={cn("flex min-w-0 items-center gap-4", disabled && "opacity-50", className)}
      {...rest}
    >
      <div className="relative shrink-0" style={{ width: px, height: px }}>
        {/* The upload ring: it draws around the avatar as bytes go up, then closes and fades. */}
        <svg
          aria-hidden
          width={ringBox}
          height={ringBox}
          viewBox={`0 0 ${ringBox} ${ringBox}`}
          className={cn(
            "pointer-events-none absolute -left-1.5 -top-1.5 -rotate-90 transition-[opacity,scale] duration-300 ease-out-expo",
            uploading || (phase.kind === "error" && phase.retry) ? "scale-100 opacity-100" : "scale-[1.06] opacity-0",
          )}
        >
          <circle cx={ringBox / 2} cy={ringBox / 2} r={ringR} fill="none" strokeWidth="2" className="stroke-fg/10" />
          <circle
            cx={ringBox / 2}
            cy={ringBox / 2}
            r={ringR}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            className={cn("transition-[stroke-dashoffset,stroke] duration-300 ease-out", phase.kind === "error" ? "stroke-danger" : "stroke-fg")}
            style={{ strokeDashoffset: 1 - (phase.kind === "error" ? 1 : progress) }}
          />
        </svg>

        <button
          ref={buttonRef}
          type="button"
          disabled={disabled || uploading}
          aria-label={value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          aria-describedby={details ? statusId : undefined}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            if (disabled || uploading || !Array.from(e.dataTransfer.types).includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (disabled || uploading) return;
            e.preventDefault();
            setDragOver(false);
            choose(e.dataTransfer.files[0]);
          }}
          data-drag={dragOver || undefined}
          className={cn(
            "group/avatar relative block size-full cursor-pointer overflow-hidden rounded-full select-none",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-fg-3",
            "transition-[scale] duration-150 ease-out active:scale-[0.96] disabled:cursor-default disabled:active:scale-100",
          )}
        >
          <Avatar.Root className={cn("grid size-full place-items-center rounded-full bg-hover text-fg-2 ring-1 ring-inset ring-line-2", md ? "text-[20px]" : "text-[30px]")}>
            {shown && (
              <Avatar.Image
                key={shown}
                src={shown}
                alt={name}
                className={cn(
                  "col-start-1 row-start-1 size-full object-cover transition-[opacity,filter] duration-300 ease-out",
                  "data-starting-style:opacity-0",
                  uploading && "opacity-70",
                )}
              />
            )}
            <Avatar.Fallback className="col-start-1 row-start-1 font-medium tracking-[0.01em]">{initials || <PersonGlyph size={md ? 26 : 38} />}</Avatar.Fallback>
          </Avatar.Root>

          {/* Hover (and a file dragged over) reveals the change overlay. Touch uses the badge instead. */}
          <span
            aria-hidden
            className={cn(
              // A dark scrim with light text in both themes: it sits on a photo, not on the page.
              "absolute inset-0 grid place-items-center rounded-full bg-fg/50 text-frame opacity-0 backdrop-blur-[2px] transition-opacity duration-150 dark:bg-overlay dark:text-fg",
              "group-hover/avatar:opacity-100 group-data-drag/avatar:opacity-100 group-disabled/avatar:opacity-0",
            )}
          >
            <span className="flex flex-col items-center gap-0.5 text-[11px] font-medium transition-transform duration-200 ease-out-expo group-hover/avatar:-translate-y-px">
              <CameraGlyph size={md ? 16 : 20} />
              {!md && <span>{dragOver ? "Drop" : "Change"}</span>}
            </span>
          </span>
        </button>

        {/* The badge: a camera at rest (the affordance on touch), a tick once the new photo is in. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute grid place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)]",
            md ? "-bottom-0.5 -right-0.5 size-6" : "bottom-0.5 right-0.5 size-7",
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={phase.kind === "done" ? "done" : "camera"}
              className={cn("grid place-items-center", phase.kind === "done" && "text-success")}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            >
              {phase.kind === "done" ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.06 }}
                  />
                </svg>
              ) : (
                <CameraGlyph size={md ? 12 : 14} />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      {details && (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">{label}</span>
            <span id={statusId} className="grid min-h-[18px] text-[12px] leading-[18px] text-fg-3">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={phase.kind === "error" ? `e-${phase.message}` : phase.kind}
                  className="col-start-1 row-start-1"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.2, ease: ease.out }}
                >
                  {status}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {uploading ? (
              <Btn onClick={cancel}>Cancel</Btn>
            ) : phase.kind === "error" && phase.retry ? (
              <>
                <Btn variant="secondary" onClick={() => phase.retry && send(phase.retry)}>
                  Try again
                </Btn>
                <Btn onClick={cancel}>Cancel</Btn>
              </>
            ) : (
              <>
                <Btn variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
                  {value ? "Change photo" : "Upload photo"}
                </Btn>
                {phase.kind === "removed" ? (
                  <Btn onClick={undo}>Undo</Btn>
                ) : (
                  value && (
                    <Btn disabled={disabled} onClick={remove}>
                      Remove
                    </Btn>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          choose(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <span role="status" aria-live="polite" className="sr-only">
        {phase.kind === "done" ? "Photo updated" : phase.kind === "error" ? phase.message : phase.kind === "removed" ? "Photo removed. Undo is available." : ""}
      </span>

      <CropDialog
        source={source}
        container={container}
        outputSize={outputSize}
        onCancel={() => {
          dropUrl(source?.url ?? null);
          setSource(null);
        }}
        onSave={async (blob) => {
          dropUrl(source?.url ?? null);
          setSource(null);
          onCrop?.(blob);
          await send(blob);
        }}
        finalFocus={buttonRef}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The crop dialog                                                     */
/* ------------------------------------------------------------------ */

const FRAME = 200; // the crop circle
const PAD = 20; // context shown around it
const MAX_ZOOM = 4;

function CropDialog({
  source,
  container,
  outputSize,
  onCancel,
  onSave,
  finalFocus,
}: {
  source: { url: string; img: HTMLImageElement; name: string } | null;
  container: AvatarUploadProps["container"];
  outputSize: number;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
  finalFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, z: 1 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [glide, setGlide] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; z: number } | null>(null);
  const inline = !!container;

  // A new image starts centered at 1×; adjusted while rendering, not in an effect.
  if (source && shownFor !== source.url) {
    setShownFor(source.url);
    setCrop({ x: 0, y: 0, z: 1 });
    setSaving(false);
  }

  const img = source?.img;
  const apply = useCallback((next: Crop) => img && setCrop(clamp(next, img, FRAME, MAX_ZOOM)), [img]);

  // Zoom around a point (relative to the circle's center) so what's under the cursor stays put.
  const zoomAt = useCallback(
    (z: number, fx = 0, fy = 0) => {
      setCrop((c) => {
        if (!img) return c;
        const nz = Math.min(MAX_ZOOM, Math.max(1, z));
        const k = nz / c.z;
        return clamp({ z: nz, x: fx - (fx - c.x) * k, y: fy - (fy - c.y) * k }, img, FRAME, MAX_ZOOM);
      });
    },
    [img],
  );

  // Wheel and trackpad pinch zoom. Needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = viewRef.current;
    if (!el || !img) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const fx = e.clientX - r.left - r.width / 2;
      const fy = e.clientY - r.top - r.height / 2;
      setCrop((c) => {
        const nz = Math.min(MAX_ZOOM, Math.max(1, c.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
        const k = nz / c.z;
        return clamp({ z: nz, x: fx - (fx - c.x) * k, y: fy - (fy - c.y) * k }, img, FRAME, MAX_ZOOM);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img, source]);

  const s = img ? baseScale(img, FRAME) : 1;
  const w = img ? img.naturalWidth * s : FRAME;
  const h = img ? img.naturalHeight * s : FRAME;

  const box = FRAME + PAD * 2;

  return (
    <Dialog.Root
      open={!!source}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Backdrop
          className={cn(
            inline ? "absolute rounded-2xl" : "fixed",
            "inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0",
          )}
        />
        <Dialog.Popup
          ref={popupRef}
          // Focus lands on the dialog itself; one Tab reaches the crop area, so a pointer user never sees a ring on open.
          initialFocus={popupRef}
          finalFocus={finalFocus}
          className={cn(
            inline ? "absolute" : "fixed",
            "left-1/2 top-1/2 z-(--z-dialog) flex w-[min(320px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-line-2 bg-raised p-4 text-fg shadow-pop outline-none",
            "transition-[opacity,scale] duration-[220ms] ease-out-expo data-starting-style:scale-[0.96] data-starting-style:opacity-0",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150",
          )}
        >
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-[14px] font-medium tracking-[-0.015em]">Crop photo</Dialog.Title>
            <Dialog.Description className="text-[12.5px] text-fg-3">
              <span className="pointer-coarse:hidden">Drag to reposition. Scroll to zoom.</span>
              <span className="hidden pointer-coarse:inline">Drag to reposition. Pinch to zoom.</span>
            </Dialog.Description>
          </div>

          <div
            ref={viewRef}
            tabIndex={0}
            role="group"
            aria-roledescription="crop area"
            aria-label="Photo position. Arrow keys move it, plus and minus zoom, 0 resets."
            data-dragging={dragging || undefined}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()];
                pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: crop.z };
              }
              setDragging(true);
              setGlide(false);
            }}
            onPointerMove={(e) => {
              const prev = pointers.current.get(e.pointerId);
              if (!prev) return;
              const next = { x: e.clientX, y: e.clientY };
              pointers.current.set(e.pointerId, next);
              if (pointers.current.size === 2 && pinch.current) {
                const [a, b] = [...pointers.current.values()];
                zoomAt((pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist);
              } else {
                // Moves 1:1 with the finger; no easing, or it feels like dragging through syrup.
                setCrop((c) => (img ? clamp({ ...c, x: c.x + next.x - prev.x, y: c.y + next.y - prev.y }, img, FRAME, MAX_ZOOM) : c));
              }
            }}
            onPointerUp={(e) => {
              pointers.current.delete(e.pointerId);
              if (pointers.current.size < 2) pinch.current = null;
              if (!pointers.current.size) setDragging(false);
            }}
            onPointerCancel={(e) => {
              pointers.current.delete(e.pointerId);
              pinch.current = null;
              if (!pointers.current.size) setDragging(false);
            }}
            onKeyDown={(e) => {
              setGlide(false);
              const step = e.shiftKey ? 24 : 6;
              const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              if (moves[e.key]) {
                e.preventDefault();
                apply({ ...crop, x: crop.x + moves[e.key][0], y: crop.y + moves[e.key][1] });
              } else if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                zoomAt(crop.z + 0.2);
              } else if (e.key === "-" || e.key === "_") {
                e.preventDefault();
                zoomAt(crop.z - 0.2);
              } else if (e.key === "0") {
                e.preventDefault();
                apply({ x: 0, y: 0, z: 1 });
              }
            }}
            className={cn(
              "group/crop relative mx-auto touch-none overflow-hidden rounded-xl bg-page select-none",
              "cursor-grab data-dragging:cursor-grabbing",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            )}
            style={{ width: box, height: box }}
          >
            {source && (
              <motion.img
                key={source.url}
                src={source.url}
                alt=""
                draggable={false}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.22, ease: ease.out }}
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 max-w-none",
                  // Button zooms glide; drags, pinches, the slider and keys follow the input directly.
                  glide && "transition-transform duration-200 ease-out-expo motion-reduce:transition-none",
                )}
                style={{ width: w, height: h, transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) scale(${crop.z})` }}
              />
            )}
            {/* The mask: everything outside the circle dims, the circle gets a hairline edge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-full shadow-[0_0_0_999px_color-mix(in_oklab,var(--page)_68%,transparent)] ring-1 ring-fg/35"
              style={{ inset: PAD }}
            />
            {/* Thirds appear only while dragging, as an alignment aid. */}
            <div
              aria-hidden
              className="pointer-events-none absolute overflow-hidden rounded-full opacity-0 transition-opacity duration-200 group-data-dragging/crop:opacity-100"
              style={{ inset: PAD }}
            >
              {[1, 2].map((i) => (
                <span key={`v${i}`} className="absolute inset-y-0 w-px bg-fg/25" style={{ left: `${(i * 100) / 3}%` }} />
              ))}
              {[1, 2].map((i) => (
                <span key={`h${i}`} className="absolute inset-x-0 h-px bg-fg/25" style={{ top: `${(i * 100) / 3}%` }} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ZoomButton
              label="Zoom out"
              disabled={crop.z <= 1}
              onClick={() => {
                setGlide(true);
                zoomAt(crop.z - 0.25);
              }}
            >
              <path d="M5 8h6" />
            </ZoomButton>
            <Slider.Root
              value={crop.z}
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              onValueChange={(v) => {
                setGlide(false);
                zoomAt(v as number);
              }}
              className="flex-1"
              aria-label="Zoom"
            >
              <Slider.Control className="group/zs relative flex h-6 cursor-pointer touch-none items-center select-none">
                <Slider.Track className="relative h-1 w-full rounded-full bg-fg/10">
                  <Slider.Indicator className="rounded-full bg-fg" />
                  <Slider.Thumb
                    aria-label="Zoom"
                    getAriaValueText={(_, v) => `${Math.round(v * 100)}%`}
                    className="group/thumb size-4 outline-none before:absolute before:-inset-3.5 before:content-['']"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-0 rounded-full bg-fg shadow-[var(--shadow)] transition-[scale,box-shadow] duration-150 ease-out-expo",
                        "outline-offset-2 group-has-focus-visible/thumb:outline-1 group-has-focus-visible/thumb:outline-solid group-has-focus-visible/thumb:outline-fg-3",
                        "group-hover/zs:scale-110 group-data-dragging/zs:scale-125 group-data-dragging/zs:ring-4 group-data-dragging/zs:ring-fg/10",
                      )}
                    />
                  </Slider.Thumb>
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
            <ZoomButton
              label="Zoom in"
              disabled={crop.z >= MAX_ZOOM}
              onClick={() => {
                setGlide(true);
                zoomAt(crop.z + 0.25);
              }}
            >
              <path d="M5 8h6M8 5v6" />
            </ZoomButton>
          </div>

          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Btn variant="secondary" size="md" />}>Cancel</Dialog.Close>
            <Btn
              variant="primary"
              size="md"
              busy={saving}
              onClick={async () => {
                if (!img || saving) return;
                setSaving(true);
                try {
                  const blob = await renderCrop(img, crop, FRAME, outputSize);
                  await onSave(blob);
                } catch {
                  setSaving(false);
                }
              }}
            >
              Save photo
            </Btn>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Btn({
  variant = "ghost",
  size = "sm",
  busy,
  className,
  children,
  ...rest
}: React.ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md"; busy?: boolean }) {
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-medium tracking-[-0.005em] whitespace-nowrap",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 rounded-md px-2.5 text-[12px]" : "h-8 rounded-lg px-3 text-[12.5px]",
        variant === "primary" && "bg-fg text-frame hover:bg-fg/90",
        variant === "secondary" && "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
        variant === "ghost" && "text-fg-2 hover:bg-hover hover:text-fg",
        busy && "pointer-events-none",
        className,
      )}
      {...rest}
    >
      {/* The label keeps its width while a spinner sits over it. */}
      <span className={cn("transition-opacity duration-150", busy && "opacity-0")}>{children}</span>
      {busy && (
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="absolute animate-spin">
          <path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75" />
        </svg>
      )}
    </button>
  );
}

function ZoomButton({ label, children, ...rest }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] disabled:pointer-events-none disabled:opacity-40",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
      )}
      {...rest}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="8" cy="8" r="5.75" />
        {children}
      </svg>
    </button>
  );
}

function CameraGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5.75c0-.55.45-1 1-1h1.7l1.05-1.5h3.5l1.05 1.5h1.7c.55 0 1 .45 1 1v6.25c0 .55-.45 1-1 1h-9c-.55 0-1-.45-1-1z" />
      <circle cx="8" cy="8.6" r="2.2" />
    </svg>
  );
}

function PersonGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="8" cy="5.75" r="2.5" />
      <path d="M3.25 13.25c.5-2.4 2.4-3.75 4.75-3.75s4.25 1.35 4.75 3.75" />
    </svg>
  );
}
