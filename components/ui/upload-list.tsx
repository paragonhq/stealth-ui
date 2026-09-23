"use client";
import { Progress } from "@base-ui/react/progress";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

export type UploadStatus = "queued" | "uploading" | "processing" | "done" | "error";

export type UploadItem = {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** Bytes sent so far. */
  loaded: number;
  status: UploadStatus;
  /** Smoothed bytes per second. useUploads measures it; bring your own if you manage state yourself. */
  speed?: number;
  /** Why it failed, in a sentence: "Connection lost at 24 MB." */
  error?: string;
  /** An image URL for the tile. useUploads makes one for images and revokes it when the row goes. */
  thumbnail?: string;
};

/** Sends one file. Report bytes with onProgress, call onProcessing once the bytes are up but the server is still working, and honor the signal. */
export type Uploader = (file: File, ctx: { signal: AbortSignal; onProgress: (loaded: number) => void; onProcessing: () => void }) => Promise<unknown>;

/** 10485760 → "10 MB", with a no-break space so sizes never wrap mid-value. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.round(bytes)}\u00a0B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}\u00a0${units[i]}`;
}

/** 5 → "5s", 80 → "1m 20s", 5400 → "1h 30m". */
export function formatEta(seconds: number) {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (s < 3600) return m >= 10 ? `${m}m` : `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Truncates in the middle at any width: the head ellipsizes, the tail (the last few
// characters and the extension) never does, so "onboarding-walk…through.mov" keeps its type.
function MiddleName({ name, className }: { name: string; className?: string }) {
  const dot = name.lastIndexOf(".");
  const cut = Math.max(0, name.length - Math.max(8, dot > 0 ? name.length - dot + 5 : 8));
  const head = name.slice(0, cut);
  const tail = name.slice(cut);
  return (
    <span className={cn("flex min-w-0", className)} title={name}>
      <span className="truncate">{head}</span>
      <span className="shrink-0 whitespace-pre">{tail}</span>
    </span>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const active = (s: UploadStatus) => s === "queued" || s === "uploading" || s === "processing";

/* ------------------------------------------------------------------ */
/* The queue: optional, for when you don't already have upload state   */
/* ------------------------------------------------------------------ */

type Meter = { samples: { t: number; b: number }[]; speed?: number };

// Speed over a sliding 3s window, then eased, so "time left" settles instead of jittering every tick.
function measure(m: Meter, loaded: number) {
  const t = performance.now();
  m.samples.push({ t, b: loaded });
  while (m.samples.length > 2 && t - m.samples[0].t > 3000) m.samples.shift();
  const first = m.samples[0];
  const dt = (t - first.t) / 1000;
  if (dt < 0.6) return m.speed;
  const now = (loaded - first.b) / dt;
  m.speed = m.speed == null ? now : m.speed * 0.6 + now * 0.4;
  return m.speed;
}

function createStore(onChange: (items: UploadItem[]) => void) {
  let list: UploadItem[] = [];
  let cfg: { upload?: Uploader; concurrency: number } = { concurrency: 3 };
  let frame = 0;
  let seq = 0;
  const files = new Map<string, File>();
  const ctrls = new Map<string, AbortController>();
  const meters = new Map<string, Meter>();
  const urls = new Map<string, string>();

  const emit = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    onChange(list);
  };
  // Progress can fire hundreds of times a second; the list re-renders at most once a frame.
  const soon = () => {
    if (!frame) frame = requestAnimationFrame(emit);
  };
  const patch = (id: string, p: Partial<UploadItem>) => {
    list = list.map((i) => (i.id === id ? { ...i, ...p } : i));
  };
  const forget = (id: string) => {
    ctrls.get(id)?.abort();
    ctrls.delete(id);
    meters.delete(id);
    files.delete(id);
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
  };

  const start = (id: string) => {
    const file = files.get(id);
    const upload = cfg.upload;
    if (!file || !upload) return;
    const c = new AbortController();
    const m: Meter = { samples: [] };
    ctrls.set(id, c);
    meters.set(id, m);
    patch(id, { status: "uploading", loaded: 0, speed: undefined, error: undefined });
    upload(file, {
      signal: c.signal,
      onProgress: (loaded) => {
        if (c.signal.aborted) return;
        patch(id, { loaded: Math.min(loaded, file.size), speed: measure(m, loaded) });
        soon();
      },
      onProcessing: () => {
        if (c.signal.aborted) return;
        patch(id, { status: "processing", loaded: file.size, speed: undefined });
        soon();
      },
    }).then(
      () => {
        if (c.signal.aborted) return;
        ctrls.delete(id);
        patch(id, { status: "done", loaded: file.size, speed: undefined });
        pump();
        emit();
      },
      (err: unknown) => {
        if (c.signal.aborted) return;
        ctrls.delete(id);
        const msg = err instanceof Error && err.message ? err.message : "Couldn’t upload. Try again.";
        patch(id, { status: "error", error: msg, speed: undefined });
        pump();
        emit();
      },
    );
  };

  const pump = () => {
    let slots = cfg.concurrency - list.filter((i) => i.status === "uploading" || i.status === "processing").length;
    for (const i of list) {
      if (slots <= 0) break;
      if (i.status !== "queued") continue;
      slots--;
      start(i.id);
    }
  };

  return {
    configure(next: { upload: Uploader; concurrency: number }) {
      cfg = next;
    },
    dispose() {
      for (const id of [...files.keys()]) forget(id);
      cancelAnimationFrame(frame);
    },
    add(incoming: File[]) {
      const added = incoming.map((file) => {
        const id = `u${Date.now().toString(36)}${seq++}`;
        files.set(id, file);
        let thumbnail: string | undefined;
        if (file.type.startsWith("image/") && file.size < 25 * 1024 * 1024) {
          thumbnail = URL.createObjectURL(file);
          urls.set(id, thumbnail);
        }
        return { id, name: file.name, size: file.size, loaded: 0, status: "queued" as const, thumbnail };
      });
      list = [...list, ...added];
      pump();
      emit();
      return added.map((a) => a.id);
    },
    cancel(id: string) {
      forget(id);
      list = list.filter((i) => i.id !== id);
      pump();
      emit();
    },
    remove(id: string) {
      forget(id);
      list = list.filter((i) => i.id !== id);
      emit();
    },
    retry(id: string) {
      patch(id, { status: "queued", loaded: 0, error: undefined });
      pump();
      emit();
    },
    retryAll() {
      list = list.map((i) => (i.status === "error" ? { ...i, status: "queued", loaded: 0, error: undefined } : i));
      pump();
      emit();
    },
    cancelAll() {
      for (const i of list) if (active(i.status)) forget(i.id);
      list = list.filter((i) => !active(i.status));
      emit();
    },
    clearCompleted() {
      for (const i of list) if (i.status === "done") forget(i.id);
      list = list.filter((i) => i.status !== "done");
      emit();
    },
  };
}

/**
 * A small upload queue: runs `concurrency` uploads at a time, measures speed,
 * cancels with AbortController, retries, and cleans up image previews.
 * Spread the result straight into <UploadList>.
 */
export function useUploads({ upload, concurrency = 3 }: { upload: Uploader; concurrency?: number }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [store] = useState(() => createStore(setItems));
  useEffect(() => store.configure({ upload, concurrency }));
  useEffect(() => () => store.dispose(), [store]);
  return {
    items,
    add: store.add,
    onCancel: store.cancel,
    onRetry: store.retry,
    onRemove: store.remove,
    onCancelAll: store.cancelAll,
    onRetryAll: store.retryAll,
    onClearCompleted: store.clearCompleted,
  };
}

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

export type UploadListProps = Omit<React.ComponentProps<"div">, "children"> & {
  items: UploadItem[];
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  /** Shows a remove button on finished and failed rows. */
  onRemove?: (id: string) => void;
  onCancelAll?: (() => void) | undefined;
  onRetryAll?: (() => void) | undefined;
  onClearCompleted?: (() => void) | undefined;
  /** The header with the overall count, bytes and time left. Defaults to on when there's more than one file. */
  summary?: boolean;
  /** Rendered in place of the rows when there are none. Without it the list collapses to nothing. */
  empty?: React.ReactNode;
  /** Accessible name of the list. */
  label?: string;
};

export function UploadList({
  items,
  onCancel,
  onRetry,
  onRemove,
  onCancelAll,
  onRetryAll,
  onClearCompleted,
  summary,
  empty,
  label = "Uploads",
  className,
  ...rest
}: UploadListProps) {
  const reduce = useReducedMotion();

  // Announce transitions, not ticks: compare with the previous render's items while rendering.
  const [prev, setPrev] = useState(items);
  const [said, setSaid] = useState({ text: "", n: 0 });
  if (prev !== items) {
    const was = new Map(prev.map((i) => [i.id, i.status]));
    const lines: string[] = [];
    for (const i of items) {
      const before = was.get(i.id);
      if (before === i.status) continue;
      if (i.status === "done") lines.push(`${i.name} uploaded.`);
      else if (i.status === "error") lines.push(`${i.name} failed. ${i.error ?? ""}`.trim());
    }
    if (lines.length && items.length > 1 && items.every((i) => i.status === "done")) lines.push("All uploads complete.");
    setPrev(items);
    if (lines.length) setSaid((s) => ({ text: lines.join(" "), n: s.n + 1 }));
  }

  const showSummary = summary ?? items.length > 1;

  return (
    <div
      data-slot="upload-list"
      data-empty={items.length === 0 || undefined}
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
        items.length === 0 && !empty && "invisible border-transparent shadow-none",
        className,
      )}
      {...rest}
    >
      <AnimatePresence initial={false}>
        {showSummary && items.length > 0 && (
          <motion.div
            key="summary"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.in } }}
            transition={{ duration: 0.24, ease: ease.out }}
          >
            <Summary items={items} onCancelAll={onCancelAll} onRetryAll={onRetryAll} onClearCompleted={onClearCompleted} />
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 && empty}

      <ul aria-label={label} className="flex flex-col">
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, height: 0, filter: "blur(2px)", transition: { duration: 0.18, ease: ease.in } }}
              transition={{ duration: 0.26, ease: ease.out, layout: spring.soft }}
              className="overflow-hidden"
            >
              <Row item={item} first={index === 0 && !showSummary} onCancel={onCancel} onRetry={onRetry} onRemove={onRemove} reduce={!!reduce} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <span role="status" aria-live="polite" className="sr-only">
        {said.text}
        {said.n % 2 ? "\u00a0" : ""}
      </span>
    </div>
  );
}

function Summary({ items, onCancelAll, onRetryAll, onClearCompleted }: Pick<UploadListProps, "items" | "onCancelAll" | "onRetryAll" | "onClearCompleted">) {
  const running = items.filter((i) => active(i.status));
  const failed = items.filter((i) => i.status === "error").length;
  const done = items.filter((i) => i.status === "done").length;
  const total = items.reduce((a, i) => a + i.size, 0);
  const loaded = items.reduce((a, i) => a + (i.status === "done" ? i.size : i.status === "error" ? 0 : i.loaded), 0);
  const counted = items.reduce((a, i) => a + (i.status === "error" ? 0 : i.size), 0);
  const speed = running.reduce((a, i) => a + (i.speed ?? 0), 0);
  const left = running.reduce((a, i) => a + (i.size - i.loaded), 0);
  const eta = speed > 0 && running.some((i) => i.status === "uploading") ? formatEta(left / speed) : null;

  const processingOnly = running.length > 0 && running.every((i) => i.status === "processing");
  const title = processingOnly
    ? `Processing ${plural(running.length, "file")}`
    : running.length
      ? `Uploading ${plural(running.length, "file")}`
      : failed
        ? `${plural(failed, "upload")} failed`
        : `${plural(done, "file")} uploaded`;
  const meta = processingOnly
    ? "Almost done"
    : running.length
      ? // Time left leads: it's the number people look for, and it survives truncation on a phone.
        [eta && `${eta} left`, `${formatBytes(loaded)} of ${formatBytes(counted)}`].filter(Boolean).join(" · ")
      : failed
        ? `${done} of ${items.length} uploaded`
        : formatBytes(total);
  const action = running.length
    ? onCancelAll && { label: "Cancel all", run: onCancelAll }
    : failed
      ? onRetryAll && { label: "Retry all", run: onRetryAll }
      : onClearCompleted && { label: "Clear", run: onClearCompleted };

  const whole = counted ? loaded / counted : 0;
  return (
    <div className="relative flex h-11 items-center gap-3 pl-3.5 pr-2">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={cn("shrink-0 text-[13px] font-medium tracking-[-0.01em]", !running.length && failed && "text-danger")}>{title}</span>
        <span className="min-w-0 truncate text-[12px] text-fg-3 tabular">{meta}</span>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className={cn(
            "relative inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[12px] font-medium text-fg-2",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97]",
            "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          {action.label}
        </button>
      )}
      {/* The header's bottom hairline doubles as the overall progress. */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line" />
      <span
        aria-hidden
        className={cn("absolute inset-x-0 bottom-0 h-px origin-left bg-fg-3 transition-[scale,opacity] duration-300 ease-out-expo", !running.length && "opacity-0 duration-500")}
        style={{ scale: `${whole} 1` }}
      />
    </div>
  );
}

const iconButton = cn(
  "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9]",
  // Draws at 28px; on touch the press target grows to 44px.
  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
);

const glyph = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function Row({
  item,
  first,
  onCancel,
  onRetry,
  onRemove,
  reduce,
}: {
  item: UploadItem;
  first: boolean;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  reduce: boolean;
}) {
  const { status, name, size, loaded, speed } = item;
  const pct = size ? Math.min(100, (loaded / size) * 100) : 0;
  const showBar = active(status);
  const ext = (name.includes(".") ? (name.split(".").pop() ?? "") : "").slice(0, 4).toUpperCase();
  const [retries, setRetries] = useState(0);

  const eta = status === "uploading" && speed && speed > 0 ? formatEta((size - loaded) / speed) : null;
  const meta =
    status === "queued"
      ? `Waiting · ${formatBytes(size)}`
      : status === "uploading"
        ? [`${formatBytes(loaded)} of ${formatBytes(size)}`, speed ? `${formatBytes(speed)}/s` : "Starting…", eta && `${eta} left`].filter(Boolean).join(" · ")
        : status === "processing"
          ? `Processing · ${formatBytes(size)}`
          : status === "done"
            ? `Uploaded · ${formatBytes(size)}`
            : (item.error ?? "Couldn’t upload. Try again.");

  return (
    <div data-status={status} className={cn("group/row flex items-center gap-3 py-2.5 pl-3 pr-2", !first && "border-t border-line")}>
      <div className="relative size-9 shrink-0">
        <div
          className={cn(
            "grid size-full place-items-center overflow-hidden rounded-lg border border-line-2 bg-frame font-mono text-[9.5px] font-medium tracking-[0.02em] text-fg-3",
            "transition-[border-color,color] duration-200 group-data-[status=error]/row:border-danger/40 group-data-[status=error]/row:text-danger",
          )}
        >
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URLs of local files; next/image can't optimize them.
            <img src={item.thumbnail} alt="" width={36} height={36} className="size-full object-cover" />
          ) : (
            ext || <FileGlyph />
          )}
        </div>
        {/* The badge pops once the bar has filled and folded away. */}
        <AnimatePresence initial={false}>
          {(status === "done" || status === "error") && (
            <motion.span
              key={status}
              aria-hidden
              className={cn(
                "absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full ring-2 ring-raised",
                status === "done" ? "bg-success text-raised" : "bg-danger text-raised",
              )}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1, transition: reduce ? { duration: 0.15 } : { ...spring.pop, delay: status === "done" ? 0.32 : 0 } }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.6, transition: { duration: 0.1 } }}
            >
              {status === "done" ? (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.42 }}
                  />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M8 4.5v4.25M8 11.6v.01" />
                </svg>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <MiddleName name={name} className="text-[13px] leading-[18px] tracking-[-0.005em] text-fg" />
        <div className="grid">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={status === "error" ? `error-${item.error}` : status}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              // Errors wrap: the reason is what someone needs to act on, so it is never cut off.
              className={cn("col-start-1 row-start-1 text-[12px] leading-[18px] tabular", status === "error" ? "text-danger text-pretty" : "truncate text-fg-3")}
            >
              {meta}
            </motion.span>
          </AnimatePresence>
        </div>
        {/* The bar folds away once it has filled; a failure folds it after showing where it stopped. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-[240ms] ease-in-out-quart",
            showBar ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            status === "done" && "delay-300",
            status === "error" && "delay-500",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <Progress.Root
              value={status === "processing" ? null : Math.round(pct)}
              aria-label={`Uploading ${name}`}
              getAriaValueText={(formatted) => (status === "processing" ? "Processing" : [formatted, eta && `${eta} left`].filter(Boolean).join(", "))}
              className="pt-1.5 pb-0.5"
            >
              <Progress.Track className="relative h-1 overflow-hidden rounded-full bg-fg/10">
                {status === "processing" ? (
                  <span className="absolute inset-0 animate-indeterminate rounded-full bg-fg-3 motion-reduce:animate-pulse-soft" />
                ) : (
                  <span
                    className={cn(
                      "absolute inset-0 origin-left rounded-full bg-fg transition-[scale,background-color] duration-300 ease-out",
                      status === "queued" && "bg-fg-4",
                      status === "error" && "bg-danger",
                    )}
                    style={{ scale: `${status === "done" ? 1 : pct / 100} 1` }}
                  />
                )}
              </Progress.Track>
            </Progress.Root>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {status === "error" && onRetry && (
          <button
            type="button"
            aria-label={`Retry ${name}`}
            onClick={() => {
              setRetries((n) => n + 1);
              onRetry(item.id);
            }}
            className={iconButton}
          >
            {/* One counter-clockwise turn per press: the retry visibly starts over. */}
            <motion.svg {...glyph} animate={{ rotate: reduce ? 0 : retries * -360 }} transition={{ duration: 0.5, ease: ease.out }}>
              <path d="M3 8a5 5 0 1 0 1.5-3.55M3 2.75V5h2.25" />
            </motion.svg>
          </button>
        )}
        {active(status) && onCancel && (
          <button type="button" aria-label={`Cancel upload of ${name}`} onClick={() => onCancel(item.id)} className={iconButton}>
            <svg {...glyph}>
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        )}
        {(status === "done" || status === "error") && onRemove && (
          <button type="button" aria-label={`Remove ${name}`} onClick={() => onRemove(item.id)} className={cn(iconButton, "text-fg-4")}>
            <svg {...glyph}>
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function FileGlyph() {
  return (
    <svg {...glyph}>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
    </svg>
  );
}
