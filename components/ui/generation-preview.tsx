"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Refresh, Warning, X } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type GenerationStatus = "queued" | "generating" | "done" | "failed" | "canceled";

export type GenerationVariant = {
  id: string;
  status: GenerationStatus;
  /** 0–1. Drives how sharp the preview is. */
  progress?: number;
  /** The latest preview, then the final image. Leave it out until the first preview exists. */
  src?: string;
  alt?: string;
  /** Shown on a failed tile. */
  error?: string;
};

const running = (s: GenerationStatus) => s === "queued" || s === "generating";
const clamp = (n: number) => Math.min(1, Math.max(0, n));

// A tile of film grain, drawn once as SVG noise and moved in steps to read as "still resolving".
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.4 -.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* -------------------------------------------------------------------------------------------------
 * GenerationPreview
 * -----------------------------------------------------------------------------------------------*/

export type GenerationPreviewProps = Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> & {
  variants: GenerationVariant[];
  /** What was asked for. Shown as the heading, two lines at most. */
  prompt: string;
  /** Beside the status: model, size, seed. */
  details?: string;
  /** Tile shape, as CSS aspect-ratio. */
  aspectRatio?: string;
  /** The chosen variant's id. Controlled. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  /** Shows Cancel while anything is queued or generating. */
  onCancel?: () => void;
  /** Shows Try again on failed tiles. */
  onRetry?: (id: string) => void;
  /** Shows Generate again once nothing is running. */
  onRegenerate?: () => void;
};

export function GenerationPreview({
  variants,
  prompt,
  details,
  aspectRatio = "1 / 1",
  value,
  defaultValue = null,
  onValueChange,
  onCancel,
  onRetry,
  onRegenerate,
  className,
  ...rest
}: GenerationPreviewProps) {
  const reduce = !!useReducedMotion();
  const id = useId();
  const [selected, setSelected] = useControllableState<string | null>({ value, defaultValue, onChange: onValueChange });
  const busy = variants.some((v) => running(v.status));
  const live = variants.filter((v) => v.status !== "failed" && v.status !== "canceled");
  const overall = live.length ? Math.round((live.reduce((s, v) => s + (v.status === "done" ? 1 : clamp(v.progress ?? 0)), 0) / live.length) * 100) : 0;
  const done = variants.filter((v) => v.status === "done").length;
  const failed = variants.filter((v) => v.status === "failed").length;
  const canceled = variants.some((v) => v.status === "canceled");
  const chosen = variants.some((v) => v.id === selected && v.status === "done") ? selected : null;

  const status = busy
    ? null
    : canceled
      ? "Canceled"
      : failed && !done
        ? "Nothing generated"
        : `${done} ${done === 1 ? "image" : "images"}${failed ? `, ${failed} failed` : ""}`;

  return (
    <section aria-labelledby={`${id}-prompt`} aria-busy={busy || undefined} className={cn("flex w-full flex-col gap-3", className)} {...rest}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-prompt`} className="line-clamp-2 text-pretty text-[13px] font-medium leading-[1.4] tracking-[-0.01em] text-fg" title={prompt}>
            {prompt}
          </h3>
          <p className="tabular mt-0.5 flex h-[18px] min-w-0 items-center gap-1.5 text-[12px] leading-[18px] text-fg-3">
            {/* The status and the running percent share one slot; neither pushes the details around. */}
            <span className="grid shrink-0">
              <AnimatePresence initial={false}>
                <motion.span
                  key={busy ? "busy" : status}
                  className="col-start-1 row-start-1 whitespace-nowrap"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.22, ease: ease.out }}
                >
                  {busy ? (
                    <>
                      Generating <NumberFlow value={overall} suffix="%" className="text-fg-2" />
                    </>
                  ) : (
                    status
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
            {details && (
              <>
                <span aria-hidden className="text-fg-4">·</span>
                <span className="truncate">{details}</span>
              </>
            )}
          </p>
        </div>

        {/* One button that changes job, so focus stays put when a run is canceled or finishes. */}
        {((busy && onCancel) || (!busy && onRegenerate)) && (
          <button
            type="button"
            onClick={busy ? onCancel : onRegenerate}
            className={cn(
              button,
              "group/action border",
              busy ? "border-transparent text-fg-2 hover:bg-hover hover:text-fg" : "border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
            )}
          >
            <span className="grid [&>*]:col-start-1 [&>*]:row-start-1">
              {/* Both labels reserve the cell, so the button is as wide as the longer one. */}
              <span aria-hidden className="invisible flex items-center gap-1.5 whitespace-nowrap">
                <span className="size-3.5" />
                Generate again
              </span>
              <AnimatePresence initial={false}>
                <motion.span
                  key={busy ? "cancel" : "again"}
                  className="flex items-center justify-center gap-1.5 whitespace-nowrap"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22, ease: ease.out }}
                >
                  {busy ? <X size={14} /> : <Refresh size={14} className="transition-transform duration-300 ease-out group-hover/action:rotate-45" />}
                  {busy ? "Cancel" : "Generate again"}
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
        )}
      </header>

      <RadioGroup
        aria-label="Variants"
        value={chosen}
        onValueChange={(v) => setSelected(v as string)}
        className={cn("grid gap-1.5", variants.length === 1 ? "grid-cols-1" : "grid-cols-2")}
      >
        {variants.map((v, i) => (
          <GenerationTile key={v.id} variant={v} index={i} aspectRatio={aspectRatio} selectable onRetry={onRetry} reduce={reduce} />
        ))}
      </RadioGroup>

      <span role="status" aria-live="polite" className="sr-only">
        {busy ? "" : status}
      </span>
    </section>
  );
}

const button = cn(
  "relative inline-flex h-8 shrink-0 select-none items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium outline-none",
  "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
);

/* -------------------------------------------------------------------------------------------------
 * GenerationTile
 * -----------------------------------------------------------------------------------------------*/

export type GenerationTileProps = {
  variant: GenerationVariant;
  index?: number;
  aspectRatio?: string;
  /** Inside a GenerationPreview: finished tiles become radio options. */
  selectable?: boolean;
  onRetry?: (id: string) => void;
  reduce?: boolean;
  className?: string;
};

/**
 * One image as it resolves: grain over a blurred, desaturated preview that
 * sharpens with progress, then settles when it's done. Usable on its own.
 */
export function GenerationTile({ variant: v, index = 0, aspectRatio = "1 / 1", selectable = false, onRetry, reduce: reduceProp, className }: GenerationTileProps) {
  const reduceMotion = useReducedMotion();
  const reduce = reduceProp ?? !!reduceMotion;
  const p = v.status === "done" ? 1 : clamp(v.progress ?? 0);
  // Double-buffered: the last preview that loaded stays up while the next one
  // loads underneath, so a stream of previews never blinks back to grain.
  const [shown, setShown] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const current = v.src ?? null;
  const pending = current && current !== shown && current !== broken ? current : null;
  const visible = current ? (shown ?? null) : null;
  const imageReady = !!visible;
  const resolving = running(v.status);
  const label = v.alt ?? `Variant ${index + 1}`;

  // Blur and grain fall away as progress rises; the curve front-loads the change so early steps are visible.
  const blur = v.status === "done" ? 0 : 22 * Math.pow(1 - p, 1.4);
  const grain = v.status === "done" ? 0 : imageReady ? 0.75 * Math.pow(1 - p, 1.1) : 0.3;
  const saturate = v.status === "done" ? 1 : 0.35 + 0.65 * p;

  const face = (
    <span className="relative block overflow-hidden rounded-[inherit] bg-hover" style={{ aspectRatio }}>
      {[visible, pending].map((src, i) =>
        src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            onLoad={i === 1 ? () => setShown(src) : undefined}
            onError={i === 1 ? () => setBroken(src) : undefined}
            className={cn(
              "absolute inset-0 size-full select-none object-cover",
              "transition-[filter,transform,opacity] duration-500 ease-out-quart motion-reduce:transition-[opacity]",
              selectable && v.status === "done" && "group-hover/tile:scale-[1.02]",
            )}
            style={{
              opacity: i === 0 ? 1 : 0,
              filter: `blur(${blur.toFixed(1)}px) saturate(${saturate.toFixed(2)})`,
              // Scaled up while blurred so the soft edge never shows the tile's background.
              transform: v.status === "done" ? undefined : `scale(${(1 + blur / 120).toFixed(3)})`,
            }}
          />
        ) : null,
      )}
      <Grain opacity={grain} overImage={imageReady} animate={resolving && !reduce} />

      {/* Progress along the bottom edge, and the percent in the corner. */}
      <AnimatePresence>
        {resolving && (
          <motion.span key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="absolute inset-x-0 bottom-0">
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-fg/15" />
            <span
              className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-fg transition-transform duration-500 ease-out-quart motion-reduce:transition-none"
              style={{ transform: `scaleX(${p})` }}
            />
            <span className="tabular absolute bottom-2 left-2 rounded-md bg-page/75 px-1.5 py-0.5 font-mono text-[10.5px] leading-4 text-fg backdrop-blur-sm">
              {v.status === "queued" ? "Queued" : `${Math.round(p * 100)}%`}
            </span>
          </motion.span>
        )}
      </AnimatePresence>

      {v.status === "canceled" && (
        <span className="absolute bottom-2 left-2 rounded-md bg-page/75 px-1.5 py-0.5 text-[11px] leading-4 text-fg-2 backdrop-blur-sm">Canceled</span>
      )}

      {v.status === "failed" && (
        <span className="absolute inset-0 grid place-items-center bg-raised/80 p-3 text-center">
          <span className="flex flex-col items-center gap-1.5">
            <Warning size={16} className="text-danger" />
            <span className="text-[12px] leading-[1.35] text-fg-2">{v.error ?? "Couldn’t generate this one"}</span>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(v.id)}
                className={cn(button, "mt-0.5 h-7 border border-line-2 bg-raised px-2 text-[12px] text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover")}
              >
                Try again
              </button>
            )}
          </span>
        </span>
      )}
    </span>
  );

  const tileClass = cn("group/tile relative block rounded-lg", className);

  if (selectable && v.status === "done")
    return (
      <Radio.Root
        value={v.id}
        aria-label={label}
        className={cn(
          tileClass,
          "cursor-pointer outline-none transition-[scale] duration-150 ease-out active:scale-[0.98]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          // The chosen tile gets a ring drawn inside it, so neighbours don't shift.
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--line)] after:transition-shadow after:duration-200",
          "data-checked:after:shadow-[inset_0_0_0_2px_var(--fg),inset_0_0_0_4px_var(--page)]",
        )}
      >
        {face}
        <Radio.Indicator
          keepMounted
          className={cn(
            "absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-fg text-frame shadow-[var(--shadow)]",
            "transition-[opacity,scale] duration-200 ease-out-expo data-unchecked:scale-50 data-unchecked:opacity-0 motion-reduce:data-unchecked:scale-100",
          )}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        </Radio.Indicator>
      </Radio.Root>
    );

  return (
    <div
      // A failed tile holds a button, so it's a group rather than an image.
      role={v.status === "failed" ? "group" : "img"}
      aria-label={
        v.status === "failed"
          ? `${label}, failed`
          : v.status === "canceled"
            ? `${label}, canceled`
            : v.status === "done"
              ? label
              : v.status === "queued"
                ? `${label}, queued`
                : `${label}, ${Math.round(p * 100)}% generated`
      }
      className={cn(tileClass, "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--line)]")}
    >
      {face}
    </div>
  );
}

/**
 * Grain that shifts position in steps while a tile resolves. It uses the Web
 * Animations API on a transform, pauses off screen, and stops when done.
 */
function Grain({ opacity, overImage, animate }: { opacity: number; overImage: boolean; animate: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;
    const anim = el.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-12%, 6%)" },
        { transform: "translate(5%, -11%)" },
        { transform: "translate(-8%, -4%)" },
        { transform: "translate(10%, 9%)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 700, iterations: Infinity, easing: "steps(5, end)" },
    );
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? anim.play() : anim.pause()));
    io.observe(el);
    return () => {
      io.disconnect();
      anim.cancel();
    };
  }, [animate]);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        ref={ref}
        // Over an image the grain lifts its texture; on the empty tile it is the picture.
        className={cn("absolute -inset-1/4 transition-opacity duration-500 ease-out-quart", overImage && "mix-blend-overlay")}
        style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px", opacity }}
      />
    </span>
  );
}
