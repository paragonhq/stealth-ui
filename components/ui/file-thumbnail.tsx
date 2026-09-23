"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ file kinds */

export type FileKind = "pdf" | "image" | "sheet" | "doc" | "slides" | "code" | "archive" | "audio" | "video" | "other";

const EXT: Record<string, FileKind> = {
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", avif: "image", svg: "image", heic: "image",
  xls: "sheet", xlsx: "sheet", csv: "sheet", tsv: "sheet", numbers: "sheet", ods: "sheet",
  doc: "doc", docx: "doc", txt: "doc", md: "doc", rtf: "doc", pages: "doc", odt: "doc",
  ppt: "slides", pptx: "slides", key: "slides", odp: "slides",
  js: "code", jsx: "code", ts: "code", tsx: "code", py: "code", rb: "code", go: "code", rs: "code", java: "code", json: "code", yml: "code", yaml: "code", html: "code", css: "code", sql: "code", sh: "code", swift: "code", kt: "code",
  zip: "archive", gz: "archive", tar: "archive", rar: "archive", "7z": "archive", dmg: "archive",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", flac: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video",
};

/** Splits "report.final.pdf" into ["report.final", "pdf"]. Dotfiles and names without a dot have no extension. */
export function splitName(name: string): [string, string] {
  const i = name.lastIndexOf(".");
  return i > 0 && i < name.length - 1 ? [name.slice(0, i), name.slice(i + 1)] : [name, ""];
}

export function fileKind(name: string, mime?: string): FileKind {
  const ext = splitName(name)[1].toLowerCase();
  if (EXT[ext]) return EXT[ext];
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime?.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

/** 2_400_000 → "2.4 MB". Decimal units, the way the file browser on the same machine counts. */
export function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1000;
  let u = 0;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return `${v >= 100 || u === 0 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

/* ------------------------------------------------------------------ component */

export type FileStatus = "idle" | "uploading" | "error";

export type FileThumbnailProps = Omit<React.ComponentProps<"div">, "children"> & {
  name: string;
  /** Bytes. */
  size?: number;
  /** MIME type, used when the extension doesn't say. */
  type?: string;
  /** Shows the picture itself for images (a blob or remote URL). */
  previewUrl?: string;
  /** "row" for attachments and lists, "tile" for grids. */
  layout?: "row" | "tile";
  status?: FileStatus;
  /** 0–1 while uploading. Leave undefined for an indeterminate spinner. */
  progress?: number;
  /** Shown instead of the size when status is "error". */
  error?: string;
  /** Opening the file: the whole card becomes the target. */
  href?: string;
  onOpen?: () => void;
  /** Adds the remove button (it reads "Cancel upload" while uploading). */
  onRemove?: () => void;
  onRetry?: () => void;
  /** Play a short entrance when the card mounts, e.g. a file just added. */
  appear?: boolean;
};

export function FileThumbnail({
  name,
  size,
  type,
  previewUrl,
  layout = "row",
  status = "idle",
  progress,
  error,
  href,
  onOpen,
  onRemove,
  onRetry,
  appear = false,
  className,
  ...rest
}: FileThumbnailProps) {
  const reduce = !!useReducedMotion();
  const id = useId();
  const kind = fileKind(name, type);
  const [, ext] = splitName(name);
  const uploading = status === "uploading";
  const failed = status === "error";

  // A just-finished upload gets a moment: the ring completes, a check draws, then the card settles.
  const [justDone, setJustDone] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);
  if (prevStatus !== status) {
    setPrevStatus(status);
    if (prevStatus === "uploading" && status === "idle") setJustDone(true);
  }
  useEffect(() => {
    if (!justDone) return;
    const t = window.setTimeout(() => setJustDone(false), 1100);
    return () => window.clearTimeout(t);
  }, [justDone]);

  const pct = progress === undefined ? undefined : Math.min(1, Math.max(0, progress));
  const meta = failed
    ? (error ?? "Upload failed")
    : uploading
      ? null
      : [ext ? ext.toUpperCase() : null, size !== undefined ? formatBytes(size) : null].filter(Boolean).join(" · ");

  const open = href || onOpen;
  const Target = href ? "a" : "button";
  const targetProps = href ? { href, target: "_blank", rel: "noopener noreferrer" } : { type: "button" as const, onClick: onOpen };

  const enter = appear && !reduce ? { opacity: 0, scale: 0.96, y: 4 } : false;

  return (
    <motion.div
      role="group"
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-meta`}
      data-layout={layout}
      data-status={justDone ? "done" : status}
      data-kind={kind}
      initial={enter}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.14, ease: ease.in } }}
      transition={reduce ? { duration: 0.12 } : spring.soft}
      className={cn(
        "group/file relative min-w-0 rounded-xl border bg-raised shadow-[var(--shadow)] transition-[border-color,background-color] duration-150",
        failed ? "border-danger/35" : "border-line",
        open && "hover:border-line-2 hover:bg-hover has-[[data-target]:focus-visible]:border-fg-4",
        layout === "row" ? "flex h-14 items-center gap-3 p-2 pr-1.5" : "flex w-full flex-col gap-2 p-1.5 pb-2.5",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {/* Preview */}
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden bg-hover",
          layout === "row" ? "size-10 rounded-lg" : "aspect-[4/3] w-full rounded-lg",
        )}
      >
        <Preview kind={kind} ext={ext} previewUrl={previewUrl} large={layout === "tile"} />
        <AnimatePresence initial={false}>
          {(uploading || justDone || failed) && (
            <motion.div
              key="veil"
              className={cn("absolute inset-0 grid place-items-center", failed ? "bg-hover" : "bg-raised/70")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.05 } }}
              transition={{ duration: 0.15 }}
            >
              <ProgressRing value={justDone ? 1 : pct} state={failed ? "error" : justDone ? "done" : "active"} size={layout === "tile" ? 36 : 28} reduce={reduce} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name and meta */}
      <div className={cn("flex min-w-0 flex-col", layout === "row" ? "flex-1 gap-0.5" : "gap-0.5 px-1")}>
        <MiddleName id={`${id}-name`} name={name} />
        <p id={`${id}-meta`} className={cn("flex min-w-0 items-center gap-1 text-[12px] leading-4", failed ? "text-danger" : "text-fg-3")}>
          {uploading ? (
            <>
              <span>Uploading</span>
              {pct !== undefined && (
                <>
                  <span aria-hidden>·</span>
                  <NumberFlow value={pct} format={{ style: "percent", maximumFractionDigits: 0 }} locales="en-US" animated={!reduce} className="tabular" />
                </>
              )}
            </>
          ) : (
            <span className="truncate">{meta}</span>
          )}
        </p>
      </div>

      {/* The whole card opens the file; buttons sit above this target. */}
      {open && (
        <Target
          data-target
          aria-labelledby={`${id}-name`}
          className="absolute inset-0 rounded-[inherit] outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          {...targetProps}
        />
      )}

      {(onRemove || (failed && onRetry)) && (
        <div
          className={cn(
            "z-10 flex shrink-0 items-center",
            layout === "row" && "relative",
            layout === "tile" &&
              "absolute right-2.5 top-2.5 gap-1 rounded-lg transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/file:opacity-100 pointer-fine:group-focus-within/file:opacity-100",
            layout === "tile" && (failed || uploading) && "pointer-fine:opacity-100",
          )}
        >
          {failed && onRetry && (
            <CardButton label={`Retry uploading ${name}`} onClick={onRetry} tile={layout === "tile"}>
              <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
            </CardButton>
          )}
          {onRemove && (
            <CardButton label={uploading ? `Cancel upload of ${name}` : `Remove ${name}`} onClick={onRemove} tile={layout === "tile"}>
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </CardButton>
          )}
        </div>
      )}

      {uploading && pct !== undefined && (
        <span role="progressbar" aria-label={`Uploading ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} className="sr-only" />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {justDone ? `${name} uploaded` : failed ? `${name}: ${error ?? "upload failed"}` : ""}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * Middle truncation that keeps the extension: the start of the name shrinks with an
 * ellipsis, the last few characters and the extension never do. Pure CSS, so it
 * follows the card's width. The full name stays in the title and the accessible name.
 */
function MiddleName({ name, id }: { name: string; id: string }) {
  const [base, ext] = splitName(name);
  const keep = Math.min(base.length, 6);
  const head = base.slice(0, base.length - keep);
  const tail = base.slice(base.length - keep) + (ext ? `.${ext}` : "");
  return (
    <p id={id} title={name} className="flex min-w-0 text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg">
      <span aria-hidden className="truncate">{head}</span>
      <span aria-hidden className="shrink-0 whitespace-pre">{tail}</span>
      <span className="sr-only">{name}</span>
    </p>
  );
}

function Preview({ kind, ext, previewUrl, large }: { kind: FileKind; ext: string; previewUrl?: string; large: boolean }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  if (previewUrl && broken !== previewUrl) {
    return (
      <>
        <Glyph kind={kind} ext={ext} large={large} />
        {/* eslint-disable-next-line @next/next/no-img-element -- previews are often local blob URLs */}
        <img
          src={previewUrl}
          alt=""
          ref={(i) => {
            if (i?.complete && i.naturalWidth && loaded !== previewUrl) setLoaded(previewUrl);
          }}
          onLoad={() => setLoaded(previewUrl)}
          onError={() => setBroken(previewUrl)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out-quart motion-reduce:transition-none",
            loaded === previewUrl ? "opacity-100" : "opacity-0",
          )}
        />
      </>
    );
  }
  return <Glyph kind={kind} ext={ext} large={large} />;
}

// A page with a folded corner, a mark for the kind, and the extension on a tab.
function Glyph({ kind, ext, large }: { kind: FileKind; ext: string; large: boolean }) {
  const mark: Record<FileKind, React.ReactNode> = {
    pdf: <path d="M7 11.5h10M7 14.5h10M7 17.5h6" />,
    doc: <path d="M7 11.5h10M7 14.5h10M7 17.5h7" />,
    sheet: <path d="M7 11h10v8H7zM7 15h10M11.5 11v8" />,
    slides: <path d="M7 11.5h10v6H7zM12 17.5v2" />,
    code: <path d="m10 12-2.5 2.75L10 17.5M14 12l2.5 2.75L14 17.5" />,
    image: <path d="m7 18 3.25-3.5 2.25 2.25 1.5-1.5L17 18M13.5 11.75a.25.25 0 1 1 0 .01" />,
    archive: <path d="M11 4.5v1.5M13 6v1.5M11 7.5V9M13 9v1.5M11 10.5V12M11.25 13.5h1.5v2.5h-1.5z" />,
    audio: <path d="M8 14.5v1M10.25 12.5v5M12.5 11v8M14.75 13v4M17 14.25v1.5" />,
    video: <path d="m10.5 12 5 2.75-5 2.75z" />,
    other: <path d="M7 12.5h10M7 15.5h6" />,
  };
  const label = ext ? ext.slice(0, 4).toUpperCase() : "";
  return (
    <span aria-hidden className={cn("relative grid place-items-center", large ? "h-[52px] w-[42px]" : "h-[30px] w-6")}>
      <svg viewBox="0 0 24 30" className="absolute inset-0 size-full text-fg-3" fill="none" stroke="currentColor" strokeWidth={large ? 1 : 1.3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 1.5h10l5.5 5.5v19.5a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-23a2 2 0 0 1 2-2z" className="fill-raised" />
        <path d="M14.5 1.5V5a2 2 0 0 0 2 2h3.5" />
        <g className="text-fg-2" stroke="currentColor">
          {mark[kind]}
        </g>
      </svg>
      {label && (
        <span
          className={cn(
            "absolute left-[-3px] rounded-[3px] bg-fg font-mono font-medium leading-none tracking-[0.02em] text-frame",
            large ? "bottom-[7px] px-1 py-[2.5px] text-[8.5px]" : "bottom-[3px] px-[3px] py-[1.5px] text-[6.5px]",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/** Determinate ring that springs to each new value, a spinning arc when the total is unknown, a drawn check or cross at the end. */
function ProgressRing({ value, state, size, reduce }: { value?: number; state: "active" | "done" | "error"; size: number; reduce: boolean }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const sprung = useSpring(value ?? 0, reduce ? { duration: 0 } : { stiffness: 140, damping: 24 });
  useEffect(() => {
    sprung.set(value ?? 0);
  }, [value, sprung]);
  const offset = useTransform(sprung, (v) => c * (1 - v));
  const draw = reduce ? { duration: 0 } : { duration: 0.3, ease: ease.out, delay: 0.1 };
  return (
    <span className={cn("grid place-items-center rounded-full", state === "error" ? "text-danger" : "text-fg")} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className="size-full -rotate-90" fill="none">
        <circle cx="12" cy="12" r={r} stroke="currentColor" strokeOpacity={0.18} strokeWidth={2} />
        {state !== "error" &&
          (value === undefined && state === "active" ? (
            <circle cx="12" cy="12" r={r} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${c * 0.28} ${c}`} className="origin-center animate-spin [animation-duration:0.9s]" />
          ) : (
            <motion.circle cx="12" cy="12" r={r} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={c} style={{ strokeDashoffset: offset }} />
          ))}
      </svg>
      <svg viewBox="0 0 16 16" className="absolute size-[45%]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {state === "done" && <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={draw} />}
        {state === "error" && (
          <>
            <motion.path d="m5 5 6 6" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={draw} />
            <motion.path d="m11 5-6 6" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ ...draw, delay: reduce ? 0 : 0.2 }} />
          </>
        )}
      </svg>
    </span>
  );
}

function CardButton({ label, onClick, tile, children }: { label: string; onClick: () => void; tile: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative grid place-items-center rounded-md outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out-quart active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        tile ? "size-6 border border-line-2 bg-raised/90 text-fg-2 shadow-[var(--shadow)] backdrop-blur-sm hover:text-fg" : "size-7 text-fg-3 hover:bg-fg/[0.06] hover:text-fg",
      )}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
