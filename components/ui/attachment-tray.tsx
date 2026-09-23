"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, Image as ImageIcon, Refresh, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type AttachmentStatus = "uploading" | "done" | "error";

export type Attachment = {
  id: string;
  name: string;
  /** Bytes. */
  size?: number;
  /** MIME type. image/* draws a thumbnail tile (a placeholder until preview is set); anything else is a file chip. */
  type?: string;
  /** Thumbnail URL, e.g. from URL.createObjectURL(file). */
  preview?: string;
  /** 0–1 while uploading. Leave it out for an upload of unknown length. */
  progress?: number;
  /** Defaults to "uploading" while progress is below 1, else "done". */
  status?: AttachmentStatus;
  /** Why it failed, in a few words. */
  error?: string;
};

const statusOf = (a: Attachment): AttachmentStatus => a.status ?? (a.progress !== undefined && a.progress < 1 ? "uploading" : "done");
const isImage = (a: Attachment) => (a.type ? a.type.startsWith("image/") : !!a.preview);

function split(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 && name.length - i <= 6 ? [name.slice(0, i), name.slice(i)] : [name, ""];
}

/** "2.4 MB", "820 KB". Uses the reader's locale. */
export function formatBytes(bytes: number, locale?: string) {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let i = 0;
  let n = bytes;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: units[i], unitDisplay: "short", maximumFractionDigits: n < 10 && i > 1 ? 1 : 0 }).format(n);
}

/* -------------------------------------------------------------------------------------------------
 * AttachmentTray
 * -----------------------------------------------------------------------------------------------*/

export type AttachmentTrayProps = Omit<React.ComponentProps<"div">, "children"> & {
  items: Attachment[];
  /** Removes one. Delete or Backspace on a focused item does the same. */
  onRemove?: (id: string) => void;
  /** Receives the list in its new order: drag with a mouse or pen, or Alt+Arrow keys. */
  onReorder?: (items: Attachment[]) => void;
  /** Shown on failed items, and bound to Enter when one is focused. */
  onRetry?: (id: string) => void;
  /** The list's accessible name. */
  label?: string;
};

/**
 * Pending attachments above a composer. Thumbnails develop from dim to sharp as they upload,
 * chips roll their percentage, failures offer a retry in place, and items pop in, fold out,
 * and slide aside for one another as they are dragged or moved from the keyboard.
 */
export function AttachmentTray({ items, onRemove, onReorder, onRetry, label = "Attachments", className, ...rest }: AttachmentTrayProps) {
  const reduce = !!useReducedMotion();
  const scroller = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [dragging, setDragging] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  // Tell screen reader users what changed on its own: finished, failed. Derived from the last
  // render's statuses rather than an effect, so it lands in the same commit.
  const statusKey = items.map((a) => `${a.id}:${statusOf(a)}`).join("|");
  const [prev, setPrev] = useState(() => ({ key: statusKey, map: new Map(items.map((a) => [a.id, statusOf(a)])), ids: new Set<string>() }));
  if (prev.key !== statusKey) {
    const map = new Map(items.map((a) => [a.id, statusOf(a)]));
    const news: string[] = [];
    for (const a of items) {
      const was = prev.map.get(a.id);
      const now = map.get(a.id);
      if (was && was !== now && now === "done") news.push(`${a.name} uploaded`);
      if (was !== now && now === "error") news.push(`${a.name} failed to upload${a.error ? `: ${a.error}` : ""}`);
    }
    // Items that arrived since last time pop in with a small stagger.
    const ids = new Set(items.filter((a) => !prev.map.has(a.id)).map((a) => a.id));
    setPrev({ key: statusKey, map, ids });
    if (news.length) setSaid(news.join(". "));
  }

  // Fade the edges only where there is more to scroll to.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [items.length]);

  // Newly added items scroll into view in the tray (never the page).
  const lastId = items[items.length - 1]?.id;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !lastId || !prev.ids.has(lastId)) return;
    el.scrollTo({ left: el.scrollWidth, behavior: reduce ? "auto" : "smooth" });
  }, [lastId, prev.ids, reduce]);

  const tabbable = (active && items.some((a) => a.id === active) && active) || items[0]?.id;
  const focusItem = (id: string | undefined) => {
    if (!id) return;
    requestAnimationFrame(() => scroller.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`)?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent, a: Attachment, i: number) => {
    const move = (to: number) => {
      if (to < 0 || to >= items.length || !onReorder) return;
      const next = [...items];
      next.splice(i, 1);
      next.splice(to, 0, a);
      onReorder(next);
      setSaid(`${a.name} moved to position ${to + 1} of ${items.length}`);
      focusItem(a.id);
    };
    const go = (to: number) => {
      const t = items[Math.max(0, Math.min(items.length - 1, to))];
      if (t) scroller.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(t.id)}"]`)?.focus();
    };
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      handled();
      const d = e.key === "ArrowLeft" ? -1 : 1;
      if (e.altKey) move(i + d);
      else go(i + d);
    } else if (e.key === "Home" || e.key === "End") {
      handled();
      if (e.altKey) move(e.key === "Home" ? 0 : items.length - 1);
      else go(e.key === "Home" ? 0 : items.length - 1);
    } else if ((e.key === "Delete" || e.key === "Backspace") && onRemove) {
      handled();
      const neighbour = items[i + 1] ?? items[i - 1];
      setSaid(`${a.name} removed`);
      onRemove(a.id);
      focusItem(neighbour?.id);
    } else if (e.key === "Enter" && statusOf(a) === "error" && onRetry) {
      handled();
      onRetry(a.id);
    }
  };

  const freshIds = [...prev.ids];

  return (
    <div className={cn("relative min-w-0", className)} {...rest}>
      <Reorder.Group
        ref={scroller}
        as="ul"
        axis="x"
        values={items}
        onReorder={(next) => onReorder?.(next)}
        aria-label={label}
        className={cn(
          "flex items-center gap-2 overflow-x-auto overscroll-x-contain py-2 pl-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // The edges fade only where there is more to scroll to. A mask, so it works on any surface.
          edges.start && edges.end && "[mask-image:linear-gradient(to_right,transparent,var(--fg)_24px,var(--fg)_calc(100%-24px),transparent)]",
          edges.start && !edges.end && "[mask-image:linear-gradient(to_right,transparent,var(--fg)_24px)]",
          !edges.start && edges.end && "[mask-image:linear-gradient(to_left,transparent,var(--fg)_24px)]",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((a, i) => (
            <Item
              key={a.id}
              a={a}
              index={i}
              count={items.length}
              enterDelay={reduce ? 0 : Math.min(Math.max(freshIds.indexOf(a.id), 0), 8) * 0.03}
              reduce={reduce}
              tabbable={tabbable === a.id}
              dragging={dragging === a.id}
              reorderable={!!onReorder && items.length > 1}
              bounds={scroller}
              onDragChange={(d) => setDragging(d ? a.id : null)}
              onFocus={() => setActive(a.id)}
              onKeyDown={(e) => onKeyDown(e, a, i)}
              onRemove={
                onRemove &&
                (() => {
                  const neighbour = items[i + 1] ?? items[i - 1];
                  setSaid(`${a.name} removed`);
                  onRemove(a.id);
                  focusItem(neighbour?.id);
                })
              }
              onRetry={onRetry && (() => onRetry(a.id))}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Item
 * -----------------------------------------------------------------------------------------------*/

type ItemProps = {
  a: Attachment;
  bounds: React.RefObject<HTMLUListElement | null>;
  index: number;
  count: number;
  enterDelay: number;
  reduce: boolean;
  tabbable: boolean;
  dragging: boolean;
  reorderable: boolean;
  onDragChange: (dragging: boolean) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onRemove?: () => void;
  onRetry?: () => void;
};

function Item({ a, bounds, index, count, enterDelay, reduce, tabbable, dragging, reorderable, onDragChange, onFocus, onKeyDown, onRemove, onRetry }: ItemProps) {
  const controls = useDragControls();
  const status = statusOf(a);
  const image = isImage(a);
  const pct = a.progress !== undefined ? Math.round(a.progress * 100) : undefined;
  const spoken = [
    a.name,
    a.size !== undefined ? formatBytes(a.size) : "",
    status === "uploading" ? (pct !== undefined ? `uploading, ${pct}%` : "uploading") : status === "error" ? `failed${a.error ? `: ${a.error}` : ""}` : "",
    `${index + 1} of ${count}`,
  ]
    .filter(Boolean)
    .join(", ");
  const hint = [onRemove && "Delete to remove", reorderable && "Alt and arrow keys to move", status === "error" && onRetry && "Enter to retry"].filter(Boolean).join(". ");

  return (
    <Reorder.Item
      as="li"
      value={a}
      data-item={a.id}
      data-status={status}
      data-dragging={dragging || undefined}
      tabIndex={tabbable ? 0 : -1}
      aria-label={spoken}
      aria-description={hint || undefined}
      dragListener={false}
      dragControls={controls}
      // Stays inside the tray, with a little give at the ends.
      dragConstraints={bounds}
      dragElastic={0.08}
      onPointerDown={(e) => {
        // Mouse and pen pick items up; on touch the tray scrolls instead.
        if (!reorderable || e.pointerType === "touch" || (e.target as HTMLElement).closest("button")) return;
        controls.start(e);
      }}
      onDragStart={() => onDragChange(true)}
      onDragEnd={() => onDragChange(false)}
      onFocus={(e) => e.target === e.currentTarget && onFocus()}
      onKeyDown={(e) => e.target === e.currentTarget && onKeyDown(e)}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: reduce ? { duration: 0.15 } : { ...spring.pop, delay: enterDelay } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.8, filter: "blur(3px)", transition: { duration: 0.14, ease: ease.in } }}
      whileDrag={reduce ? undefined : { scale: 1.05 }}
      transition={{ layout: reduce ? { duration: 0 } : spring.soft }}
      className={cn(
        "group/item relative shrink-0 rounded-lg outline-none select-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        reorderable && "pointer-fine:cursor-grab",
        dragging && "z-10 cursor-grabbing shadow-pop",
      )}
    >
      {image ? <Thumb a={a} status={status} reduce={reduce} onRetry={onRetry} /> : <Chip a={a} status={status} pct={pct} reduce={reduce} onRetry={onRetry} />}
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Remove ${a.name}`}
          onClick={onRemove}
          className={cn(
            "absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)]",
            "transition-[opacity,scale,color,background-color] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-90",
            // On touch it is always there, with a 44px target; with a mouse it waits for hover or focus.
            "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:-inset-1",
            "pointer-fine:scale-90 pointer-fine:opacity-0 pointer-fine:group-hover/item:scale-100 pointer-fine:group-hover/item:opacity-100",
            "pointer-fine:group-focus-visible/item:scale-100 pointer-fine:group-focus-visible/item:opacity-100",
            dragging && "invisible",
          )}
        >
          <X size={10} strokeWidth={2} />
        </button>
      )}
    </Reorder.Item>
  );
}

function Ring({ progress, reduce, size = 22 }: { progress?: number; reduce: boolean; size?: number }) {
  const indeterminate = progress === undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cn(indeterminate && "animate-spin-slow")}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth="2.5" />
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
        initial={false}
        animate={{ pathLength: indeterminate ? 0.28 : Math.max(0.02, progress) }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 24 }}
      />
    </svg>
  );
}

function Thumb({ a, status, reduce, onRetry }: { a: Attachment; status: AttachmentStatus; reduce: boolean; onRetry?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const uploading = status === "uploading";
  const failed = status === "error";
  return (
    <div className={cn("relative size-16 overflow-hidden rounded-lg border bg-fg/[0.05] transition-colors duration-200", failed ? "border-danger/50" : "border-line-2")}>
      {!a.preview && (
        <span className="absolute inset-0 grid place-items-center text-fg-4">
          <ImageIcon size={18} />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {a.preview && <img
        src={a.preview}
        alt=""
        width={64}
        height={64}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cn(
          "size-full object-cover transition-[opacity,filter,scale] duration-500 ease-out-quart",
          // It develops as it uploads: dim and soft until the bytes are safe, then sharp.
          !loaded ? "opacity-0" : uploading ? "scale-[1.04] opacity-50 blur-[1px]" : failed ? "opacity-40 grayscale" : "opacity-100",
        )}
      />}
      <AnimatePresence initial={false}>
        {uploading && (
          <motion.span
            key="ring"
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.3, transition: { duration: 0.25, ease: ease.out } }}
          >
            <span className="grid size-8 place-items-center rounded-full bg-page/70 text-fg">
              <Ring progress={a.progress} reduce={reduce} />
            </span>
          </motion.span>
        )}
        {failed && (
          <motion.span key="error" className="absolute inset-0 grid place-items-center bg-danger-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {onRetry ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Retry ${a.name}`}
                onClick={onRetry}
                className="grid size-8 place-items-center rounded-full bg-page/80 text-danger transition-[scale,background-color] duration-150 hover:bg-page active:scale-90"
              >
                <Refresh size={14} />
              </button>
            ) : (
              <span className="grid size-8 place-items-center rounded-full bg-page/80 text-danger">
                <Alert size={14} />
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ a, status, pct, reduce, onRetry }: { a: Attachment; status: AttachmentStatus; pct?: number; reduce: boolean; onRetry?: () => void }) {
  const [base, ext] = split(a.name);
  const failed = status === "error";
  const uploading = status === "uploading";
  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" },
    transition: reduce ? { duration: 0.12 } : spring.pop,
  };
  const line = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, y: -4, transition: { duration: 0.1 } },
    transition: { duration: 0.18, ease: ease.out },
  };

  return (
    <div
      className={cn(
        "relative flex h-16 w-[216px] items-center gap-2.5 overflow-hidden rounded-lg border bg-raised pl-2.5 pr-3 transition-colors duration-200",
        failed ? "border-danger/50" : "border-line-2",
      )}
    >
      <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-md transition-colors duration-200", failed ? "bg-danger-soft text-danger" : "bg-fg/[0.06] text-fg-2")}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={status} className="grid place-items-center" {...swap}>
            {uploading ? (
              <Ring progress={a.progress} reduce={reduce} size={20} />
            ) : failed ? (
              <Alert />
            ) : (
              <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.04em]">{(ext.slice(1) || "file").slice(0, 4)}</span>
            )}
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Names truncate in the middle of the stem, so the extension always shows. */}
        <span className="flex min-w-0 text-[12.5px] font-medium leading-4 text-fg" title={a.name}>
          <span className="truncate">{base}</span>
          <span className="shrink-0">{ext}</span>
        </span>
        <span className="relative grid h-4 text-[11.5px] leading-4">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={status} className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 whitespace-nowrap" {...line}>
              {uploading ? (
                <span className="text-fg-3 tabular">
                  {pct !== undefined ? (
                    <>
                      <NumberFlow value={a.progress ?? 0} format={{ style: "percent", maximumFractionDigits: 0 }} animated={!reduce} />
                      {a.size !== undefined && <span suppressHydrationWarning> of {formatBytes(a.size)}</span>}
                    </>
                  ) : (
                    "Uploading…"
                  )}
                </span>
              ) : failed ? (
                <>
                  <span className="truncate text-danger">{a.error ?? "Upload failed"}</span>
                  {onRetry && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={onRetry}
                      className="relative shrink-0 font-medium text-fg underline decoration-fg/30 underline-offset-2 transition-[text-decoration-color] duration-150 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:decoration-fg"
                    >
                      Retry
                    </button>
                  )}
                </>
              ) : (
                <span className="text-fg-3 tabular" suppressHydrationWarning>
                  {a.size !== undefined ? formatBytes(a.size) : "Ready"}
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>

      {/* A hairline of progress along the bottom edge; it drains away once the upload lands. */}
      <AnimatePresence initial={false}>
        {uploading && a.progress !== undefined && (
          <motion.span
            key="bar"
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-fg"
            initial={{ scaleX: a.progress, opacity: 1 }}
            animate={{ scaleX: a.progress, opacity: 1 }}
            exit={{ scaleX: 1, opacity: 0, transition: { duration: reduce ? 0.1 : 0.35, ease: ease.out } }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 24 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
